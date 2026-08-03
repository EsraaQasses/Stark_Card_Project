from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from store.models import Product, ProductRequirement, Section
from users.models import CustomerCategory, User


class ProductReadQueryOptimizationTests(TestCase):
    """PostgreSQL regression coverage for bounded catalogue reads."""

    def setUp(self):
        self.client = APIClient()
        category = CustomerCategory.objects.create(
            name="query-category", display_name="Query category", profit_percentage=Decimal("10.00")
        )
        self.user = User.objects.create_user(
            name="query-user", password="Password-9!", role="user", category=category
        )
        self.section = Section.objects.create(name_en="Query products", name_ar="استعلام")
        self.client.force_authenticate(self.user)

    def _create_products(self, count):
        for index in range(count):
            product = Product.objects.create(
                section=self.section,
                name_en=f"Product {index}",
                name_ar=f"منتج {index}",
                product_type="amount_based",
                currency="USD",
                min_amount=Decimal("1"),
                max_amount=Decimal("10"),
                base_price=Decimal("2.00"),
                is_active=True,
            )
            ProductRequirement.objects.create(
                product=product,
                field_name="account",
                field_type="text",
                is_required=True,
                order=0,
            )

    def _query_count(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/api/store/user/products/", {"page_size": 100})
        self.assertEqual(response.status_code, 200)
        return len(queries), response

    def test_product_list_queries_do_not_grow_with_serialized_rows(self):
        self._create_products(1)
        one_count, one_response = self._query_count()

        self._create_products(7)
        many_count, many_response = self._query_count()

        self.assertEqual(len(one_response.data), 1)
        self.assertEqual(len(many_response.data), 8)
        # Fixed setup, pagination, quote, requirements, and favorite queries are
        # allowed; adding seven products must not add per-row database queries.
        self.assertLessEqual(many_count, one_count + 1)

    def test_product_list_preserves_response_fields_and_pagination(self):
        self._create_products(3)
        response = self.client.get("/api/store/user/products/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 3)
        self.assertIn("price_info", response.data[0])
        self.assertIn("requirements", response.data[0])
