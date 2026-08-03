from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from agents.models import AgentProductAssignment, AgentProfile
from store.models import Product, Section
from users.models import User


class AgentReadQueryOptimizationTests(TestCase):
    """PostgreSQL regression coverage for the public agent catalogue read."""

    def setUp(self):
        self.client = APIClient()
        self.section = Section.objects.create(name_en="Agent products", name_ar="وكلاء")
        self.viewer = User.objects.create_user(
            name="query-agent-viewer", email="query-agent-viewer@example.com",
            password="Password-9!", role="user",
        )
        self.client.force_authenticate(self.viewer)

    def _create_agents(self, count, start=0):
        for index in range(start, start + count):
            agent = User.objects.create_user(
                name=f"query-agent-{index}",
                email=f"query-agent-{index}@example.com",
                password="Password-9!",
                role="agent",
            )
            AgentProfile.objects.filter(user=agent).update(commission_rate=Decimal("5.00"))
            for client_index in range(2):
                User.objects.create_user(
                    name=f"query-client-{index}-{client_index}",
                    email=f"query-client-{index}-{client_index}@example.com",
                    password="Password-9!",
                    role="user",
                    agent=agent,
                )
            product = Product.objects.create(
                section=self.section,
                name_en=f"Agent product {index}",
                name_ar=f"منتج وكيل {index}",
                product_type="amount_based",
                currency="USD",
                min_amount=Decimal("1"),
                max_amount=Decimal("10"),
                base_price=Decimal("2.00"),
            )
            AgentProductAssignment.objects.create(
                agent=agent, product=product, commission_percent=Decimal("5.00")
            )

    def _query_count(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/api/agents/agents/")
        self.assertEqual(response.status_code, 200)
        return len(queries), response

    def test_agent_list_queries_do_not_grow_with_agents(self):
        self._create_agents(1)
        one_count, one_response = self._query_count()

        self._create_agents(3, start=1)
        many_count, many_response = self._query_count()

        self.assertEqual(len(one_response.data), 1)
        self.assertEqual(len(many_response.data), 4)
        self.assertLessEqual(many_count, one_count + 2)
        self.assertEqual(many_response.data[-1]["clients_count"], 2)
        self.assertEqual(many_response.data[-1]["products_count"], 1)
