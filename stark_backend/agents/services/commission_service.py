"""Snapshot-backed agent commission orchestration."""

from decimal import Decimal, ROUND_DOWN
import logging

from django.db import transaction as db_transaction

from agents.models import AgentProfile
from finance.conversion import CurrencyConversionService, RateSide
from finance.services import FinanceService
from transactions.models import Transaction
from wallets.models import Wallet


class CommissionSnapshotRequired(ValueError):
    code = "COMMISSION_SNAPSHOT_REQUIRED"


class CommissionStateConflict(ValueError):
    code = "COMMISSION_STATE_CONFLICT"

logger = logging.getLogger(__name__)


def _commission_conversion(amount, currency):
    """Build an explicit same-currency result for a commission credit."""
    currency = str(currency).upper()
    return CurrencyConversionService.convert(
        amount=amount,
        source_currency=currency,
        target_currency=currency,
        rate_side=RateSide.NONE,
        operation_type="commission_same_currency",
    )


@db_transaction.atomic
def credit_agent_commission(user, amount, currency, source_tx=None, note=None):
    """Credit one idempotent, snapshot-backed commission ledger entry."""
    if not user or getattr(user, "role", None) != "user":
        return None
    pricing_snapshot = (source_tx.operation_context or {}).get("pricing") if source_tx is not None else None
    if source_tx is not None and pricing_snapshot:
        agent_id = pricing_snapshot.get("agent_id") or getattr(user, "agent_id", None)
        commission_percent = Decimal(str(pricing_snapshot.get("agent_commission_rate") or "0"))
        commission_source = pricing_snapshot.get("agent_commission_source") or "none"
        assignment_id = pricing_snapshot.get("agent_assignment_id")
        base_amount = Decimal(str(pricing_snapshot.get("wallet_charge_amount") or amount))
        commission_amount = Decimal(str(
            pricing_snapshot.get("expected_agent_commission_amount")
            or (base_amount * commission_percent / Decimal("100")).quantize(Decimal("0.0001"), rounding=ROUND_DOWN)
        ))
    else:
        # Compatibility for pre-1.5 transactions without a pricing snapshot.
        # New purchases always take the immutable branch above.
        agent_id = getattr(user, "agent_id", None)
        profile = AgentProfile.objects.filter(user_id=agent_id).first() if agent_id else None
        commission_percent = Decimal(str(getattr(profile, "commission_rate", 0) or 0))
        commission_source = "legacy_agent_profile"
        assignment_id = None
        base_amount = Decimal(str(amount))
        commission_amount = (base_amount * commission_percent / Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_DOWN
        )
    if not agent_id:
        return None

    agent_profile = AgentProfile.objects.select_for_update().filter(user_id=agent_id).first()
    if not agent_profile:
        return None
    if commission_percent < 0 or commission_percent >= Decimal("100"):
        raise CommissionStateConflict("Effective commission rate has an invalid gross-up denominator.")
    if commission_percent <= 0 or commission_amount <= 0:
        return None

    currency = str((pricing_snapshot or {}).get("wallet_charge_currency") or currency).upper()
    if commission_amount <= 0:
        return None

    if source_tx is not None and str(source_tx.currency).upper() != currency:
        raise ValueError("Commission currency must match the originating customer charge.")

    agent_wallet, _ = Wallet.objects.get_or_create(user_id=agent_id, currency=currency)
    conversion = _commission_conversion(commission_amount, currency)
    commission_key = f"commission:{source_tx.id}" if source_tx is not None else None
    operation_context = {
        "snapshot_locked": True,
        "commission": {
            "rate_percent": str(commission_percent),
            "amount": str(commission_amount),
            "currency": currency,
            "rate_source": commission_source,
            "assignment_id": assignment_id,
            "customer_charge": str(base_amount),
            "source_transaction_id": None if source_tx is None else source_tx.id,
            "reversal_status": "open",
            "credited_totals_applied": True,
        },
        "source_operation_id": None if source_tx is None else source_tx.id,
    }
    tx_note = note or (
        f"Commission for transaction {source_tx.id} ({commission_percent}%)"
        if source_tx is not None else f"Commission ({commission_percent}%)"
    )
    if commission_key and Transaction.objects.filter(idempotency_key=commission_key).exists():
        return commission_amount
    commission_tx = FinanceService.deposit(
        wallet_id=agent_wallet.id,
        amount=commission_amount,
        transaction_type="commission",
        note=tx_note,
        idempotency_key=commission_key,
        conversion_result=conversion,
        operation_context=operation_context,
        related_transaction=source_tx,
    )
    commission_tx = FinanceService.approve(commission_tx.id)

    # Preserve the existing profile totals for compatibility. The ledger
    # transaction remains the authoritative financial record.
    agent_profile.total_earnings += commission_amount
    if currency == "USD":
        agent_profile.total_earnings_usd += commission_amount
    elif currency == "SYP":
        agent_profile.total_earnings_syp += commission_amount
    agent_profile.save(update_fields=["total_earnings", "total_earnings_usd", "total_earnings_syp"])
    return commission_amount


@db_transaction.atomic
def reverse_agent_commission(commission_transaction_id, reason=""):
    """Reverse exactly one approved commission using its original snapshot."""
    commission_tx = Transaction.objects.select_for_update().get(
        pk=commission_transaction_id, transaction_type="commission"
    )
    reversal_key = f"commission-reversal:{commission_tx.id}"
    existing = Transaction.objects.filter(idempotency_key=reversal_key).first()
    if existing:
        return existing
    if commission_tx.status != "approved":
        raise ValueError("Only approved commissions can be reversed.")
    profile = AgentProfile.objects.select_for_update().filter(user_id=commission_tx.user_id).first()
    if profile is None:
        raise CommissionStateConflict("Commission agent profile is missing.")
    amount = abs(commission_tx.amount)
    conversion = _commission_conversion(amount, commission_tx.currency)
    reversal = FinanceService.withdraw(
        wallet_id=commission_tx.wallet_id,
        amount=amount,
        transaction_type="refund",
        note=f"Commission reversal for TX#{commission_tx.id}. {reason}".strip(),
        idempotency_key=reversal_key,
        conversion_result=conversion,
        operation_context={
            "snapshot_locked": True,
            "commission_reversal_of": commission_tx.id,
            "original_commission_amount": str(amount),
            "original_commission_snapshot": (commission_tx.operation_context or {}).get("commission", {}),
        },
        related_transaction=commission_tx,
    )
    reversal = FinanceService.approve(reversal.id)
    if profile.total_earnings < amount:
        raise CommissionStateConflict("Legacy commission totals cannot be reconciled.")
    profile.total_earnings -= amount
    if commission_tx.currency == "USD":
        if profile.total_earnings_usd < amount:
            raise CommissionStateConflict("Legacy USD commission totals cannot be reconciled.")
        profile.total_earnings_usd -= amount
    elif commission_tx.currency == "SYP":
        if profile.total_earnings_syp < amount:
            raise CommissionStateConflict("Legacy SYP commission totals cannot be reconciled.")
        profile.total_earnings_syp -= amount
    profile.save(update_fields=["total_earnings", "total_earnings_usd", "total_earnings_syp"])
    return reversal


@db_transaction.atomic
def reverse_commission_for_purchase(source_tx, reason=""):
    """Reverse the one commission linked to a purchase, if it exists."""
    commission_tx = Transaction.objects.select_for_update().filter(
        transaction_type="commission", related_transaction=source_tx,
    ).first()
    if commission_tx is None:
        commission_tx = Transaction.objects.select_for_update().filter(
            transaction_type="commission",
            operation_context__commission__source_transaction_id=source_tx.id,
        ).first()
    if commission_tx is None:
        return None
    return reverse_agent_commission(commission_tx.id, reason=reason)
