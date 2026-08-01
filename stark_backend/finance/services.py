from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.db import transaction as db_transaction
from django.db import IntegrityError
from django.db.models import F
from django.utils import timezone

from transactions.models import Transaction
from wallets.models import Wallet
from .conversion import ConversionResult
from .precision import MONEY_QUANTUM, RATE_QUANTUM, quantize_money, quantize_rate


SUPPORTED_CURRENCIES = frozenset(("USD", "SYP"))


class FinanceError(ValueError):
    """Expected financial operation failure."""

    code = "FINANCE_ERROR"


class InsufficientFunds(FinanceError):
    pass


class InvalidFinancialTransition(FinanceError):
    pass


class SnapshotRequired(FinanceError):
    code = "FX_RATE_SNAPSHOT_REQUIRED"


class IdempotencyConflict(FinanceError):
    code = "IDEMPOTENCY_CONFLICT"


class RefundSnapshotIncomplete(FinanceError):
    code = "FX_REFUND_SNAPSHOT_INCOMPLETE"


class FinanceService:
    """Atomic orchestration for wallet and ledger mutations.

    Public endpoint behavior remains unchanged; callers receive the existing
    Transaction model and can continue serializing it as before.
    """

    @staticmethod
    def money(value) -> Decimal:
        return quantize_money(value)

    @staticmethod
    def rate(value) -> Optional[Decimal]:
        if value is None:
            return None
        return quantize_rate(value)

    @staticmethod
    def _wallet_for_update(wallet_id: int) -> Wallet:
        return Wallet.objects.select_for_update().get(pk=wallet_id)

    @classmethod
    def _existing_idempotent(cls, key: Optional[str]) -> Optional[Transaction]:
        if not key:
            return None
        return Transaction.objects.filter(idempotency_key=key).first()

    @classmethod
    def _create_pending(
        cls,
        *,
        wallet: Wallet,
        amount: Decimal,
        transaction_type: str,
        note: str = "",
        idempotency_key: Optional[str] = None,
        amount_usd=None,
        amount_syp=None,
        exchange_rate_used=None,
        allow_overdraft=False,
        overdraft_limit=None,
        conversion_result: Optional[ConversionResult] = None,
        snapshot_override=None,
        source_currency=None,
        target_currency=None,
        operation_context=None,
        **extra,
    ) -> Transaction:
        existing = cls._existing_idempotent(idempotency_key)
        if existing:
            if conversion_result:
                cls._assert_snapshot_matches(existing, conversion_result)
            requested_fingerprint = (operation_context or {}).get("request_fingerprint")
            stored_fingerprint = (existing.operation_context or {}).get("request_fingerprint")
            if requested_fingerprint and stored_fingerprint and requested_fingerprint != stored_fingerprint:
                raise IdempotencyConflict("Idempotency key conflicts with a different operation.")
            return existing
        if amount == 0:
            raise FinanceError("Transaction amount must not be zero")
        balance_before = cls.money(wallet.available_balance)
        snapshot = snapshot_override or cls._snapshot_fields(
            wallet=wallet,
            amount=amount,
            conversion_result=conversion_result,
            source_currency=source_currency,
            target_currency=target_currency,
            operation_context=operation_context,
        )
        amount_usd = snapshot.pop("amount_usd", amount_usd)
        amount_syp = snapshot.pop("amount_syp", amount_syp)
        exchange_rate_used = snapshot.pop("exchange_rate_used", exchange_rate_used)
        try:
            with db_transaction.atomic():
                tx = Transaction.objects.create(
                    user_id=wallet.user_id,
                    wallet=wallet,
                    amount=cls.money(amount),
                    currency=wallet.currency,
                    transaction_type=transaction_type,
                    status="pending",
                    note=note,
                    idempotency_key=idempotency_key,
                    balance_before=balance_before,
                    amount_usd=amount_usd,
                    amount_syp=amount_syp,
                    exchange_rate_used=cls.rate(exchange_rate_used),
                    **snapshot,
                    **extra,
                )
        except IntegrityError:
            existing = cls._existing_idempotent(idempotency_key)
            if existing:
                return existing
            raise
        if tx.amount > 0:
            wallet.pending_balance = cls.money(wallet.pending_balance + tx.amount)
        else:
            allowed = wallet.available_balance
            if allow_overdraft and overdraft_limit is not None:
                allowed += cls.money(overdraft_limit)
            if allowed < abs(tx.amount):
                raise InsufficientFunds(
                    f"Insufficient funds. Available: {wallet.available_balance}, Required: {abs(tx.amount)}"
                )
            wallet.available_balance = cls.money(wallet.available_balance + tx.amount)
            wallet.pending_balance = cls.money(wallet.pending_balance + abs(tx.amount))
        wallet.save(update_fields=["available_balance", "pending_balance", "updated_at"])
        cls._snapshot(tx, wallet)
        return tx

    @classmethod
    def _snapshot_fields(
        cls, *, wallet, amount, conversion_result, source_currency,
        target_currency, operation_context=None,
    ):
        if conversion_result is None:
            if source_currency or target_currency:
                if not source_currency or not target_currency or str(source_currency).upper() != str(target_currency).upper() or str(source_currency).upper() != wallet.currency:
                    raise SnapshotRequired("Cross-currency financial operations require a ConversionResult.")
                signed = cls.money(amount)
                return {
                    "exchange_rate_quote_id": None,
                    "exchange_rate_side": "NONE",
                    "source_amount": abs(signed),
                    "source_currency": wallet.currency,
                    "target_amount": abs(signed),
                    "target_currency": wallet.currency,
                    "rounding_mode": "MONEY_QUANTUM_8_HALF_UP",
                    "operation_context": operation_context or {},
                    "amount_usd": signed if wallet.currency == "USD" else None,
                    "amount_syp": signed if wallet.currency == "SYP" else None,
                    "exchange_rate_used": None,
                }
            return {}
        if not isinstance(conversion_result, ConversionResult):
            raise SnapshotRequired("FinanceService requires a validated ConversionResult.")
        source = str(conversion_result.source_currency).upper()
        target = str(conversion_result.target_currency).upper()
        if source not in SUPPORTED_CURRENCIES or target not in SUPPORTED_CURRENCIES:
            raise SnapshotRequired("Conversion currencies are not supported.")
        if source != target and not conversion_result.quote_id:
            raise SnapshotRequired("Cross-currency operations require a quote snapshot.")
        if source == target:
            if conversion_result.rate_side.value != "NONE" or conversion_result.quote_id:
                raise SnapshotRequired("Same-currency operations require NONE and no quote.")
            if wallet.currency != source or cls.money(conversion_result.source_amount) != abs(cls.money(amount)):
                raise SnapshotRequired("Conversion snapshot does not match the affected wallet.")
        else:
            expected = conversion_result.source_amount if wallet.currency == source else conversion_result.target_amount if wallet.currency == target else None
            if expected is None or cls.money(expected) != abs(cls.money(amount)):
                raise SnapshotRequired("Conversion snapshot does not match the affected wallet amount.")
        sign = Decimal("-1") if amount < 0 else Decimal("1")
        usd_value = conversion_result.source_amount if source == "USD" else conversion_result.target_amount if target == "USD" else None
        syp_value = conversion_result.source_amount if source == "SYP" else conversion_result.target_amount if target == "SYP" else None
        return {
            "exchange_rate_quote_id": conversion_result.quote_id,
            "exchange_rate_side": conversion_result.rate_side.value,
            "source_amount": cls.money(conversion_result.source_amount),
            "source_currency": source,
            "target_amount": cls.money(conversion_result.target_amount),
            "target_currency": target,
            "rounding_mode": conversion_result.rounding_policy,
            "operation_context": {
                "operation_type": conversion_result.operation_type,
                **(operation_context or {}),
            },
            "amount_usd": None if usd_value is None else cls.money(sign * usd_value),
            "amount_syp": None if syp_value is None else cls.money(sign * syp_value),
            "exchange_rate_used": conversion_result.rate_used,
        }

    @classmethod
    def _assert_snapshot_matches(cls, tx, conversion_result):
        if tx.exchange_rate_quote_id != conversion_result.quote_id or tx.exchange_rate_side != conversion_result.rate_side.value:
            raise SnapshotRequired("Idempotent retry cannot change the original FX snapshot.")

    @staticmethod
    def _snapshot(tx: Transaction, wallet: Wallet) -> None:
        if tx.balance_after != wallet.available_balance:
            tx.balance_after = wallet.available_balance
            tx.save(update_fields=["balance_after", "updated_at"])

    @staticmethod
    def _audit(tx: Transaction, action: str, actor=None, reason="") -> None:
        try:
            from system.models import AuditLog
            AuditLog.objects.create(
                user=tx.user,
                action_type=action,
                details={
                    "transaction_id": tx.id,
                    "amount": str(tx.amount),
                    "type": tx.transaction_type,
                    "actor": getattr(actor, "name", None),
                    "reason": reason,
                },
            )
        except Exception:
            # Audit logging must not make a successful money mutation partial.
            pass

    @classmethod
    @db_transaction.atomic
    def reconcile_wallet(cls, wallet_id: int) -> dict:
        wallet = cls._wallet_for_update(wallet_id)
        pending = Transaction.objects.filter(wallet_id=wallet_id, status="pending")
        approved = Transaction.objects.filter(wallet_id=wallet_id, status="approved")
        pending_total = sum((abs(tx.amount) for tx in pending), Decimal("0"))
        approved_net = sum((tx.amount for tx in approved), Decimal("0"))
        return {
            "wallet_id": wallet.id,
            "available_balance": cls.money(wallet.available_balance),
            "pending_balance": cls.money(wallet.pending_balance),
            "ledger_approved_net": cls.money(approved_net),
            "ledger_pending": cls.money(pending_total),
            "matches_pending": cls.money(wallet.pending_balance) == cls.money(pending_total),
        }

    @classmethod
    @db_transaction.atomic
    def deposit(cls, *, wallet_id: int, amount, note="Deposit", transaction_type="deposit", idempotency_key=None, conversion_result=None, **kwargs):
        wallet = cls._wallet_for_update(wallet_id)
        amount = cls.money(amount)
        return cls._create_pending(
            wallet=wallet,
            amount=amount,
            transaction_type=transaction_type,
            note=note,
            idempotency_key=idempotency_key,
            conversion_result=conversion_result,
            **kwargs,
        )

    @classmethod
    @db_transaction.atomic
    def withdraw(cls, *, wallet_id: int, amount, note="Withdrawal", transaction_type="withdrawal", idempotency_key=None, allow_overdraft=False, overdraft_limit=None, conversion_result=None, **kwargs):
        wallet = cls._wallet_for_update(wallet_id)
        amount = cls.money(amount)
        if amount <= 0:
            raise FinanceError("Amount must be greater than zero")
        return cls._create_pending(
            wallet=wallet,
            amount=-amount,
            transaction_type=transaction_type,
            note=note,
            idempotency_key=idempotency_key,
            allow_overdraft=allow_overdraft,
            overdraft_limit=overdraft_limit,
            conversion_result=conversion_result,
            **kwargs,
        )

    @classmethod
    @db_transaction.atomic
    def approve(cls, transaction_id: int, *, admin_user=None) -> Transaction:
        tx = Transaction.objects.select_for_update().select_related("wallet").get(pk=transaction_id)
        wallet = cls._wallet_for_update(tx.wallet_id)
        if tx.status != "pending":
            if tx.status == "approved":
                return tx
            raise InvalidFinancialTransition("Only pending transactions can be approved")
        if tx.amount > 0:
            wallet.pending_balance = cls.money(wallet.pending_balance - tx.amount)
            wallet.available_balance = cls.money(wallet.available_balance + tx.amount)
        else:
            wallet.pending_balance = cls.money(wallet.pending_balance - abs(tx.amount))
        wallet.save(update_fields=["available_balance", "pending_balance", "updated_at"])
        tx.status = "approved"
        tx.processed_at = timezone.now()
        tx.balance_after = wallet.available_balance
        tx.save(update_fields=["status", "processed_at", "balance_after", "updated_at"])
        cls._audit(tx, "transaction_approved", admin_user)
        return tx

    @classmethod
    @db_transaction.atomic
    def reject(cls, transaction_id: int, *, admin_user=None, reason="") -> Transaction:
        tx = Transaction.objects.select_for_update().select_related("wallet").get(pk=transaction_id)
        wallet = cls._wallet_for_update(tx.wallet_id)
        if tx.status != "pending":
            if tx.status in {"rejected", "failed", "cancelled"}:
                return tx
            raise InvalidFinancialTransition("Only pending transactions can be rejected")
        if tx.amount > 0:
            wallet.pending_balance = cls.money(wallet.pending_balance - tx.amount)
        else:
            wallet.pending_balance = cls.money(wallet.pending_balance - abs(tx.amount))
            wallet.available_balance = cls.money(wallet.available_balance - tx.amount)
        wallet.save(update_fields=["available_balance", "pending_balance", "updated_at"])
        tx.status = "rejected"
        tx.processed_at = timezone.now()
        if reason:
            tx.note = f"{tx.note or ''} | Rejected: {reason}"
        tx.balance_after = wallet.available_balance
        tx.save(update_fields=["status", "processed_at", "note", "balance_after", "updated_at"])
        cls._audit(tx, "transaction_rejected", admin_user, reason)
        return tx

    @classmethod
    @db_transaction.atomic
    def transfer(cls, *, sender_wallet_id: int, recipient_wallet_id: int, amount, note="Transfer", idempotency_key=None, allow_overdraft=False, overdraft_limit=None):
        existing = cls._existing_idempotent(idempotency_key)
        if existing:
            return existing
        ids = sorted({sender_wallet_id, recipient_wallet_id})
        if len(ids) != 2:
            raise FinanceError("Transfer requires two distinct wallets")
        locked = {wallet.id: wallet for wallet in Wallet.objects.select_for_update().filter(id__in=ids)}
        sender = locked.get(sender_wallet_id)
        recipient = locked.get(recipient_wallet_id)
        if not sender or not recipient:
            raise FinanceError("Transfer wallet not found")
        amount = cls.money(amount)
        if amount <= 0:
            raise FinanceError("Amount must be greater than zero")
        if sender.currency != recipient.currency:
            raise FinanceError("Transfer wallets must use the same currency")
        debit = cls._create_pending(wallet=sender, amount=-amount, transaction_type="transfer", note=note, idempotency_key=f"{idempotency_key}:debit" if idempotency_key else None, recipient_wallet=recipient, recipient_id=recipient.user_id, allow_overdraft=allow_overdraft, overdraft_limit=overdraft_limit)
        credit = cls._create_pending(wallet=recipient, amount=amount, transaction_type="transfer", note=note, idempotency_key=f"{idempotency_key}:credit" if idempotency_key else None, related_transaction=debit, recipient_id=None)
        debit.related_transaction = credit
        debit.save(update_fields=["related_transaction", "updated_at"])
        cls.approve(debit.id)
        cls.approve(credit.id)
        return debit

    @classmethod
    @db_transaction.atomic
    def refund(cls, *, transaction_id: int, reason="", idempotency_key=None):
        original = Transaction.objects.select_for_update().get(pk=transaction_id)
        if original.status != "approved" or original.amount >= 0:
            raise InvalidFinancialTransition("Only approved outgoing transactions can be refunded")
        existing = cls._existing_idempotent(idempotency_key)
        if existing:
            return existing
        snapshot = cls._refund_snapshot(original)
        return cls._create_pending(
            wallet=cls._wallet_for_update(original.wallet_id),
            amount=abs(original.amount),
            transaction_type="refund",
            note=f"Refund for TX#{original.id}. Reason: {reason}",
            idempotency_key=idempotency_key,
            related_transaction=original,
            snapshot_override=snapshot,
        )

    @classmethod
    def _refund_snapshot(cls, original: Transaction) -> dict:
        """Reverse an approved debit using the immutable original snapshot."""
        snapshot_fields = (
            original.exchange_rate_side,
            original.source_amount,
            original.source_currency,
            original.target_amount,
            original.target_currency,
            original.rounding_mode,
        )
        if any(value is not None for value in snapshot_fields) and not all(value is not None for value in snapshot_fields):
            raise RefundSnapshotIncomplete(
                "The original transaction has an incomplete FX snapshot."
            )
        if all(value is not None for value in snapshot_fields):
            return {
                "exchange_rate_quote_id": original.exchange_rate_quote_id,
                "exchange_rate_side": original.exchange_rate_side,
                "source_amount": original.source_amount,
                "source_currency": original.source_currency,
                "target_amount": original.target_amount,
                "target_currency": original.target_currency,
                "rounding_mode": original.rounding_mode,
                "operation_context": {
                    **(original.operation_context or {}),
                    "refund_of_transaction_id": original.id,
                },
                "amount_usd": None if original.amount_usd is None else abs(original.amount_usd),
                "amount_syp": None if original.amount_syp is None else abs(original.amount_syp),
                "exchange_rate_used": original.exchange_rate_used,
            }

        # Legacy rows predate snapshots. Preserve their stored equivalents and
        # never reconstruct them from today's quote or the historical 116 fallback.
        amount = abs(original.amount)
        return {
            "exchange_rate_quote_id": None,
            "exchange_rate_side": "NONE",
            "source_amount": amount,
            "source_currency": original.currency,
            "target_amount": amount,
            "target_currency": original.currency,
            "rounding_mode": "MONEY_QUANTUM_8_HALF_UP",
            "operation_context": {"legacy_snapshot": True, "refund_of_transaction_id": original.id},
            "amount_usd": None if original.amount_usd is None else abs(original.amount_usd),
            "amount_syp": None if original.amount_syp is None else abs(original.amount_syp),
            "exchange_rate_used": original.exchange_rate_used,
        }

    @classmethod
    @db_transaction.atomic
    def cancel(cls, transaction_id: int, reason="") -> Transaction:
        """Cancel a pending event or compensate an already approved event."""
        tx = Transaction.objects.select_for_update().get(pk=transaction_id)
        if tx.status == "cancelled":
            return tx
        if tx.status == "pending":
            return cls.reject(transaction_id, reason=reason)
        if tx.status != "approved":
            raise InvalidFinancialTransition("Transaction cannot be cancelled")
        if tx.amount < 0:
            compensation = cls.refund(
                transaction_id=tx.id,
                reason=f"Cancellation: {reason}",
                idempotency_key=f"cancel-refund:{tx.id}",
            )
        else:
            compensation = cls.withdraw(
                wallet_id=tx.wallet_id,
                amount=tx.amount,
                transaction_type="refund",
                note=f"Cancellation of TX#{tx.id}: {reason}",
                idempotency_key=f"cancel-refund:{tx.id}",
            )
        cls.approve(compensation.id)
        if tx.transaction_type == "purchase":
            from agents.services.commission_service import reverse_commission_for_purchase
            reverse_commission_for_purchase(tx, reason=f"Cancellation: {reason}")
        tx.status = "cancelled"
        tx.note = f"{tx.note or ''} | Cancelled: {reason}" if reason else tx.note
        tx.save(update_fields=["status", "note", "updated_at"])
        return tx
