from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import User
from all_requests.models import Request
from .models import Shipping
from transactions.models import Transaction
from wallets.models import Wallet


class ShippingFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            name="admin_shipping",
            password="adminpass123",
            role="admin",
            is_staff=True,
            is_superuser=True,
            full_name="Admin Shipping"
        )
        self.user = User.objects.create_user(
            name="user_shipping",
            password="userpass123",
            role="user",
            full_name="User Shipping"
        )

    def test_shipping_approval_flow_updates_wallet(self):
        request = Request.objects.create(
            user=self.user,
            request_type="payment",
            title="Wallet Topup",
            description="Top up request",
            amount=Decimal("50.00"),
            currency="USD"
        )

        shipping = Shipping.objects.get(request=request)
        self.client.force_authenticate(user=self.admin)

        url = reverse("shipping-update-status", args=[shipping.id])
        response = self.client.post(url, {"status": "approved", "admin_notes": "Approved"}, format="json")

        self.assertEqual(response.status_code, 200)
        shipping.refresh_from_db()
        request.refresh_from_db()

        self.assertEqual(shipping.status, "approved")
        self.assertEqual(request.status, "completed")

        wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.assertEqual(wallet.available_balance, Decimal("50.00"))
        self.assertTrue(Transaction.objects.filter(user=self.user, transaction_type="deposit").exists())
