from decimal import Decimal
from unittest.mock import patch
from pathlib import Path

from django.test import TestCase

from payment.models import Payment
from store.models import ExternalProduct, Section, StoreProduct
from transactions.models import Transaction
from transactions.services.purchase_service import PurchaseService
from third_party_apis.models import ThirdPartyAPI
from users.models import User
from wallets.models import ExchangeRate, ExchangeRateQuote, Wallet
from wallets.rate_quotes import ExchangeRateQuoteService


class PurchaseExecutionMigrationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(name="d3-admin", password="Password-9!", role="admin")
        self.user = User.objects.create_user(name="d3-user", password="Password-9!", role="user")
        for currency in ("USD", "SYP"):
            wallet = Wallet.objects.get(user=self.user, currency=currency)
            wallet.available_balance = Decimal("100000")
            wallet.save(update_fields=["available_balance"])
        section = Section.objects.create(name_en="D3", name_ar="D3")
        api = ThirdPartyAPI.objects.create(
            name="D3 Provider", provider="stark-card", base_url="https://provider.test/"
        )
        external = ExternalProduct.objects.create(
            api_config=api, external_id="d3-product", name="D3 Product", base_price=Decimal("1")
        )
        self.usd_product = StoreProduct.objects.create(
            section=section, external_product=external, name="USD Product", price=Decimal("2"), currency="USD"
        )
        self.syp_product = StoreProduct.objects.create(
            section=section, external_product=external, name="SYP Product", price=Decimal("20000"), currency="SYP"
        )

    def activate_quote(self):
        return ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="D3 test quote"
        )

    def call(self, product, currency, key=None, result=None):
        result = result or {"success": True, "status": "approved", "order_id": "order-d3"}
        with patch("transactions.services.purchase_service.APIService.process_payment", return_value=result) as provider:
            response = PurchaseService.process_purchase(
                store_product_id=product.id, user=self.user,
                user_inputs={"quantity": 1}, wallet_currency=currency,
                idempotency_key=key,
            )
        return response, provider

    def test_rate_side_mapping_and_exact_customer_charge(self):
        quote = self.activate_quote()
        cases = (
            (self.usd_product, "USD", "NONE", Decimal("2.40000000")),
            (self.syp_product, "SYP", "NONE", Decimal("24000.00000000")),
            (self.usd_product, "SYP", "PLATFORM_SELLS_BASE", Decimal("24000.00000000")),
            (self.syp_product, "USD", "PLATFORM_BUYS_BASE", Decimal("2.40000000")),
        )
        for product, currency, side, charge in cases:
            response, _ = self.call(product, currency)
            self.assertTrue(response["success"], response)
            tx = Transaction.objects.get(pk=response["transaction_id"])
            payment = Payment.objects.get(pk=response["payment_id"])
            self.assertEqual(tx.exchange_rate_quote_id, payment.exchange_rate_quote_id)
            self.assertEqual(tx.exchange_rate_quote_id, None if side == "NONE" else quote.id)
            self.assertEqual(tx.exchange_rate_side, side)
            self.assertEqual(tx.target_amount, charge)
            self.assertEqual(payment.target_amount, charge)
            self.assertEqual(payment.final_price, charge)

    def test_cross_currency_without_quote_fails_before_mutation(self):
        ExchangeRateQuote.objects.all().delete()
        ExchangeRate.objects.all().delete()
        before_balance = Wallet.objects.get(user=self.user, currency="SYP").available_balance
        with patch("transactions.services.purchase_service.APIService.process_payment") as provider:
            response = PurchaseService.process_purchase(
                store_product_id=self.usd_product.id, user=self.user,
                user_inputs={"quantity": 1}, wallet_currency="SYP", idempotency_key="d3-no-quote"
            )
        self.assertFalse(response["success"])
        self.assertEqual(response["error_code"], "FX_RATE_UNAVAILABLE")
        self.assertEqual(Wallet.objects.get(user=self.user, currency="SYP").available_balance, before_balance)
        self.assertFalse(Transaction.objects.filter(idempotency_key="d3-no-quote").exists())
        self.assertFalse(Payment.objects.filter(user=self.user).exists())
        provider.assert_not_called()
        self.assertFalse(ExchangeRate.objects.exists())

    def test_idempotent_retry_reuses_snapshot_and_provider_once(self):
        self.activate_quote()
        first, provider = self.call(self.usd_product, "SYP", key="d3-repeat")
        second, _ = self.call(self.usd_product, "SYP", key="d3-repeat")
        self.assertTrue(first["success"])
        self.assertTrue(second["idempotency_replayed"])
        self.assertEqual(first["transaction_id"], second["transaction_id"])
        self.assertEqual(provider.call_count, 1)
        self.assertEqual(Transaction.objects.filter(idempotency_key="d3-repeat").count(), 1)

    def test_same_key_different_payload_conflicts(self):
        self.activate_quote()
        first, _ = self.call(self.usd_product, "SYP", key="d3-conflict")
        self.assertTrue(first["success"])
        response = PurchaseService.process_purchase(
            store_product_id=self.syp_product.id, user=self.user,
            user_inputs={"quantity": 1}, wallet_currency="USD", idempotency_key="d3-conflict"
        )
        self.assertFalse(response["success"])
        self.assertEqual(response["error_code"], "IDEMPOTENCY_CONFLICT")

    def test_timeout_keeps_operation_pending_without_resubmit(self):
        self.activate_quote()
        first, provider = self.call(
            self.usd_product, "SYP", key="d3-timeout",
            result={"success": False, "error": "provider timeout"},
        )
        second, _ = self.call(self.usd_product, "SYP", key="d3-timeout")
        self.assertTrue(first["success"])
        self.assertEqual(first["status"], "pending")
        self.assertTrue(second["idempotency_replayed"])
        self.assertEqual(provider.call_count, 1)
        self.assertEqual(Transaction.objects.get(pk=first["transaction_id"]).status, "pending")

    def test_frontend_price_and_rate_are_not_authoritative(self):
        self.activate_quote()
        with patch("transactions.services.purchase_service.APIService.process_payment", return_value={
            "success": True, "status": "approved", "order_id": "server-priced"
        }):
            response = PurchaseService.process_purchase(
                store_product_id=self.usd_product.id, user=self.user,
                user_inputs={"quantity": 1, "final_price": "0.01", "exchange_rate": "1"},
                wallet_currency="SYP", idempotency_key="d3-server-price",
            )
        self.assertTrue(response["success"])
        self.assertEqual(response["charged_amount"], "24000.00000000")


class PurchaseExecutionArchitectureTests(TestCase):
    def test_active_execution_modules_have_no_legacy_fx_fallbacks(self):
        root = Path(__file__).resolve().parents[1]
        paths = [
            root / "transactions" / "services" / "purchase_service.py",
            root / "payment" / "services" / "payment_service.py",
            root / "payment" / "services" / "payment_service_fixed.py",
            root / "payment" / "services" / "purchase_service.py",
            root / "payment" / "services" / "unified_payment_service.py",
            root / "third_party_apis" / "services" / "api_service.py",
        ]
        for path in paths:
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("116", text, str(path))
            self.assertNotIn("ExchangeRate.objects", text, str(path))
            self.assertNotIn("CurrencyService.convert_amount", text, str(path))
