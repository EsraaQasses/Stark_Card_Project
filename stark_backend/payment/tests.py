from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase

from users.models import User
from wallets.models import Wallet
from store.models import Section, ExternalProduct, StoreProduct
from third_party_apis.models import ThirdPartyAPI
from transactions.models import Transaction
from .models import Payment
from .services.payment_service_fixed import FixedPaymentService


class PaymentFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            name="payment_user",
            password="userpass123",
            role="user",
            full_name="Payment User"
        )
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.wallet.available_balance = Decimal("500.00")
        self.wallet.save()

        self.section = Section.objects.create(
            name_en="Payments",
            name_ar="مدفوعات",
            description="Payment section"
        )

        self.alaaeddin_api = ThirdPartyAPI.objects.create(
            name="Alaaeddin API",
            provider="alaaeddin",
            base_url="https://www.alaaeddin.net/",
            is_active=True
        )
        self.stark_api = ThirdPartyAPI.objects.create(
            name="Stark API",
            provider="stark-card",
            base_url="https://api.stark-card.com/",
            is_active=True
        )

        self.alaaeddin_external = ExternalProduct.objects.create(
            api_config=self.alaaeddin_api,
            external_id="111",
            name="Alaaeddin Product",
            description="Alaaeddin external product",
            base_price=Decimal("10.00"),
            required_fields_json=[{"field_name": "phone_number"}]
        )
        self.stark_external = ExternalProduct.objects.create(
            api_config=self.stark_api,
            external_id="222",
            name="Stark Product",
            description="Stark external product",
            base_price=Decimal("10.00"),
            required_fields_json=[{"field_name": "phone_number"}]
        )

        self.alaaeddin_store = StoreProduct.objects.create(
            section=self.section,
            external_product=self.alaaeddin_external,
            name="Alaaeddin Store Product",
            description="Alaaeddin store product",
            price=Decimal("10.00"),
            is_active=True
        )
        self.stark_store = StoreProduct.objects.create(
            section=self.section,
            external_product=self.stark_external,
            name="Stark Store Product",
            description="Stark store product",
            price=Decimal("10.00"),
            is_active=True
        )

    @patch("third_party_apis.services.api_service.APIService.process_payment")
    def test_payment_flow_alaaeddin(self, mock_process_payment):
        mock_process_payment.return_value = {
            "success": True,
            "external_transaction_id": "ext_alaaeddin",
            "order_id": "order_alaaeddin"
        }

        user_inputs = {"phone_number": "0982416135", "quantity": 4026}
        result = FixedPaymentService.process_payment(
            store_product_id=self.alaaeddin_store.id,
            user=self.user,
            user_inputs=user_inputs
        )

        self.assertTrue(result.get("success"))
        self.assertTrue(Payment.objects.filter(store_product=self.alaaeddin_store).exists())
        self.assertTrue(Transaction.objects.filter(user=self.user, transaction_type="purchase_hold").exists())

        mock_process_payment.assert_called_once()
        _, kwargs = mock_process_payment.call_args
        self.assertEqual(kwargs["store_product_id"], self.alaaeddin_store.id)
        self.assertEqual(kwargs["user_inputs"], user_inputs)

    @patch("third_party_apis.services.api_service.APIService.process_payment")
    def test_payment_flow_stark(self, mock_process_payment):
        mock_process_payment.return_value = {
            "success": True,
            "external_transaction_id": "ext_stark",
            "order_id": "order_stark"
        }

        user_inputs = {"phone_number": "0982416135", "quantity": 4026}
        result = FixedPaymentService.process_payment(
            store_product_id=self.stark_store.id,
            user=self.user,
            user_inputs=user_inputs
        )

        self.assertTrue(result.get("success"))
        self.assertTrue(Payment.objects.filter(store_product=self.stark_store).exists())

        mock_process_payment.assert_called_once()
        _, kwargs = mock_process_payment.call_args
        self.assertEqual(kwargs["store_product_id"], self.stark_store.id)
        self.assertEqual(kwargs["user_inputs"], user_inputs)

    @patch("third_party_apis.services.api_service.APIService.process_payment")
    def test_payment_flow_stark_gamer_id_persists(self, mock_process_payment):
        mock_process_payment.return_value = {
            "success": True,
            "external_transaction_id": "ext_stark_gamer",
            "order_id": "order_stark_gamer"
        }

        user_inputs = {"gamer_id": "gamer42", "quantity": 1}
        result = FixedPaymentService.process_payment(
            store_product_id=self.stark_store.id,
            user=self.user,
            user_inputs=user_inputs
        )

        self.assertTrue(result.get("success"))

        payment = Payment.objects.filter(store_product=self.stark_store, user_inputs__gamer_id="gamer42").first()
        self.assertIsNotNone(payment)
        self.assertEqual(payment.user_inputs.get("gamer_id"), "gamer42")

        from .serializers import PaymentSerializer
        serialized = PaymentSerializer(payment).data
        self.assertEqual(serialized.get("gamer_id"), "gamer42")
        self.assertIsNone(serialized.get("selected_option"))

