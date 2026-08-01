from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from store.models import Product, Section
from store.serializers import ProductCreateUpdateSerializer
from store.services.pricing import PricingPolicy
from users.models import CustomerCategory, User
from wallets.rate_quotes import ExchangeRateQuoteService


class ProductLevelProfitTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            name="phase14-admin", full_name="Phase 14 Admin", email="phase14-admin@example.com",
            password="Password-9!", role="admin",
        )
        category = CustomerCategory.objects.create(
            name="phase14-category", display_name="Phase 14", profit_percentage=Decimal("10.00"),
        )
        self.user = User.objects.create_user(
            name="phase14-user", full_name="Phase 14 User", email="phase14-user@example.com",
            password="Password-9!", role="user", category=category,
        )
        section = Section.objects.create(name_en="Phase 14", name_ar="Phase 14")
        self.product = Product.objects.create(
            section=section, name_en="Profit Product", name_ar="Profit Product",
            product_type="amount_based", currency="USD", base_price=Decimal("100.00"),
            min_amount=Decimal("1"), max_amount=Decimal("10"), product_profit_percentage=Decimal("20.00"),
        )

    def test_additive_profit_uses_one_base_without_compounding(self):
        result = PricingPolicy.for_product(product=self.product, user=self.user)
        self.assertEqual(result.category_profit_amount, Decimal("10.00"))
        self.assertEqual(result.product_profit_amount, Decimal("20.00"))
        self.assertEqual(result.combined_profit_percentage, Decimal("30.00"))
        self.assertEqual(result.price_after_profit, Decimal("130.00000000"))
        self.assertEqual(result.native_final_amount, Decimal("130.00000000"))

    def test_zero_and_negative_validation(self):
        self.product.product_profit_percentage = Decimal("0.00")
        self.product.full_clean()
        self.product.product_profit_percentage = Decimal("-0.01")
        with self.assertRaises(ValidationError):
            self.product.full_clean()

    def test_serializer_rejects_out_of_range_profit(self):
        data = {
            "name_en": self.product.name_en, "name_ar": self.product.name_ar,
            "section": self.product.section_id, "product_type": "amount_based", "currency": "USD",
            "base_price": "100.00", "min_amount": "1", "max_amount": "10",
            "product_profit_percentage": "1000.00",
        }
        serializer = ProductCreateUpdateSerializer(instance=self.product, data=data, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn("product_profit_percentage", serializer.errors)

    def test_snapshot_captures_product_profit_and_is_stable_after_change(self):
        result = PricingPolicy.for_product(product=self.product, user=self.user)
        snapshot = result.to_snapshot()
        self.product.product_profit_percentage = Decimal("50.00")
        self.product.save(update_fields=["product_profit_percentage"])
        self.assertEqual(snapshot["product_profit_percentage"], "20.00")
        self.assertEqual(Decimal(snapshot["product_profit_amount"]), Decimal("20.00"))

    def test_both_cross_currency_directions_use_the_result_snapshot(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="11000", actor=self.admin,
            activation_note="Phase 1.4 unequal quote",
        )
        to_syp = PricingPolicy.for_product(product=self.product, user=self.user,
                                            wallet_currency="SYP", quote=quote)
        self.product.currency = "SYP"
        self.product.save(update_fields=["currency"])
        to_usd = PricingPolicy.for_product(product=self.product, user=self.user,
                                            wallet_currency="USD", quote=quote)
        self.assertEqual(to_syp.product_profit_percentage, Decimal("20.00"))
        self.assertEqual(to_usd.product_profit_percentage, Decimal("20.00"))
        self.assertEqual(to_syp.quote_id, quote.id)
        self.assertEqual(to_usd.quote_id, quote.id)

    def test_only_admin_product_api_can_change_profit(self):
        client = APIClient()
        endpoint = f"/api/store/admin/products/{self.product.id}/"
        client.force_authenticate(self.user)
        denied = client.patch(endpoint, {"product_profit_percentage": "30.00"}, format="json")
        self.assertIn(denied.status_code, (401, 403))
