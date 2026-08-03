from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from transactions.models import Transaction
from users.models import User
from wallets.models import Wallet


class TransactionReadQueryOptimizationTests(TestCase):
    """PostgreSQL query-count coverage for transaction and wallet histories."""

    def setUp(self):
        self.user = User.objects.create_user(
            name="phase9a-history-user", email="phase9a-history@example.com", password="Password-9!"
        )
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _create_transactions(self, count, start=0):
        source = Transaction.objects.create(
            user=self.user,
            wallet=self.wallet,
            currency="USD",
            transaction_type="purchase",
            amount=Decimal("10.00"),
            status="approved",
            idempotency_key=f"phase9a-source-{start}",
            note="Purchase: source product",
        )
        for index in range(start, start + count):
            Transaction.objects.create(
                user=self.user,
                wallet=self.wallet,
                currency="USD",
                transaction_type="commission",
                amount=Decimal("1.00"),
                status="approved",
                idempotency_key=f"phase9a-commission-{index}",
                note=f"commission order {source.id}",
            )

    def test_general_transaction_history_has_bounded_serializer_queries(self):
        self._create_transactions(1)
        with CaptureQueriesContext(connection) as one_queries:
            one_response = self.client.get("/api/transactions/transactions/")

        self._create_transactions(9, start=1)
        with CaptureQueriesContext(connection) as many_queries:
            many_response = self.client.get("/api/transactions/transactions/")

        self.assertEqual(one_response.status_code, 200)
        self.assertEqual(many_response.status_code, 200)
        self.assertLessEqual(len(many_queries), len(one_queries) + 2)

    def test_wallet_transaction_history_contract_and_query_count_are_bounded(self):
        self._create_transactions(1)
        with CaptureQueriesContext(connection) as one_queries:
            one_response = self.client.get("/api/wallets/wallet/transactions/?limit=100")

        self._create_transactions(9, start=1)
        with CaptureQueriesContext(connection) as many_queries:
            many_response = self.client.get("/api/wallets/wallet/transactions/?limit=100")

        self.assertEqual(one_response.status_code, 200)
        self.assertEqual(many_response.status_code, 200)
        self.assertLessEqual(len(many_queries), len(one_queries) + 1)
        self.assertEqual(set(many_response.data), {"transactions", "pagination"})
        self.assertEqual(many_response.data["pagination"]["total"], 12)
