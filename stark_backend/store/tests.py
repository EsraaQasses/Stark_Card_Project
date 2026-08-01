from django.test import TestCase
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
