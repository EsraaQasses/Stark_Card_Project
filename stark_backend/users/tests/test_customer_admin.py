from decimal import Decimal
from unittest.mock import patch

from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from finance.services import FinanceService
from users.models import AuditLog, CustomerBalanceAdjustment, CustomerCategory, User
from users.services.customer_admin import CustomerAdministrationService, PermissionDenied
from users.authentication import issue_tokens
from wallets.models import Wallet


class CustomerAdministrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(name="root-admin", email="root@example.com", password="Password-9!", role="admin")
        self.admin.is_superuser = True
        self.admin.is_staff = True
        self.admin.save(update_fields=["is_superuser", "is_staff"])
        self.operator = User.objects.create_user(name="ops-admin", email="ops@example.com", password="Password-9!", role="admin")
        self.customer = User.objects.create_user(name="customer", email="customer@example.com", password="Password-9!", role="user")
        self.agent = User.objects.create_user(name="agent", email="agent@example.com", password="Password-9!", role="agent")
        self.category = CustomerCategory.objects.create(name="VIP", display_name="VIP", profit_percentage=Decimal("5"))
        self.customer_wallet = Wallet.objects.get(user=self.customer, currency="USD")
        self.customer_wallet.available_balance = Decimal("100")
        self.customer_wallet.save(update_fields=["available_balance"])

    def test_aggregate_is_admin_only_and_bounded(self):
        for index in range(30):
            AuditLog.objects.create(user=self.operator, action="USER_UPDATE", resource_type="user", resource_id=self.customer.id,
                                    details={"index": index})
        response = self.client.get(f"/api/users/admin/customers/{self.customer.id}/?limit=200")
        self.assertEqual(response.status_code, 401)
        self.client.force_authenticate(self.operator)
        response = self.client.get(f"/api/users/admin/customers/{self.customer.id}/?limit=200")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["history_limit"], 100)
        self.assertLessEqual(len(response.data["audit_history"]), 100)

    def test_aggregate_query_count_is_bounded_by_history_limit(self):
        self.client.force_authenticate(self.operator)
        with CaptureQueriesContext(connection) as small_queries:
            small_response = self.client.get(
                f"/api/users/admin/customers/{self.customer.id}/?limit=1"
            )
        with CaptureQueriesContext(connection) as large_queries:
            large_response = self.client.get(
                f"/api/users/admin/customers/{self.customer.id}/?limit=100"
            )

        self.assertEqual(small_response.status_code, 200)
        self.assertEqual(large_response.status_code, 200)
        # Each bounded relation is fetched once; increasing the per-relation
        # history limit must not introduce per-row queries.
        self.assertLessEqual(len(large_queries), len(small_queries) + 1)

    def test_ban_unban_and_activation_are_explicit_and_idempotent(self):
        CustomerAdministrationService.set_banned(self.operator, self.customer.id, True, "fraud review")
        CustomerAdministrationService.set_banned(self.operator, self.customer.id, True, "fraud review")
        CustomerAdministrationService.set_active(self.operator, self.customer.id, False, "account review")
        customer = CustomerAdministrationService.set_active(self.operator, self.customer.id, True, "account review")
        self.assertTrue(customer.is_banned)
        self.assertTrue(customer.is_active)
        self.assertEqual(AuditLog.objects.filter(resource_id=self.customer.id).count(), 4)

    def test_role_category_and_agent_permissions(self):
        with self.assertRaises(PermissionDenied):
            CustomerAdministrationService.change_role(self.operator, self.customer.id, "agent")
        CustomerAdministrationService.assign_category(self.operator, self.customer.id, self.category.id, "approved customer tier")
        CustomerAdministrationService.assign_agent(self.operator, self.customer.id, self.agent.id)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.category_id, self.category.id)
        self.assertEqual(self.customer.agent_id, self.agent.id)

    def test_session_revocation_invalidates_refresh_token(self):
        refresh, access = issue_tokens(self.customer)
        result = CustomerAdministrationService.revoke_sessions(self.operator, self.customer.id, "security incident")
        self.assertTrue(result["revoked"])
        response = self.client.post("/api/users/token/refresh/", {"refresh": str(refresh)}, format="json")
        self.assertEqual(response.status_code, 401)

    @patch("users.services.customer_admin.issue_challenge")
    def test_password_reset_does_not_expose_secret(self, issue):
        issue.return_value = object()
        result = CustomerAdministrationService.send_password_reset(self.operator, self.customer.id, "customer requested reset")
        self.assertEqual(result, {"accepted": True})
        self.assertNotIn("token", result)
        self.assertNotIn("code", result)

    def test_admin_adjustment_is_applied_immediately_and_is_idempotent(self):
        adjustment = CustomerAdministrationService.request_adjustment(
            self.operator, self.customer.id, "10", "USD", "manual correction reason", "adjust-1"
        )
        replay = CustomerAdministrationService.request_adjustment(
            self.operator, self.customer.id, "10", "USD", "manual correction reason", "adjust-1"
        )
        self.assertEqual(adjustment.id, replay.id)
        self.assertEqual(CustomerBalanceAdjustment.objects.get(id=adjustment.id).status, "approved")
        self.assertEqual(TransactionCount.for_user(self.customer), 1)
        self.customer_wallet.refresh_from_db()
        self.assertEqual(self.customer_wallet.available_balance, Decimal("110.00000000"))

    def test_admin_adjustment_api_confirms_balance_change(self):
        self.client.force_authenticate(self.operator)
        request_response = self.client.post(
            f"/api/users/admin/customers/{self.customer.id}/balance-adjustments/",
            {
                "amount": "50.00",
                "currency": "USD",
                "reason": "Manual balance recharge by administrator",
                "idempotency_key": "api-adjust-1",
            },
            format="json",
        )
        self.assertEqual(request_response.status_code, 200)
        self.assertEqual(request_response.data["status"], "approved")
        self.assertIsNotNone(request_response.data["transaction_id"])
        self.customer_wallet.refresh_from_db()
        self.assertEqual(self.customer_wallet.available_balance, Decimal("150.00000000"))

    def test_insufficient_funds_rejects_adjustment_without_balance_effect(self):
        with self.assertRaises(Exception):
            CustomerAdministrationService.request_adjustment(
            self.operator, self.customer.id, "-1000", "USD", "invalid negative correction", "adjust-fail"
            )
        self.customer_wallet.refresh_from_db()
        self.assertEqual(self.customer_wallet.available_balance, Decimal("100"))


class TransactionCount:
    @staticmethod
    def for_user(user):
        from transactions.models import Transaction
        return Transaction.objects.filter(user=user).count()
