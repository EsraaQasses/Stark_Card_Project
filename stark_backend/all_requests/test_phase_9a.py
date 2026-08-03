from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from all_requests.models import Request
from shipping.models import AgentAdminShippingRequest, AgentShippingRequest, StandardShippingRequest
from transactions.models import Transaction
from users.models import User
from wallets.models import Wallet


class RequestShippingReadQueryOptimizationTests(TestCase):
    """PostgreSQL query-count coverage for scoped request/shipping reads."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            name="phase9a-request-admin", email="phase9a-request@example.com", password="Password-9!"
        )
        self.customer = User.objects.create_user(
            name="phase9a-request-user", email="phase9a-user@example.com", password="Password-9!"
        )
        self.agent = User.objects.create_user(
            name="phase9a-request-agent", email="phase9a-agent@example.com", password="Password-9!", role="agent"
        )
        self.customer.agent = self.agent
        self.customer.save(update_fields=["agent"])
        self.wallet = Wallet.objects.get(user=self.customer, currency="USD")
        self.client.force_authenticate(self.admin)

    def _create_rows(self, count, start=0):
        for index in range(start, start + count):
            Request.objects.create(
                user=self.customer,
                request_type="payment",
                status="pending",
                title=f"Request {index}",
                amount=Decimal("10.00"),
                currency="USD",
                user_input_data={"provider": "phase9a"},
            )
            StandardShippingRequest.objects.create(
                user=self.customer, amount=Decimal("10.00"), currency="USD", wallet_currency="USD",
                status="pending", user_input_data={"provider": "phase9a"},
            )
            AgentShippingRequest.objects.create(
                user=self.customer, agent=self.agent, amount=Decimal("10.00"), currency="USD", wallet_currency="USD",
                status="pending", user_input_data={"provider": "phase9a"},
            )
            AgentAdminShippingRequest.objects.create(
                agent=self.agent, amount=Decimal("10.00"), currency="USD", wallet_currency="USD",
                status="pending", user_input_data={"provider": "phase9a"},
            )
            Transaction.objects.create(
                user=self.customer, wallet=self.wallet, recipient=self.agent, currency="USD",
                transaction_type="cashout", amount=Decimal("-1.00"), status="pending",
                idempotency_key=f"phase9a-cashout-{index}", operation_context={"provider": "phase9a"},
            )

    def _measure(self, path):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(path, {"page_size": 100})
        self.assertEqual(response.status_code, 200, path)
        return len(queries)

    def test_request_shipping_and_cashout_queries_are_bounded(self):
        paths = (
            "/api/all_requests/admin/requests/",
            "/api/shipping/standard/",
            "/api/shipping/via-agent/",
            "/api/shipping/agent-admin/",
            "/api/agents/admin/cashout/",
        )
        self._create_rows(1)
        small = {path: self._measure(path) for path in paths}
        self._create_rows(5, start=1)
        large = {path: self._measure(path) for path in paths}

        for path in paths:
            self.assertLessEqual(large[path], small[path] + 2, path)
