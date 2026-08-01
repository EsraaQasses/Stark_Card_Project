from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from finance.conversion import (
    ConversionError,
    ConversionResult,
    CurrencyConversionService,
    RateSide,
    RateSideInvalid,
)
from finance.services import FinanceService, RefundSnapshotIncomplete, SnapshotRequired
from transactions.models import Transaction
from users.models import User
from wallets.models import ExchangeRateQuote, Wallet
from wallets.rate_quotes import ExchangeRateQuoteService


class ConversionSnapshotTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            name="fx-admin", email="fx-admin@example.com", password="Password-9!"
        )
        self.quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin,
            activation_note="Phase 1.2C test quote",
        )
        self.user = User.objects.create_user(
            name="fx-user", email="fx-user@example.com", password="Password-9!"
        )

    def test_same_currency_is_identity_and_immutable(self):
        result = CurrencyConversionService.convert(
            amount="12.345678899", source_currency="USD", target_currency="USD",
            rate_side=RateSide.NONE, operation_type="deposit",
        )
        self.assertEqual(result.target_amount, Decimal("12.34567890"))
        self.assertIsNone(result.quote_id)
        with self.assertRaises(AttributeError):
            result.target_amount = Decimal("1")

    def test_cross_currency_uses_quote_and_decimal_rounding(self):
        result = CurrencyConversionService.convert(
            amount="1.25", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_BUYS_BASE, operation_type="deposit_syp_to_usd",
            quote=self.quote,
        )
        self.assertEqual(result.target_amount, Decimal("12500.00000000"))
        self.assertEqual(result.quote_id, self.quote.id)
        self.assertEqual(result.rate_used, Decimal("10000.000000"))

    def test_both_directional_formulas_are_quote_bound(self):
        usd_to_syp = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_SELLS_BASE, operation_type="usd_product_paid_syp",
            quote=self.quote,
        )
        syp_to_usd = CurrencyConversionService.convert(
            amount="25000", source_currency="SYP", target_currency="USD",
            rate_side=RateSide.PLATFORM_SELLS_BASE, operation_type="cashout_usd_to_syp",
            quote=self.quote,
        )
        self.assertEqual(usd_to_syp.target_amount, Decimal("20000.00000000"))
        self.assertEqual(syp_to_usd.target_amount, Decimal("2.50000000"))

    def test_cross_currency_requires_explicit_side_and_active_quote(self):
        with self.assertRaises(RateSideInvalid):
            CurrencyConversionService.convert(
                amount="1", source_currency="USD", target_currency="SYP",
                rate_side=RateSide.NONE, operation_type="deposit_syp_to_usd",
                quote=self.quote,
            )
        ExchangeRateQuote.objects.filter(pk=self.quote.pk).update(status=ExchangeRateQuote.STATUS_SUPERSEDED)
        with self.assertRaises(ConversionError) as raised:
            CurrencyConversionService.convert(
                amount="1", source_currency="USD", target_currency="SYP",
                rate_side=RateSide.PLATFORM_BUYS_BASE, operation_type="deposit_syp_to_usd",
            )
        self.assertEqual(raised.exception.code, "FX_RATE_UNAVAILABLE")

    def test_finance_service_persists_snapshot_and_refund_reuses_it(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        wallet.available_balance = Decimal("100")
        wallet.save(update_fields=["available_balance"])
        result = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_BUYS_BASE, operation_type="usd_product_paid_syp",
            quote=self.quote,
        )
        tx = FinanceService.withdraw(
            wallet_id=wallet.id, amount="2", transaction_type="purchase",
            idempotency_key="fx-purchase", conversion_result=result,
        )
        FinanceService.approve(tx.id)
        self.assertEqual(tx.exchange_rate_quote_id, self.quote.id)
        self.assertEqual(tx.source_currency, "USD")
        self.assertEqual(tx.target_currency, "SYP")
        self.assertEqual(tx.target_amount, Decimal("20000.00000000"))

        replacement = ExchangeRateQuoteService.activate_quote(
            buy_rate="12000", sell_rate="12000", actor=self.admin,
            activation_note="Replacement test quote",
        )
        refund = FinanceService.refund(
            transaction_id=tx.id, idempotency_key="fx-refund",
        )
        self.assertEqual(refund.exchange_rate_quote_id, self.quote.id)
        self.assertEqual(refund.exchange_rate_side, tx.exchange_rate_side)
        self.assertEqual(refund.source_amount, tx.source_amount)
        self.assertEqual(refund.target_amount, tx.target_amount)
        self.assertNotEqual(replacement.id, refund.exchange_rate_quote_id)

    def test_snapshot_must_match_affected_wallet(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        result = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_BUYS_BASE, operation_type="usd_product_paid_syp",
            quote=self.quote,
        )
        with self.assertRaises(SnapshotRequired):
            FinanceService.withdraw(
                wallet_id=wallet.id, amount="3", conversion_result=result,
                idempotency_key="bad-snapshot",
            )

    def test_idempotent_retry_cannot_replace_snapshot(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        wallet.available_balance = Decimal("10")
        wallet.save(update_fields=["available_balance"])
        first = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_BUYS_BASE, operation_type="usd_product_paid_syp",
            quote=self.quote,
        )
        second = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_SELLS_BASE, operation_type="usd_product_paid_syp",
            quote=self.quote,
        )
        FinanceService.withdraw(wallet_id=wallet.id, amount="2", conversion_result=first, idempotency_key="retry-snapshot")
        with self.assertRaises(SnapshotRequired):
            FinanceService.withdraw(wallet_id=wallet.id, amount="2", conversion_result=second, idempotency_key="retry-snapshot")

    def test_legacy_refund_preserves_stored_values_without_quote(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        wallet.available_balance = Decimal("20")
        wallet.save(update_fields=["available_balance"])
        tx = FinanceService.withdraw(
            wallet_id=wallet.id, amount="5", transaction_type="purchase",
            idempotency_key="legacy-debit",
        )
        tx.amount_usd = Decimal("-5")
        tx.amount_syp = Decimal("-50000")
        tx.exchange_rate_used = Decimal("10000")
        tx.save(update_fields=["amount_usd", "amount_syp", "exchange_rate_used"])
        FinanceService.approve(tx.id)
        refund = FinanceService.refund(transaction_id=tx.id, idempotency_key="legacy-refund")
        self.assertEqual(refund.exchange_rate_side, "NONE")
        self.assertEqual(refund.amount_syp, Decimal("50000.00000000"))
        self.assertEqual(refund.exchange_rate_used, Decimal("10000.000000"))

    def test_partial_snapshot_cannot_be_refunded(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        wallet.available_balance = Decimal("20")
        wallet.save(update_fields=["available_balance"])
        tx = FinanceService.withdraw(
            wallet_id=wallet.id, amount="5", transaction_type="purchase",
            idempotency_key="partial-debit",
        )
        tx.exchange_rate_side = "PLATFORM_BUYS_BASE"
        tx.source_currency = "USD"
        tx.save(update_fields=["exchange_rate_side", "source_currency"])
        FinanceService.approve(tx.id)
        with self.assertRaises(RefundSnapshotIncomplete):
            FinanceService.refund(transaction_id=tx.id, idempotency_key="partial-refund")

    def test_approved_snapshot_is_immutable(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        wallet.available_balance = Decimal("20")
        wallet.save(update_fields=["available_balance"])
        result = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="USD",
            rate_side=RateSide.NONE, operation_type="purchase",
        )
        tx = FinanceService.withdraw(wallet_id=wallet.id, amount="2", transaction_type="purchase", conversion_result=result)
        FinanceService.approve(tx.id)
        tx.refresh_from_db()
        tx.target_amount = Decimal("3")
        with self.assertRaises(ValidationError):
            tx.save(update_fields=["target_amount"])

    def test_snapshot_schema_is_nullable_for_historical_rows(self):
        legacy = Transaction.objects.create(
            user=self.user, wallet=Wallet.objects.get(user=self.user, currency="USD"),
            currency="USD", transaction_type="deposit", amount=Decimal("1"),
        )
        legacy.refresh_from_db()
        self.assertIsNone(legacy.exchange_rate_quote_id)
        self.assertIsNone(legacy.source_currency)
        self.assertIsNone(legacy.target_currency)


class ConversionArchitectureTests(TestCase):
    def test_canonical_finance_modules_do_not_use_legacy_fallbacks(self):
        root = __import__("pathlib").Path(__file__).resolve().parent
        forbidden = ("ExchangeService", "ExchangeRate.objects", "Decimal('116')", 'Decimal("116")')
        findings = []
        for filename in ("conversion.py", "services.py"):
            path = root / filename
            for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if any(token in line for token in forbidden) or __import__("re").search(r"\busd_to_syp\b", line):
                    findings.append(f"{filename}:{line_no}: {line.strip()}")
        self.assertEqual([], findings, "Legacy FX usage in canonical finance modules:\n" + "\n".join(findings))
