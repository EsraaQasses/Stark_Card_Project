from decimal import Decimal
from unittest.mock import patch

from django.test import RequestFactory, TestCase, override_settings
from django.contrib.auth.models import AnonymousUser

from payment.models import Payment
from store.models import ExternalProduct, Product, Section, StoreProduct
from store.serializers import ExternalProductSerializer, ProductSerializer, StoreProductSerializer
from store.services.image_resolver import ProductImageResolver
from third_party_apis.models import ThirdPartyAPI
from transactions.models import Transaction
from transactions.services.purchase_service import PurchaseService
from users.models import User
from wallets.models import Wallet


@override_settings(PRODUCT_IMAGE_PLACEHOLDER_URL="https://static.example.test/product-placeholder.svg")
class ProductImageFallbackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(name="image-user", password="Password-9!", role="user")
        for currency in ("USD", "SYP"):
            wallet = Wallet.objects.get(user=self.user, currency=currency)
            wallet.available_balance = Decimal("100000")
            wallet.save(update_fields=["available_balance"])
        self.api = ThirdPartyAPI.objects.create(
            name="Image Provider", provider="stark-card", base_url="https://provider.test/"
        )
        self.section = Section.objects.create(name_en="Images", name_ar="صور")
        self.external = ExternalProduct.objects.create(
            api_config=self.api,
            external_id="image-product",
            name="Image Product",
            base_price=Decimal("1"),
            external_data={"image_url": "https://cdn.example.test/provider.png"},
        )
        self.store_product = StoreProduct.objects.create(
            section=self.section,
            external_product=self.external,
            name="Image Product",
            price=Decimal("2"),
            currency="USD",
        )
        self.request = RequestFactory().get("/products/")
        self.request.user = AnonymousUser()

    def test_local_image_has_priority_and_is_absolute(self):
        product = Product.objects.create(
            section=self.section,
            external_product=self.external,
            name_en="Local",
            name_ar="محلي",
            base_price=Decimal("2"),
            image="products/local.png",
        )
        result = ProductImageResolver.resolve(product, self.request)
        self.assertEqual(result["image_source"], "local")
        self.assertEqual(result["image_url"], "http://testserver/media/products/local.png")
        self.assertTrue(result["image_available"])
        self.assertFalse(result["image_is_fallback"])

    def test_provider_image_is_used_when_local_image_is_missing(self):
        result = ProductImageResolver.resolve(self.store_product, self.request)
        self.assertEqual(result["image_source"], "provider")
        self.assertEqual(result["image_url"], "https://cdn.example.test/provider.png")

    def test_invalid_or_missing_provider_image_uses_placeholder_without_network_io(self):
        self.external.external_data = {"image_url": "javascript:alert(1)", "thumbnail": "  "}
        self.external.save(update_fields=["external_data"])
        result = ProductImageResolver.resolve(self.store_product, self.request)
        self.assertEqual(result["image_source"], "placeholder")
        self.assertEqual(result["image_url"], "https://static.example.test/product-placeholder.svg")
        self.assertFalse(result["image_available"])
        self.assertTrue(result["image_is_fallback"])

    def test_removed_provider_image_falls_back(self):
        self.external.provider_status = "removed"
        self.external.is_active = False
        self.external.save(update_fields=["provider_status", "is_active"])
        result = ProductImageResolver.resolve(self.store_product, self.request)
        self.assertEqual(result["image_source"], "placeholder")
        self.assertTrue(result["image_is_fallback"])

    def test_product_serializers_expose_stable_image_metadata(self):
        product = Product.objects.create(
            section=self.section,
            external_product=self.external,
            name_en="Catalog",
            name_ar="كتالوج",
            base_price=Decimal("2"),
        )
        expected = {"image_url", "image_source", "image_available", "image_is_fallback"}
        for serializer_class, instance in (
            (ExternalProductSerializer, self.external),
            (ProductSerializer, product),
            (StoreProductSerializer, self.store_product),
        ):
            data = serializer_class(instance, context={"request": self.request}).data
            self.assertTrue(expected.issubset(data.keys()))
            self.assertEqual(data["image_source"], "provider")

    def test_purchase_persists_same_image_snapshot_on_transaction_and_payment(self):
        with patch(
            "transactions.services.purchase_service.APIService.process_payment",
            return_value={"success": True, "status": "approved", "order_id": "image-order"},
        ):
            result = PurchaseService.process_purchase(
                store_product_id=self.store_product.id,
                user=self.user,
                user_inputs={"quantity": 1},
                wallet_currency="USD",
                idempotency_key="image-snapshot",
            )
        self.assertTrue(result["success"], result)
        tx = Transaction.objects.get(pk=result["transaction_id"])
        payment = Payment.objects.get(pk=result["payment_id"])
        self.assertEqual(tx.image_url, "https://cdn.example.test/provider.png")
        self.assertEqual(payment.image_url, tx.image_url)
        self.assertEqual(payment.image_source, tx.image_source)
        self.assertEqual(payment.image_available, tx.image_available)
        self.assertEqual(payment.image_is_fallback, tx.image_is_fallback)
