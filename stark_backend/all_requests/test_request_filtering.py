from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from all_requests.models import Request
from shipping.models import StandardShippingRequest, AgentShippingRequest, AgentAdminShippingRequest
from transactions.models import Transaction
from wallets.models import Wallet

User = get_user_model()


class RequestFilteringPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user("filter-customer", "Password-9!", email="customer@example.com")
        self.other_customer = User.objects.create_user("other-customer", "Password-9!", email="other@example.com")
        self.agent = User.objects.create_user("filter-agent", "Password-9!", email="agent@example.com", role="agent")
        self.other_agent = User.objects.create_user("other-agent", "Password-9!", email="other-agent@example.com", role="agent")
        self.admin = User.objects.create_superuser("filter-admin", "Password-9!", email="admin@example.com")
        self.customer.agent = self.agent
        self.customer.save(update_fields=["agent"])

        self.request_one = Request.objects.create(
            user=self.customer, request_type="payment", status="pending", title="Provider Alpha",
            description="alpha request", amount=Decimal("10.00"), currency="USD",
            user_input_data={"provider": "alpha"},
        )
        self.request_two = Request.objects.create(
            user=self.other_customer, request_type="support", status="completed", title="Provider Beta",
            description="beta request", amount=Decimal("25.00"), currency="SYP",
            user_input_data={"provider": "beta"},
        )
        Request.objects.filter(pk=self.request_one.pk).update(created_at=timezone.now() - timedelta(days=2))
        Request.objects.filter(pk=self.request_two.pk).update(created_at=timezone.now() - timedelta(days=1))

        self.standard = StandardShippingRequest.objects.create(
            user=self.customer, amount=Decimal("12.00"), currency="USD", wallet_currency="USD", status="pending",
            user_input_data={"provider": "alpha"},
        )
        self.other_standard = StandardShippingRequest.objects.create(
            user=self.other_customer, amount=Decimal("30.00"), currency="SYP", wallet_currency="SYP", status="approved",
            user_input_data={"provider": "beta"},
        )
        self.via_agent = AgentShippingRequest.objects.create(
            user=self.customer, agent=self.agent, amount=Decimal("15.00"), currency="USD", wallet_currency="USD",
            status="pending", user_input_data={"provider": "alpha"},
        )
        self.other_via_agent = AgentShippingRequest.objects.create(
            user=self.other_customer, agent=self.other_agent, amount=Decimal("16.00"), currency="USD", wallet_currency="USD",
            status="pending", user_input_data={"provider": "beta"},
        )
        self.agent_admin_shipping = AgentAdminShippingRequest.objects.create(
            agent=self.agent, amount=Decimal("18.00"), currency="USD", wallet_currency="USD", status="pending",
            user_input_data={"provider": "alpha"},
        )
        self.wallet = Wallet.objects.get(user=self.customer, currency="USD")
        self.cashout = Transaction.objects.create(
            user=self.customer, wallet=self.wallet, currency="USD", transaction_type="cashout",
            amount=Decimal("-5.00"), status="pending", note="alpha cashout", recipient=self.agent,
            operation_context={"provider": "alpha"},
        )
        self.other_cashout = Transaction.objects.create(
            user=self.other_customer, wallet=Wallet.objects.get(user=self.other_customer, currency="USD"),
            currency="USD", transaction_type="cashout", amount=Decimal("-6.00"), status="pending",
            note="beta cashout", recipient=self.other_agent, operation_context={"provider": "beta"},
        )

    def test_customer_scope_precedes_user_filter_and_pagination_contract(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get(
            "/api/all_requests/user/requests/",
            {"user": self.other_customer.id, "page_size": 1},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(set(response.data), {"count", "next", "previous", "results"})

        response = self.client.get("/api/all_requests/user/requests/?search=alpha&currency=USD")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.request_one.id)

    def test_agent_scope_cannot_be_expanded_by_query_parameters(self):
        self.client.force_authenticate(self.agent)
        response = self.client.get("/api/all_requests/user/requests/?user=%s" % self.other_customer.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

        response = self.client.get("/api/shipping/via-agent/?agent=%s" % self.other_agent.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_admin_combined_filters_and_deterministic_ordering(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(
            "/api/all_requests/admin/requests/",
            {"status": "pending", "request_type": "payment", "provider": "alpha", "amount_min": "10", "amount_max": "10", "ordering": "created_at"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.request_one.id)

    def test_invalid_ranges_and_values_are_stable_validation_errors(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/all_requests/admin/requests/?amount_min=20&amount_max=10")
        self.assertEqual(response.status_code, 400)
        self.assertIn("filters", response.data)

        response = self.client.get("/api/all_requests/admin/requests/?created_from=2026-01-01&created_to=2026-04-02")
        self.assertEqual(response.status_code, 400)
        self.assertIn("filters", response.data)

        response = self.client.get("/api/all_requests/admin/requests/?status=not-a-status")
        self.assertEqual(response.status_code, 400)
        self.assertIn("filters", response.data)

        response = self.client.get("/api/all_requests/admin/requests/?ordering=wallet_balance")
        self.assertEqual(response.status_code, 400)
        self.assertIn("filters", response.data)

    def test_shipping_and_cashout_lists_are_paginated_and_read_only(self):
        self.client.force_authenticate(self.admin)
        for path in (
            "/api/shipping/standard/",
            "/api/shipping/via-agent/",
            "/api/shipping/agent-admin/",
            "/api/agents/admin/cashout/",
        ):
            response = self.client.get(path, {"page_size": 1, "provider": "alpha"})
            self.assertEqual(response.status_code, 200, path)
            self.assertEqual(set(response.data), {"count", "next", "previous", "results"})
            self.assertEqual(response.data["count"], 1, path)

        before = Transaction.objects.count()
        response = self.client.get("/api/agents/admin/cashout/?page_size=100")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Transaction.objects.count(), before)

    def test_page_size_is_capped_and_query_filtering_does_not_mutate_records(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/all_requests/admin/requests/?page_size=1000")
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(response.data["results"]), 100)
        self.request_one.refresh_from_db()
        self.assertEqual(self.request_one.status, "pending")

    def test_request_list_has_bounded_query_count(self):
        self.client.force_authenticate(self.admin)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/api/all_requests/admin/requests/?page_size=100")
        self.assertEqual(response.status_code, 200)
        # Count + page query + the prefetched comments query, without per-row relation queries.
        self.assertLessEqual(len(queries), 6)
