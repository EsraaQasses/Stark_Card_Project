"""Canonical shipping and cashout financial orchestration for Phase 1.2D4."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from django.db import transaction as db_transaction
from django.utils import timezone

from finance.conversion import CurrencyConversionService, ConversionResult, RateSide, RateUnavailable
from finance.services import FinanceService, InsufficientFunds, InvalidFinancialTransition
from wallets.models import Wallet


class ShippingFinanceError(ValueError):
    code = "SHIPPING_STATE_CONFLICT"


class CashoutStateConflict(ShippingFinanceError):
    code = "CASHOUT_STATE_CONFLICT"


class UnsupportedCurrencyFlow(ShippingFinanceError):
    code = "UNSUPPORTED_CURRENCY_FLOW"


@dataclass(frozen=True)
class ShippingFinancialContext:
    flow_type: str
    source_user_id: int
    submitted_amount: Decimal
    submitted_currency: str
    source_wallet_id: Optional[int]
    source_wallet_currency: str
    credited_wallet_id: Optional[int]
    credited_currency: str
    credited_amount: Decimal
    conversion: object
    operation_key: str
    correlation_id: str
    reservation_at: object
    approval_owner_id: Optional[int] = None

    @property
    def snapshot(self):
        result = self.conversion
        return {
            "flow_type": self.flow_type,
            "submitted_amount": str(self.submitted_amount),
            "submitted_currency": self.submitted_currency,
            "source_wallet_id": self.source_wallet_id,
            "source_wallet_currency": self.source_wallet_currency,
            "credited_wallet_id": self.credited_wallet_id,
            "credited_currency": self.credited_currency,
            "credited_amount": str(self.credited_amount),
            "quote_id": result.quote_id,
            "rate_side": result.rate_side.value,
            "rate_used": None if result.rate_used is None else str(result.rate_used),
            "operation_type": result.operation_type,
            "source_amount": str(result.source_amount),
            "source_currency": result.source_currency,
            "target_amount": str(result.target_amount),
            "target_currency": result.target_currency,
            "rounding_mode": result.rounding_policy,
            "operation_key": self.operation_key,
            "correlation_id": self.correlation_id,
            "reservation_at": self.reservation_at.isoformat(),
        }


class ShippingFinanceService:
    """One conversion and wallet-mutation boundary for shipping/cashout."""

    SHIPPING_BUY_OPERATION = "shipping_submitted_usd_to_syp"
    SHIPPING_SELL_OPERATION = "shipping_submitted_syp_to_usd"
    CASHOUT_BUY_OPERATION = "cashout_reserved_usd_to_syp"
    CASHOUT_SELL_OPERATION = "cashout_reserved_syp_to_usd"

    @staticmethod
    def _currencies(source, target):
        source = str(source).upper()
        target = str(target).upper()
        if source not in {"USD", "SYP"} or target not in {"USD", "SYP"}:
            raise UnsupportedCurrencyFlow("Only USD and SYP are supported.")
        return source, target

    @classmethod
    def _rate_side(cls, source, target):
        if source == target:
            return RateSide.NONE
        if source == "USD" and target == "SYP":
            return RateSide.PLATFORM_BUYS_BASE
        return RateSide.PLATFORM_SELLS_BASE

    @classmethod
    def prepare(cls, *, flow_type, user_id, amount, submitted_currency,
                target_currency, source_wallet_id=None, credited_wallet_id=None,
                operation_key=None, quote=None):
        source, target = cls._currencies(submitted_currency, target_currency)
        amount = Decimal(str(amount))
        if amount <= 0:
            raise ShippingFinanceError("Amount must be greater than zero.")
        if quote is None and source != target:
            from wallets.rate_quotes import ExchangeRateQuoteService
            quote = ExchangeRateQuoteService.get_active_quote()
            if quote is None:
                raise RateUnavailable("No active USD/SYP quote is available.")
        if source == target:
            operation = f"{flow_type}_same_currency"
        elif flow_type.startswith("cashout"):
            operation = cls.CASHOUT_BUY_OPERATION if source == "USD" else cls.CASHOUT_SELL_OPERATION
        else:
            operation = cls.SHIPPING_BUY_OPERATION if source == "USD" else cls.SHIPPING_SELL_OPERATION
        conversion = CurrencyConversionService.convert(
            amount=amount,
            source_currency=source,
            target_currency=target,
            rate_side=cls._rate_side(source, target),
            operation_type=operation,
            quote=quote,
        )
        return ShippingFinancialContext(
            flow_type=flow_type,
            source_user_id=user_id,
            submitted_amount=amount,
            submitted_currency=source,
            source_wallet_id=source_wallet_id,
            source_wallet_currency=source,
            credited_wallet_id=credited_wallet_id,
            credited_currency=target,
            credited_amount=conversion.target_amount,
            conversion=conversion,
            operation_key=operation_key or f"{flow_type}:{uuid4()}",
            correlation_id=str(uuid4()),
            reservation_at=timezone.now(),
        )

    @staticmethod
    def write_snapshot(user_input_data, context: ShippingFinancialContext, **extra):
        return {
            **(user_input_data or {}),
            "financial_snapshot": {**context.snapshot, **extra},
        }

    @staticmethod
    def snapshot_from(data):
        return (data or {}).get("financial_snapshot") or {}

    @classmethod
    def from_snapshot(cls, *, flow_type, user_id, snapshot, source_wallet_id=None,
                      credited_wallet_id=None, approval_owner_id=None):
        result = ConversionResult(
            source_amount=snapshot["source_amount"],
            source_currency=snapshot["source_currency"],
            target_amount=snapshot["target_amount"],
            target_currency=snapshot["target_currency"],
            quote_id=snapshot.get("quote_id"),
            rate_side=snapshot["rate_side"],
            rate_used=snapshot.get("rate_used"),
            operation_type=snapshot.get("operation_type", flow_type),
            unrounded_amount=snapshot["target_amount"],
            rounded_amount=snapshot["target_amount"],
            rounding_policy=snapshot.get("rounding_mode", "MONEY_QUANTUM_8_HALF_UP"),
            calculated_at=snapshot.get("reservation_at") or timezone.now(),
        )
        return ShippingFinancialContext(
            flow_type=flow_type,
            source_user_id=user_id,
            submitted_amount=Decimal(snapshot["submitted_amount"]),
            submitted_currency=snapshot["submitted_currency"],
            source_wallet_id=source_wallet_id or snapshot.get("source_wallet_id"),
            source_wallet_currency=snapshot.get("source_wallet_currency", snapshot["source_currency"]),
            credited_wallet_id=credited_wallet_id or snapshot.get("credited_wallet_id"),
            credited_currency=snapshot["credited_currency"],
            credited_amount=Decimal(snapshot["credited_amount"]),
            conversion=result,
            operation_key=snapshot.get("operation_key") or f"{flow_type}:{uuid4()}",
            correlation_id=snapshot.get("correlation_id") or str(uuid4()),
            reservation_at=timezone.now(),
            approval_owner_id=approval_owner_id,
        )

    @staticmethod
    def _owner(shipping):
        if hasattr(shipping, "user_input_data"):
            return shipping, "user_input_data"
        return shipping.request, "user_input_data"

    @classmethod
    def ensure_snapshot(cls, shipping, *, target_currency, source_wallet_id=None,
                        credited_wallet_id=None, flow_type="shipping", operation_key=None):
        owner, field = cls._owner(shipping)
        data = getattr(owner, field, {}) or {}
        existing = cls.snapshot_from(data)
        if existing:
            return cls.from_snapshot(
                flow_type=flow_type, user_id=getattr(shipping, "user_id", None) or getattr(shipping, "agent_id", None),
                snapshot=existing, source_wallet_id=source_wallet_id,
                credited_wallet_id=credited_wallet_id,
            )
        context = cls.prepare(
            flow_type=flow_type, user_id=getattr(shipping, "user_id", None) or getattr(shipping, "agent_id", None), amount=shipping.amount,
            submitted_currency=shipping.currency, target_currency=target_currency,
            source_wallet_id=source_wallet_id, credited_wallet_id=credited_wallet_id,
            operation_key=operation_key or f"{flow_type}:{shipping.__class__.__name__}:{shipping.id}",
        )
        owner.user_input_data = cls.write_snapshot(data, context)
        owner.save(update_fields=[field, "updated_at"])
        return context

    @classmethod
    @db_transaction.atomic
    def process_shipping(cls, shipping, *, approver=None):
        """Approve the standard, agent, admin-agent, or linked shipping flow."""
        from agents.models import AgentProfile
        model = type(shipping)
        shipping = model.objects.select_for_update().get(pk=shipping.pk)
        if shipping.status == "approved":
            from transactions.models import Transaction
            if getattr(shipping, "transaction_ref", None):
                return Transaction.objects.get(pk=str(shipping.transaction_ref).replace("TXN_", ""))
            # The legacy generic shipping view persists the status before it
            # invokes payment processing.  Treat that unreferenced state as
            # an in-flight approval; the transaction reference is the durable
            # marker used for duplicate-approval replay.
            shipping.status = "pending"
        if shipping.status == "rejected":
            raise ShippingFinanceError("Rejected shipping cannot be approved.")

        request_data = getattr(getattr(shipping, "request", None), "user_input_data", None) or getattr(shipping, "user_input_data", {}) or {}
        channel = str(request_data.get("shipping_channel") or "").lower()
        is_cashout = getattr(getattr(shipping, "request", None), "request_type", None) == "cashout"
        cashout_tx_id = request_data.get("cashout_tx_id")
        if is_cashout and cashout_tx_id:
            return cls.finalize_cashout(transaction_id=cashout_tx_id, approver=approver)[0]

        target_user = getattr(shipping, "user", None)
        target_wallet_currency = str(getattr(shipping, "wallet_currency", None) or request_data.get("wallet_currency") or shipping.currency).upper()
        target_wallet = None
        if target_user is not None:
            target_wallet = Wallet.objects.filter(user=target_user, currency=target_wallet_currency).first()

        # Via-agent shipping debits the agent's source wallet and credits the user.
        if channel == "agent" and getattr(target_user, "agent_id", None):
            agent = target_user.agent
            agent_wallet = Wallet.objects.filter(user=agent, currency=str(shipping.currency).upper()).first()
            if agent_wallet is None:
                raise ShippingFinanceError("Agent source wallet does not exist.")
            profile = AgentProfile.objects.filter(user=agent).first()
            coverage = Decimal("0")
            if profile:
                coverage = Decimal(str(getattr(profile, "coverage_limit_syp" if agent_wallet.currency == "SYP" else "coverage_limit_usd", 0) or 0))
            context = cls.ensure_snapshot(
                shipping, target_currency=target_wallet.currency,
                source_wallet_id=agent_wallet.id, credited_wallet_id=target_wallet.id,
                flow_type="agent_shipping",
            )
            debit, credit = cls.paired_credit(
                context=context, source_wallet_id=agent_wallet.id,
                target_wallet_id=target_wallet.id, source_amount=context.submitted_amount,
                coverage_limit=coverage, note=f"Shipping #{shipping.id}", admin_user=approver,
            )
            shipping.agent_transaction_ref = f"TXN_{debit.id}"
            shipping.user_transaction_ref = f"TXN_{credit.id}"
            shipping.processed_at = timezone.now()
            return debit

        recipient = getattr(shipping, "agent", None) if shipping.__class__.__name__ == "AgentAdminShippingRequest" else target_user
        if shipping.__class__.__name__ == "AgentAdminShippingRequest":
            target_wallet = Wallet.objects.filter(user=recipient, currency=target_wallet_currency).first()
            if target_wallet is None:
                raise ShippingFinanceError("Agent target wallet does not exist.")
        elif target_wallet is None:
            raise ShippingFinanceError("Target wallet does not exist.")
        context = cls.ensure_snapshot(
            shipping, target_currency=target_wallet.currency,
            credited_wallet_id=target_wallet.id, flow_type="shipping",
        )
        tx = cls.credit(
            context=context, wallet_id=target_wallet.id,
            note=f"Shipping #{shipping.id}", admin_user=approver,
        )
        shipping.transaction_ref = f"TXN_{tx.id}"
        shipping.processed_at = timezone.now()
        return tx

    @classmethod
    @db_transaction.atomic
    def credit(cls, *, context, wallet_id, note, transaction_type="deposit", admin_user=None):
        tx = FinanceService.deposit(
            wallet_id=wallet_id,
            amount=context.credited_amount,
            transaction_type=transaction_type,
            note=note,
            idempotency_key=context.operation_key,
            conversion_result=context.conversion,
            operation_context=context.snapshot,
        )
        if tx.status == "pending":
            tx = FinanceService.approve(tx.id, admin_user=admin_user)
        return tx

    @classmethod
    @db_transaction.atomic
    def paired_credit(cls, *, context, source_wallet_id, target_wallet_id,
                      source_amount, coverage_limit=Decimal("0"), note="", admin_user=None):
        source, target = sorted([source_wallet_id, target_wallet_id])
        Wallet.objects.select_for_update().filter(id__in=[source, target]).count()
        source_wallet = Wallet.objects.select_for_update().get(pk=source_wallet_id)
        target_wallet = Wallet.objects.select_for_update().get(pk=target_wallet_id)
        debit = FinanceService.withdraw(
            wallet_id=source_wallet_id, amount=source_amount,
            transaction_type="transfer", note=note,
            idempotency_key=f"{context.operation_key}:debit",
            allow_overdraft=coverage_limit > 0, overdraft_limit=coverage_limit,
            conversion_result=context.conversion, operation_context=context.snapshot,
        )
        credit = FinanceService.deposit(
            wallet_id=target_wallet_id, amount=context.credited_amount,
            transaction_type="transfer", note=note,
            idempotency_key=f"{context.operation_key}:credit",
            conversion_result=context.conversion, operation_context=context.snapshot,
            related_transaction=debit,
        )
        debit.related_transaction = credit
        debit.save(update_fields=["related_transaction", "updated_at"])
        FinanceService.approve(debit.id, admin_user=admin_user)
        FinanceService.approve(credit.id, admin_user=admin_user)
        return debit, credit

    @classmethod
    @db_transaction.atomic
    def reserve_cashout(cls, *, user, wallet, amount, payout_currency,
                        recipient=None, note="", operation_key=None, coverage_limit=Decimal("0")):
        if operation_key:
            from transactions.models import Transaction
            existing = Transaction.objects.filter(
                idempotency_key=operation_key, transaction_type="cashout"
            ).first()
            if existing:
                snapshot = existing.operation_context or {}
                if not snapshot.get("source_amount"):
                    raise CashoutStateConflict("Cashout reservation snapshot is required.")
                if snapshot.get("source_wallet_id") and int(snapshot["source_wallet_id"]) != int(wallet.id):
                    raise CashoutStateConflict("Cashout idempotency key conflicts with another wallet.")
                context = cls.from_snapshot(
                    flow_type="cashout", user_id=user.id, snapshot=snapshot,
                    source_wallet_id=wallet.id,
                )
                return existing, context
        context = cls.prepare(
            flow_type="cashout", user_id=user.id, amount=amount,
            submitted_currency=wallet.currency, target_currency=payout_currency,
            source_wallet_id=wallet.id, operation_key=operation_key,
        )
        tx = FinanceService.withdraw(
            wallet_id=wallet.id, amount=context.submitted_amount,
            transaction_type="cashout", note=note,
            idempotency_key=context.operation_key,
            allow_overdraft=coverage_limit > 0, overdraft_limit=coverage_limit,
            conversion_result=context.conversion,
            operation_context=context.snapshot,
            recipient=recipient,
        )
        return tx, context

    @classmethod
    @db_transaction.atomic
    def finalize_cashout(cls, *, transaction_id, approver=None):
        from transactions.models import Transaction
        tx = Transaction.objects.select_for_update().select_related("wallet", "user").get(
            pk=transaction_id, transaction_type="cashout"
        )
        if tx.status == "approved":
            return tx, getattr(tx, "recipient_wallet", None), True
        if tx.status != "pending":
            raise CashoutStateConflict("Cashout is not pending.")
        if not tx.exchange_rate_side or tx.target_amount is None:
            raise CashoutStateConflict("Cashout reservation snapshot is required.")
        recipient = tx.recipient
        if recipient is None:
            raise CashoutStateConflict("Cashout recipient is required.")
        target_wallet = Wallet.objects.select_for_update().filter(
            user=recipient, currency=tx.target_currency
        ).first()
        if target_wallet is None:
            target_wallet = Wallet.objects.create(user=recipient, currency=tx.target_currency)
        context = type("SnapshotContext", (), {
            "credited_amount": tx.target_amount,
            "conversion": ConversionResult(
                quote_id=tx.exchange_rate_quote_id,
                rate_side=tx.exchange_rate_side,
                rate_used=tx.exchange_rate_used,
                source_amount=tx.source_amount,
                source_currency=tx.source_currency,
                target_amount=tx.target_amount,
                target_currency=tx.target_currency,
                unrounded_amount=tx.target_amount,
                rounded_amount=tx.target_amount,
                rounding_policy=tx.rounding_mode or "MONEY_QUANTUM_8_HALF_UP",
                operation_type=(tx.operation_context or {}).get("operation_type", "cashout"),
                calculated_at=tx.created_at,
            ),
            "operation_key": f"cashout:{tx.id}",
            "snapshot": tx.operation_context or {},
        })()
        credit = cls.credit(
            context=context, wallet_id=target_wallet.id,
            note=f"Cashout payment for TX#{tx.id}", transaction_type="deposit", admin_user=approver,
        )
        tx.recipient_wallet = target_wallet
        tx.external_reference = f"TXN_{credit.id}"
        tx.save(update_fields=["recipient_wallet", "external_reference", "updated_at"])
        return FinanceService.approve(tx.id, admin_user=approver), credit, False

    @classmethod
    @db_transaction.atomic
    def reject_cashout(cls, *, transaction_id, reason="", approver=None):
        from transactions.models import Transaction
        tx = Transaction.objects.select_for_update().get(pk=transaction_id, transaction_type="cashout")
        if tx.status in {"rejected", "cancelled"}:
            return tx, True
        if tx.status != "pending":
            raise CashoutStateConflict("Cashout is not pending.")
        return FinanceService.reject(tx.id, admin_user=approver, reason=reason), False
