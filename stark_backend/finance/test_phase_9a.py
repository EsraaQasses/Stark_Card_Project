from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from finance.reporting import FinancialReportService
from transactions.models import Transaction
from users.models import User
from wallets.models import Wallet


class DashboardReportQueryOptimizationTests(TestCase):
    """PostgreSQL query-count and accounting compatibility checks."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            name="phase9a-report-admin", email="phase9a-report@example.com", password="Password-9!"
        )
        self.user = User.objects.create_user(
            name="phase9a-report-user", email="phase9a-user@example.com", password="Password-9!"
        )
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.zone = ZoneInfo(getattr(settings, "TIME_ZONE", "UTC"))

    def _create_transactions(self, count, start=0):
        created = []
        for index in range(start, start + count):
            created.append(Transaction.objects.create(
                user=self.user,
                wallet=self.wallet,
                currency="USD",
                transaction_type="purchase",
                amount=Decimal("10.00"),
                status="approved",
                idempotency_key=f"phase9a-report-{index}",
                operation_context={
                    "correlation_id": f"phase9a-correlation-{index}",
                    "provider_cost_amount": "6.00",
                    "provider_cost_currency": "USD",
                },
                created_at=datetime(2026, 8, 1, 12, 0, tzinfo=self.zone),
            ))
        Transaction.objects.filter(id__in=[tx.id for tx in created]).update(
            created_at=datetime(2026, 8, 1, 12, 0, tzinfo=self.zone)
        )

    def test_report_queries_do_not_grow_with_transaction_volume(self):
        self._create_transactions(1)
        with CaptureQueriesContext(connection) as one_queries:
            one_report = FinancialReportService.build(period="daily", anchor="2026-08-01")

        self._create_transactions(9, start=1)
        with CaptureQueriesContext(connection) as many_queries:
            many_report = FinancialReportService.build(period="daily", anchor="2026-08-01")

        self.assertLessEqual(len(many_queries), len(one_queries) + 1)
        self.assertEqual(many_report["totals"]["revenue"]["USD"], "100.00000000")
        self.assertEqual(many_report["totals"]["provider_cost"]["USD"], "60.00000000")
        self.assertEqual(many_report["totals"]["gross_profit"]["USD"], "40.00000000")
        self.assertEqual(many_report["operation_count"], 10)
        self.assertEqual(one_report["source_of_truth"], "transactions")

    def test_dashboard_transaction_list_has_bounded_serializer_queries(self):
        self._create_transactions(1)
        with CaptureQueriesContext(connection) as one_queries:
            one_response = self.client.get("/api/dashboard/transactions/")

        self._create_transactions(9, start=1)
        with CaptureQueriesContext(connection) as many_queries:
            many_response = self.client.get("/api/dashboard/transactions/")

        self.assertEqual(one_response.status_code, 200)
        self.assertEqual(many_response.status_code, 200)
        self.assertLessEqual(len(many_queries), len(one_queries) + 1)

    def test_status_and_refund_categories_are_grouped_once_per_currency(self):
        base = {
            "user": self.user,
            "wallet": self.wallet,
            "currency": "USD",
        }
        Transaction.objects.create(
            **base, transaction_type="refund", amount=Decimal("3"), status="approved",
            idempotency_key="r1",
        )
        Transaction.objects.create(
            **base, transaction_type="refund", amount=Decimal("2"), status="approved",
            idempotency_key="r2",
            operation_context={"commission_reversal_of": "phase9a-commission"},
        )
        Transaction.objects.create(
            **base, transaction_type="deposit", amount=Decimal("4"), status="pending",
            idempotency_key="phase9a-pending",
        )
        Transaction.objects.create(
            **base, transaction_type="withdrawal", amount=Decimal("5"), status="failed",
            idempotency_key="phase9a-failed",
        )

        report = FinancialReportService.build(period="daily")
        self.assertEqual(report["totals"]["refunds"]["USD"], "3.00000000")
        self.assertEqual(report["totals"]["commission_reversals"]["USD"], "2.00000000")
        self.assertEqual(report["status_totals"]["pending"]["USD"], "4.00000000")
        self.assertEqual(report["status_totals"]["failed_rejected"]["USD"], "5.00000000")
