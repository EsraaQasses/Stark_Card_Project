from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.test import TestCase

from finance.conversion import CurrencyConversionService, RateSide
from finance.reporting import FinancialReportService, ReportPeriodError
from finance.services import FinanceService
from wallets.rate_quotes import ExchangeRateQuoteService
from pathlib import Path
from transactions.models import Transaction
from users.models import User
from wallets.models import Wallet


class SnapshotFinancialReportTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            name="report-admin", email="report-admin@example.com", password="Password-9!"
        )
        self.user = User.objects.create_user(
            name="report-user", email="report-user@example.com", password="Password-9!"
        )
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.wallet.available_balance = Decimal("100")
        self.wallet.save(update_fields=["available_balance"])
        self.zone = ZoneInfo(getattr(settings, "TIME_ZONE", "UTC"))

    def _at(self, tx, value):
        Transaction.objects.filter(pk=tx.pk).update(created_at=value)
        tx.refresh_from_db()
        return tx

    def _same_currency(self, amount, key, transaction_type="purchase", context=None):
        result = CurrencyConversionService.convert(
            amount=amount, source_currency="USD", target_currency="USD",
            rate_side=RateSide.NONE, operation_type="report_test",
        )
        tx = FinanceService.withdraw(
            wallet_id=self.wallet.id, amount=amount, transaction_type=transaction_type,
            idempotency_key=key, conversion_result=result,
            operation_context=context or {},
        )
        return FinanceService.approve(tx.id)

    def test_daily_report_uses_transactions_once_and_separates_cost_and_profit(self):
        purchase = self._same_currency(
            "20", "report-purchase", context={
                "correlation_id": "purchase-correlation",
                "provider_cost_amount": "12",
                "provider_cost_currency": "USD",
            }
        )
        commission = FinanceService.deposit(
            wallet_id=self.wallet.id, amount="2", transaction_type="commission",
            idempotency_key="report-commission",
            conversion_result=CurrencyConversionService.convert(
                amount="2", source_currency="USD", target_currency="USD",
                rate_side=RateSide.NONE, operation_type="commission_same_currency",
            ),
        )
        FinanceService.approve(commission.id)
        self._at(purchase, datetime(2026, 8, 1, 10, 0, tzinfo=self.zone))
        self._at(commission, datetime(2026, 8, 1, 11, 0, tzinfo=self.zone))
        report = FinancialReportService.build(period="daily", anchor="2026-08-01")
        self.assertEqual(report["source_of_truth"], "transactions")
        self.assertEqual(report["totals"]["revenue"]["USD"], "20.00000000")
        self.assertEqual(report["totals"]["provider_cost"]["USD"], "12.00000000")
        self.assertEqual(report["totals"]["gross_profit"]["USD"], "8.00000000")
        self.assertEqual(report["totals"]["agent_commission"]["USD"], "2.00000000")
        self.assertEqual(report["totals"]["net_profit"]["USD"], "6.00000000")
        self.assertEqual(report["operation_count"], 2)

    def test_custom_range_is_inclusive_by_date_and_exclusive_at_next_midnight(self):
        tx = self._same_currency("10", "report-boundary")
        self._at(tx, datetime(2026, 8, 3, 23, 59, 59, tzinfo=self.zone))
        report = FinancialReportService.build(
            period="custom", start_date="2026-08-03", end_date="2026-08-03"
        )
        self.assertEqual(report["totals"]["revenue"]["USD"], "10.00000000")
        self.assertTrue(report["boundary"]["end_exclusive"].startswith("2026-08-04"))

    def test_invalid_custom_range_is_deterministic(self):
        with self.assertRaises(ReportPeriodError):
            FinancialReportService.build(
                period="custom", start_date="2026-08-04", end_date="2026-08-03"
            )

    def test_weekly_and_monthly_boundaries_use_local_midnight(self):
        weekly = FinancialReportService.boundaries(period="weekly", anchor="2026-08-05")
        monthly = FinancialReportService.boundaries(period="monthly", anchor="2026-08-05")
        self.assertTrue(weekly[0].isoformat().startswith("2026-08-03"))
        self.assertTrue(weekly[1].isoformat().startswith("2026-08-10"))
        self.assertTrue(monthly[0].isoformat().startswith("2026-08-01"))
        self.assertTrue(monthly[1].isoformat().startswith("2026-09-01"))

    def test_unequal_quote_preserves_consumer_specific_rate_sides(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10500", actor=self.admin,
            activation_note="Stage 3 spread verification",
        )
        shipping = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_BUYS_BASE,
            operation_type="shipping_submitted_usd_to_syp", quote=quote,
        )
        product = CurrencyConversionService.convert(
            amount="2", source_currency="USD", target_currency="SYP",
            rate_side=RateSide.PLATFORM_SELLS_BASE,
            operation_type="usd_product_paid_syp", quote=quote,
        )
        self.assertEqual(shipping.target_amount, Decimal("20000.00000000"))
        self.assertEqual(product.target_amount, Decimal("21000.00000000"))


class FinalFxArchitectureTests(TestCase):
    def test_legacy_rate_references_are_explicitly_allowlisted(self):
        root = Path(__file__).resolve().parents[1]
        active_paths = [
            root / "agents" / "services" / "commission_service.py",
            root / "agents" / "views.py",
            root / "payment" / "views.py",
            root / "transactions" / "services" / "purchase_service.py",
            root / "third_party_apis" / "services" / "api_service.py",
            root / "finance" / "reporting.py",
            root / "finance" / "views.py",
            root / "shipping" / "financial_service.py",
        ]
        for path in active_paths:
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("116", text, str(path))
            self.assertNotIn("ExchangeRate.objects", text, str(path))
            self.assertNotIn("Decimal('116')", text, str(path))
            self.assertNotIn("Decimal(\"116\")", text, str(path))
            self.assertNotIn("1 / rate", text, str(path))

        # Temporary compatibility allowlist: these are not transactional
        # consumers and must be removed in a later compatibility cleanup.
        allowlisted = {
            "shipping/management/commands/agent_shipping_flow_test.py": "manual smoke fixture",
            "wallets/views.py": "legacy display/API aliases",
            "wallets/services.py": "legacy display service",
            "store/services/currency_service.py": "unused legacy display adapter",
            "transactions/models.py": "historical-row save compatibility",
            "payment/models.py": "historical-row save compatibility",
            "transactions/views.py": "unreachable legacy summary adapter",
            "shipping/views.py": "unreachable legacy payment adapter",
        }
        for relative_path, reason in allowlisted.items():
            self.assertTrue((root / relative_path).exists(), reason)
