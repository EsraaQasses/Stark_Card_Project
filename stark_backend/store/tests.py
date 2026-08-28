from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import User
from .models import Section, Product


class StoreCRUDTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            name="admin_store",
            password="adminpass123",
            role="admin",
            is_staff=True,
            is_superuser=True,
            full_name="Admin Store"
        )
        self.client.force_authenticate(user=self.admin)

    def test_section_crud(self):
        create_url = reverse("admin-section-list")
        payload = {
            "name_en": "Mobile Cards",
            "name_ar": "بطاقات موبايل",
            "description": "Mobile topups"
        }
        create_response = self.client.post(create_url, payload, format="json")
        self.assertEqual(create_response.status_code, 201)

        section_id = create_response.data["id"]
        detail_url = reverse("admin-section-detail", args=[section_id])

        update_response = self.client.patch(detail_url, {"description": "Updated"}, format="json")
        self.assertEqual(update_response.status_code, 200)

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Section.objects.filter(id=section_id).exists())

    def test_product_crud(self):
        section = Section.objects.create(
            name_en="Games",
            name_ar="ألعاب",
            description="Game cards"
        )

        create_url = reverse("admin-product-list")
        payload = {
            "name_en": "Test Product",
            "name_ar": "منتج تجريبي",
            "description_en": "Test description",
            "description_ar": "وصف تجريبي",
            "section": section.id,
            "product_type": "amount_based",
            "currency": "USD",
            "min_amount": "1",
            "max_amount": "100",
            "base_price": "10.00",
            "is_active": True
        }
        create_response = self.client.post(create_url, payload, format="json")
        self.assertEqual(create_response.status_code, 201)

        product_id = create_response.data["id"]
        detail_url = reverse("admin-product-detail", args=[product_id])

        update_response = self.client.patch(detail_url, {"name_en": "Updated Product"}, format="json")
        self.assertEqual(update_response.status_code, 200)

        delete_response = self.client.delete(detail_url)
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Product.objects.filter(id=product_id).exists())

    def test_admin_product_list_is_paginated_and_lightweight(self):
        section = Section.objects.create(name_en="Games", name_ar="العاب")
        Product.objects.create(
            section=section, name_en="List Product", name_ar="منتج القائمة",
            product_type="amount_based", currency="USD", min_amount=1,
            max_amount=100, base_price=10,
        )

        response = self.client.get(reverse("admin-product-list"), {"page_size": 1})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)
        product = response.data["results"][0]
        self.assertEqual(product["name_en"], "List Product")
        self.assertNotIn("price_info", product)
        self.assertNotIn("available_external_products", product)

    def test_admin_product_detail_keeps_full_serializer(self):
        section = Section.objects.create(name_en="Games", name_ar="العاب")
        product = Product.objects.create(
            section=section, name_en="Detail Product", name_ar="منتج التفاصيل",
            product_type="amount_based", currency="USD", min_amount=1,
            max_amount=100, base_price=10,
        )

        response = self.client.get(reverse("admin-product-detail", args=[product.id]))

        self.assertEqual(response.status_code, 200)
        self.assertIn("price_info", response.data)
        self.assertIn("requirements", response.data)

    def test_admin_product_list_query_count_does_not_grow_per_product(self):
        section = Section.objects.create(name_en="Games", name_ar="العاب")
        for index in range(5):
            Product.objects.create(
                section=section, name_en=f"List Product {index}", name_ar=f"منتج {index}",
                product_type="amount_based", currency="USD", min_amount=1,
                max_amount=100, base_price=10,
            )

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(reverse("admin-product-list"), {"page_size": 5})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertLessEqual(len(queries), 5)

    def test_admin_product_list_supports_server_side_filters(self):
        section = Section.objects.create(name_en="Games", name_ar="العاب")
        Product.objects.create(
            section=section, name_en="Visible USD", name_ar="دولار", product_type="amount_based",
            currency="USD", min_amount=1, max_amount=100, base_price=10,
        )
        Product.objects.create(
            section=section, name_en="Visible SYP", name_ar="ليرة", product_type="customization_based",
            currency="SYP", base_price=10, customization_options="1,2",
        )

        response = self.client.get(
            reverse("admin-product-list"), {"search": "Visible USD", "currency": "USD", "product_type": "amount_based"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name_en"], "Visible USD")
