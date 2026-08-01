from decimal import Decimal
from threading import Barrier, Thread
from unittest import skipUnless
from unittest.mock import patch

from django.db import close_old_connections, connection
from django.test import TestCase, TransactionTestCase

from finance.services import FinanceError, FinanceService, InsufficientFunds
from users.models import User
from wallets.models import Wallet
from transactions.models import Transaction
from pathlib import Path
import re


class FinanceCharacterizationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            name="finance-user",
            full_name="Finance User",
            email="finance@example.com",
            password="Password-9!",
        )
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.wallet.available_balance = Decimal("100.00")
        self.wallet.save(update_fields=["available_balance"])

    def test_deposit_is_pending_until_approval(self):
        tx = FinanceService.deposit(wallet_id=self.wallet.id, amount="25", idempotency_key="deposit-1")
        self.wallet.refresh_from_db()
        self.assertEqual(tx.status, "pending")
        self.assertEqual(tx.balance_before, Decimal("100.00000000"))
        self.assertEqual(tx.balance_after, Decimal("100.00000000"))
        self.assertEqual(self.wallet.available_balance, Decimal("100.00000000"))
        self.assertEqual(self.wallet.pending_balance, Decimal("25.00000000"))

        FinanceService.approve(tx.id)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, Decimal("125.00000000"))
        self.assertEqual(self.wallet.pending_balance, Decimal("0E-8"))

    def test_rejected_withdrawal_restores_available_balance(self):
        tx = FinanceService.withdraw(wallet_id=self.wallet.id, amount="40", idempotency_key="withdraw-1")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, Decimal("60.00000000"))
        self.assertEqual(self.wallet.pending_balance, Decimal("40.00000000"))

        FinanceService.reject(tx.id, reason="provider declined")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, Decimal("100.00000000"))
        self.assertEqual(self.wallet.pending_balance, Decimal("0E-8"))

    def test_duplicate_approval_has_no_second_balance_effect(self):
        tx = FinanceService.deposit(wallet_id=self.wallet.id, amount="10", idempotency_key="deposit-2")
        FinanceService.approve(tx.id)
        FinanceService.approve(tx.id)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, Decimal("110.00000000"))
        self.assertEqual(Transaction.objects.filter(id=tx.id).count(), 1)

    def test_idempotency_key_does_not_create_duplicate_ledger_entry(self):
        first = FinanceService.deposit(wallet_id=self.wallet.id, amount="7.123456789", idempotency_key="same-key")
        second = FinanceService.deposit(wallet_id=self.wallet.id, amount="7.123456789", idempotency_key="same-key")
        self.assertEqual(first.id, second.id)
        self.assertEqual(Transaction.objects.filter(idempotency_key="same-key").count(), 1)

    def test_transfer_rolls_back_both_sides_on_partial_failure(self):
        recipient = User.objects.create_user(
            name="recipient", full_name="Recipient", email="recipient@example.com", password="Password-9!"
        )
        recipient_wallet = Wallet.objects.get(user=recipient, currency="USD")
        original_approve = FinanceService.approve

        def approve_then_fail(transaction_id, **kwargs):
            if transaction_id:
                if approve_then_fail.called:
                    raise RuntimeError("simulated approval failure")
                approve_then_fail.called = True
                return original_approve(transaction_id, **kwargs)

        approve_then_fail.called = False
        with patch.object(FinanceService, "approve", side_effect=approve_then_fail):
            with self.assertRaises(RuntimeError):
                FinanceService.transfer(
                    sender_wallet_id=self.wallet.id,
                    recipient_wallet_id=recipient_wallet.id,
                    amount="20",
                    idempotency_key="transfer-rollback",
                )
        self.wallet.refresh_from_db()
        recipient_wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, Decimal("100.00000000"))
        self.assertEqual(recipient_wallet.available_balance, Decimal("0E-8"))
        self.assertFalse(Transaction.objects.filter(idempotency_key__startswith="transfer-rollback").exists())


@skipUnless(connection.vendor == "postgresql", "PostgreSQL row-lock concurrency coverage")
class FinanceConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def test_concurrent_withdrawals_cannot_overdraw_wallet(self):
        user = User.objects.create_user(
            name="concurrency-user", full_name="Concurrency User", email="concurrency@example.com", password="Password-9!"
        )
        wallet = Wallet.objects.get(user=user, currency="USD")
        wallet.available_balance = Decimal("100.00")
        wallet.save(update_fields=["available_balance"])
        barrier = Barrier(2)
        results = []

        def withdraw(key):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                FinanceService.withdraw(wallet_id=wallet.id, amount="80", idempotency_key=key)
                results.append("ok")
            except InsufficientFunds:
                results.append("insufficient")
            finally:
                close_old_connections()

        threads = [Thread(target=withdraw, args=(f"concurrent-{i}",)) for i in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        self.assertCountEqual(results, ["ok", "insufficient"])
        wallet.refresh_from_db()
        self.assertEqual(wallet.available_balance, Decimal("20.00000000"))


class FinanceArchitectureTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            name="reconcile-user", full_name="Reconcile User",
            email="reconcile@example.com", password="Password-9!",
        )

    def test_production_money_writes_use_finance_service(self):
        root = Path(__file__).resolve().parents[1]
        findings = []
        patterns = [
            re.compile(r"\bTransaction\.objects\.create"),
            re.compile(r"(?:available_balance|pending_balance)\s*[+\-]=|\.balance\s*[+\-]=\s*amount"),
        ]
        excluded_names = {"finance", "migrations", "management", "tests", "test_purchase_flow.py"}
        for path in root.rglob("*.py"):
            rel = path.relative_to(root).as_posix()
            if any(part in excluded_names for part in path.parts) or path.name.startswith("test") or rel == "wallets/models.py":
                continue
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if any(pattern.search(line) for pattern in patterns):
                    findings.append(f"{rel}:{number}: {line.strip()}")
        self.assertEqual([], findings, "Unauthorized financial writes found:\n" + "\n".join(findings))

    def test_wallet_reconciliation_after_finance_operations(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        wallet.available_balance = Decimal("100")
        wallet.pending_balance = Decimal("0")
        wallet.save(update_fields=["available_balance", "pending_balance"])
        tx = FinanceService.withdraw(wallet_id=wallet.id, amount="25", idempotency_key="reconcile-withdraw")
        self.assertTrue(FinanceService.reconcile_wallet(wallet.id)["matches_pending"])
        FinanceService.approve(tx.id)
        self.assertTrue(FinanceService.reconcile_wallet(wallet.id)["matches_pending"])
