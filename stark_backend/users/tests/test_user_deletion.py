from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import User


class UserDeletionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            name="admin_user",
            password="adminpass123",
            role="admin",
            is_staff=True,
            is_superuser=True,
            full_name="Admin User",
        )
        self.regular_user = User.objects.create_user(
            name="regular_user",
            password="userpass123",
            role="user",
            full_name="Regular User",
        )

    def test_admin_can_delete_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(reverse("delete_user", args=[self.regular_user.id]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(id=self.regular_user.id).exists())

    def test_non_admin_cannot_delete_user(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.delete(reverse("delete_user", args=[self.admin.id]))
        self.assertEqual(response.status_code, 403)

    def test_admin_cannot_delete_self(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(reverse("delete_user", args=[self.admin.id]))
        self.assertEqual(response.status_code, 400)
