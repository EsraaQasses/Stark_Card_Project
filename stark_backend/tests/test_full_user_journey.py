from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from all_requests.models import Request
from payment.models import Payment
from shipping.models import Shipping
from store.models import Section, ExternalProduct, StoreProduct
from third_party_apis.models import ThirdPartyAPI
from transactions.models import Transaction
from users.models import User, UserIdentity, PasswordResetChallenge
from wallets.models import Wallet


class FullUserJourneyScenarioTests(TestCase):
    """End-to-end local scenario for the main Stark user journey.

    Run with:
        python manage.py test tests.test_full_user_journey -v 2

    The test database is isolated by Django. External provider payment is
    mocked because this scenario must never charge a real provider.
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            name="scenario_admin",
            password="ScenarioAdmin123!",
            email="scenario_admin@example.test",
            full_name="Scenario Admin",
        )
        self.agent = User.objects.create_user(
            name="scenario_agent",
            password="ScenarioAgent123!",
            email="scenario_agent@example.test",
            full_name="Scenario Agent",
            role="agent",
        )
        self.user = None
        self.results = []

        api = ThirdPartyAPI.objects.create(
            name="Scenario Stark Provider",
            provider="stark-card",
            base_url="https://provider.invalid",
            is_active=True,
        )
        section = Section.objects.create(name_en="Scenario Products", name_ar="منتجات الاختبار")
        external = ExternalProduct.objects.create(
            api_config=api,
            external_id="scenario-product-001",
            name="Scenario Product",
            description="Isolated end-to-end test product",
            base_price=Decimal("10.00"),
            required_fields_json=[{"field_name": "phone_number"}],
        )
        self.product = StoreProduct.objects.create(
            section=section,
            external_product=external,
            name="Scenario Store Product",
            description="Isolated end-to-end test product",
            price=Decimal("10.00"),
            is_active=True,
        )

    def record(self, name, response, expected):
        actual = response.status_code
        self.results.append({"step": name, "status": actual, "expected": expected})
        self.assertEqual(actual, expected, f"{name}: {response.data}")
        return response

    def tearDown(self):
        print("\nSTARK FULL USER JOURNEY SCENARIO")
        for result in self.results:
            print(
                f"{result['step']}: {result['status']} "
                f"(expected {result['expected']})"
            )
        if hasattr(self, "wallet_before"):
            print(
                "wallet USD available: "
                f"before={self.wallet_before} "
                f"after_shipping={self.wallet_after_shipping} "
                f"after_purchase={getattr(self, 'wallet_after_purchase', 'not reached')}"
            )
        if hasattr(self, "final_financial_report"):
            print(
                "financial report: "
                f"operations={self.final_financial_report.data.get('operation_count')} "
                f"totals={self.final_financial_report.data.get('totals')}"
            )

    def test_user_registration_password_reset_shipping_agent_requests_purchase_and_finance(self):
        # 1. User creates an account through the public endpoint.
        registration = self.record(
            "register user",
            self.client.post(
                "/api/users/register/",
                {
                    "full_name": "Scenario User",
                    "name": "scenario_user",
                    "email": "scenario_user@example.test",
                    "phone": "09990000009",
                    "password": "InitialPassword123!",
                    "country": "SY",
                    "optional_phone": "",
                    "role": "user",
                    "provider": "email",
                },
                format="json",
            ),
            201,
        )
        self.user = User.objects.get(name="scenario_user")

        # The real OTP delivery is external. Test activation through the
        # model-backed identity record, then use the real login endpoint.
        self.user.is_active = True
        self.user.save(update_fields=["is_active"])
        UserIdentity.objects.filter(user=self.user).update(is_verified=True)
        if not UserIdentity.objects.filter(user=self.user, is_verified=True).exists():
            UserIdentity.objects.create(
                user=self.user, provider="email",
                identifier=self.user.email, is_verified=True,
            )

        login = self.record(
            "login after registration",
            self.client.post(
                "/api/users/login/",
                {"name": "scenario_user", "password": "InitialPassword123!"},
                format="json",
            ),
            200,
        )
        user_access = login.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {user_access}")

        self.record("authenticated profile", self.client.get("/api/users/me/"), 200)

        # 2. User forgets password. Capture the generated code in-process.
        captured = {}

        def capture_code(user, code, lifetime_minutes):
            captured["code"] = code

        with patch(
            "users.services.password_reset.EmailService.send_secure_password_reset_code",
            side_effect=capture_code,
        ):
            reset_request = self.record(
                "password reset request",
                self.client.post(
                    "/api/users/password-reset/request/",
                    {"email": self.user.email},
                    format="json",
                ),
                200,
            )
        challenge = PasswordResetChallenge.objects.get(
            request_id=reset_request.data["request_id"]
        )
        self.assertIn("code", captured)

        reset_verify = self.record(
            "password reset code verification",
            self.client.post(
                "/api/users/password-reset/verify/",
                {"request_id": challenge.request_id, "code": captured["code"]},
                format="json",
            ),
            200,
        )
        reset_confirm = self.record(
            "password reset confirmation",
            self.client.post(
                "/api/users/password-reset/confirm/",
                {
                    "reset_token": reset_verify.data["reset_token"],
                    "new_password": "ChangedPassword123!",
                    "confirm_password": "ChangedPassword123!",
                },
                format="json",
            ),
            200,
        )
        self.client.credentials()
        login = self.record(
            "login after password reset",
            self.client.post(
                "/api/users/login/",
                {"name": "scenario_user", "password": "ChangedPassword123!"},
                format="json",
            ),
            200,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        # 3. User submits a payment/shipping request through the API.
        before_wallet = Wallet.objects.get(user=self.user, currency="USD").available_balance
        self.wallet_before = before_wallet
        create_request = self.record(
            "create shipping payment request",
            self.client.post(
                "/api/all_requests/user/requests/",
                {
                    "request_type": "payment",
                    "amount": "50.00",
                    "currency": "USD",
                    "description": "Scenario wallet funding request",
                    "user_input_data": {"wallet_currency": "USD"},
                },
                format="json",
            ),
            201,
        )
        request_id = create_request.data.get("id") or create_request.data.get("request", {}).get("id")
        request_obj = (
            Request.objects.filter(user=self.user, request_type="payment")
            .order_by("-id")
            .first()
        )
        self.assertIsNotNone(request_obj, create_request.data)
        shipping = Shipping.objects.get(request=request_obj)

        # 4. Admin sees and accepts the shipping request.
        self.client.force_authenticate(self.admin)
        self.record("admin lists shipping requests", self.client.get("/api/shipping/"), 200)
        approved = self.record(
            "admin approves shipping",
            self.client.post(
                f"/api/shipping/{shipping.id}/update_status/",
                {"status": "approved", "admin_notes": "Scenario approved"},
                format="json",
            ),
            200,
        )
        shipping.refresh_from_db()
        request_obj.refresh_from_db()
        self.assertEqual(shipping.status, "approved")
        self.assertEqual(request_obj.status, "completed")
        after_shipping = Wallet.objects.get(user=self.user, currency="USD").available_balance
        self.wallet_after_shipping = after_shipping
        self.assertEqual(after_shipping - before_wallet, Decimal("50.00"))
        self.record(
            "admin reads shipping payment status",
            self.client.get(f"/api/shipping/{shipping.id}/payment_status/"),
            200,
        )

        # 5. Admin promotes/uses an agent and handles another request type.
        promote_target = User.objects.create_user(
            name="scenario_promoted_agent",
            password="PromotedAgent123!",
            email="promoted_agent@example.test",
            full_name="Promoted Agent",
        )
        self.record(
            "admin promotes user to agent",
            self.client.post(f"/api/agents/promote-to-agent/{promote_target.id}/", {}, format="json"),
            200,
        )
        self.record(
            "admin lists requests",
            self.client.get("/api/all_requests/admin/requests/"),
            200,
        )
        self.client.force_authenticate(self.user)
        other_request = self.record(
            "user creates other request",
            self.client.post(
                "/api/all_requests/user/requests/",
                {
                    "request_type": "other",
                    "title": "Scenario support request",
                    "description": "Need help with an account question",
                },
                format="json",
            ),
            201,
        )
        self.client.force_authenticate(self.agent)
        self.record(
            "agent reads assigned users",
            self.client.get(f"/api/agents/{self.agent.id}/users/"),
            200,
        )
        self.client.force_authenticate(self.admin)
        self.financial_before_purchase = self.record(
            "admin reads financial report",
            self.client.get("/api/finance/reports/financial/?period=daily"),
            200,
        )

        # 6. Attempt a Syriatel purchase with a known non-Syriatel number.
        # The connector itself is exercised, but its HTTP boundary is mocked
        # with the provider's rejected-response shape. No external request or
        # real charge is possible in this test.
        self.client.force_authenticate(self.user)
        wallet_before_rejected_purchase = Wallet.objects.get(
            user=self.user, currency="USD"
        ).available_balance
        successful_payments_before = Payment.objects.filter(
            user=self.user, status="success"
        ).count()
        successful_transactions_before = Transaction.objects.filter(
            user=self.user, status="approved", transaction_type="purchase"
        ).count()
        with patch(
            "third_party_apis.utils.connectors.BaseConnector.make_request",
            return_value={
                "success": True,
                "status_code": 200,
                "data": {
                    "status": "ERROR",
                    "code": "PHONE_NOT_SYRIATEL",
                    "msg": {"status": "هذا الرقم ليس سيريتل"},
                },
            },
        ) as provider_request:
            purchase = self.record(
                "Syriatel rejects non-Syriatel phone number",
                self.client.post(
                    "/api/store/user/purchases/",
                    {
                        "store_product_id": self.product.id,
                        "user_inputs": {"phone_number": "0951516068", "quantity": 1},
                        "wallet_currency": "USD",
                        "idempotency_key": "scenario-purchase-invalid-syriatel-001",
                    },
                    format="json",
                ),
                400,
            )
        self.assertFalse(purchase.data["success"])
        print(f"rejected purchase response: {purchase.data}")
        self.assertEqual(
            purchase.data["error"]["code"], "PROVIDER_REJECTED", purchase.data
        )
        self.assertIn(
            "ليس سيريتل", purchase.data["error"]["details"]["legacy_error"]
        )
        provider_request.assert_called_once()
        _, provider_kwargs = provider_request.call_args
        self.assertEqual(provider_kwargs["query_params"]["phone_number"], "0951516068")

        after_rejected_purchase = Wallet.objects.get(
            user=self.user, currency="USD"
        ).available_balance
        self.wallet_after_purchase = after_rejected_purchase
        self.assertEqual(after_rejected_purchase, wallet_before_rejected_purchase)
        self.assertEqual(
            Payment.objects.filter(user=self.user, status="success").count(),
            successful_payments_before,
        )
        self.assertEqual(
            Transaction.objects.filter(
                user=self.user, status="approved", transaction_type="purchase"
            ).count(),
            successful_transactions_before,
        )
        failed_payment = Payment.objects.get(
            user=self.user,
            idempotency_key="scenario-purchase-invalid-syriatel-001",
        ) if hasattr(Payment, "idempotency_key") else Payment.objects.filter(
            user=self.user, store_product=self.product, status="failed"
        ).latest("id")
        self.assertEqual(failed_payment.status, "failed")
        self.assertIn("ليس سيريتل", failed_payment.error_message)

        self.record("user reads wallet changes", self.client.get("/api/wallets/wallet/"), 200)
        self.record("user reads wallet transactions", self.client.get("/api/wallets/wallet/transactions/"), 200)
        self.client.force_authenticate(self.admin)
        self.final_financial_report = self.record(
            "admin reads final financial report",
            self.client.get("/api/finance/reports/financial/?period=daily"),
            200,
        )

        self.assertTrue(Transaction.objects.filter(user=self.user).exists())
        self.assertTrue(Payment.objects.filter(user=self.user).exists())
        self.assertTrue(Request.objects.filter(user=self.user, request_type="other").exists())
        self.assertGreaterEqual(after_shipping, Decimal("50.00"))
        self.assertEqual(
            self.final_financial_report.data.get("totals"),
            self.financial_before_purchase.data.get("totals"),
        )
