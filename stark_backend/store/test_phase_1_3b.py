from decimal import Decimal

from django.test import TestCase

from finance.conversion import RateSide
from store.models import Product, Section
from store.services.pricing import PricingPolicy, PricingResult
from users.models import User
from wallets.rate_quotes import ExchangeRateQuoteService


class UnifiedPricingContractTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            name="phase13-admin", full_name="Phase 13 Admin", email="phase13-admin@example.com",
            password="Password-9!", role="admin",
        )
        self.user = User.objects.create_user(
            name="phase13-user", full_name="Phase 13 User", email="phase13-user@example.com",
            password="Password-9!", role="user",
        )
        section = Section.objects.create(name_en="Phase 13", name_ar="Phase 13")
        self.product = Product.objects.create(
            section=section, name_en="Phase 13 Product", name_ar="Phase 13 Product",
            product_type="amount_based", currency="USD", base_price=Decimal("2"),
            min_amount=Decimal("1"), max_amount=Decimal("10"), is_active=True,
        )

    def test_result_is_immutable_and_product_profit_is_disabled(self):
        result = PricingPolicy.for_product(product=self.product, user=self.user)
        self.assertIsInstance(result, PricingResult)
        self.assertIsInstance(result.native_final_amount, Decimal)
        self.assertEqual(result.product_profit_percentage, Decimal("0"))
        with self.assertRaises((AttributeError, TypeError)):
            result.native_final_amount = Decimal("99")

    def test_same_currency_result_requires_no_quote(self):
        result = PricingPolicy.for_product(
            product=self.product, user=self.user, wallet_currency="USD", quote=False,
        )
        self.assertEqual(result.rate_side, RateSide.NONE.value)
        self.assertIsNone(result.quote_id)
        self.assertEqual(result.wallet_charge_amount, result.native_final_amount.quantize(Decimal("0.00000001")))

    def test_cross_currency_result_captures_quote_and_matches_native_policy(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="11000", actor=self.admin,
            activation_note="Phase 1.3 unified pricing test",
        )
        result = PricingPolicy.for_product(
            product=self.product, user=self.user, wallet_currency="SYP", quote=quote,
        )
        self.assertEqual(result.rate_side, RateSide.PLATFORM_SELLS_BASE.value)
        self.assertEqual(result.quote_id, quote.id)
        self.assertEqual(result.quote_version, quote.version)
        self.assertEqual(result.native_final_amount, PricingPolicy.native_final_amount(Decimal("2"), self.user)[-1])
        self.assertEqual(result.wallet_charge_amount, result.conversion.target_amount)

    def test_customer_snapshot_hides_provider_cost(self):
        result = PricingPolicy.for_product(product=self.product, user=self.user)
        customer = result.to_customer_dict()
        self.assertNotIn("provider_cost_amount", customer)
        self.assertIn("pricing_policy_version", customer)
