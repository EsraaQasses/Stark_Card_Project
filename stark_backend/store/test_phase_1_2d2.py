from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from finance.conversion import RateSide
from store.models import Product, Section
from store.services.currency_service import CurrencyService
from store.services.price_service import PriceService
from users.models import User
from wallets.models import ExchangeRate, ExchangeRateQuote
from wallets.rate_quotes import ExchangeRateQuoteService


class ProductPricingDisplayTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            name="pricing-admin", full_name="Pricing Admin", email="pricing-admin@example.com",
            password="Password-9!", role="admin",
        )
        self.user = User.objects.create_user(
            name="pricing-user", full_name="Pricing User", email="pricing-user@example.com",
            password="Password-9!", role="user",
        )
        section = Section.objects.create(name_en="Pricing", name_ar="Pricing")
        self.usd_product = Product.objects.create(
            section=section, name_en="USD Product", name_ar="USD Product",
            product_type="amount_based", currency="USD", base_price=Decimal("2"), is_active=True,
        )
        self.syp_product = Product.objects.create(
            section=section, name_en="SYP Product", name_ar="SYP Product",
            product_type="amount_based", currency="SYP", base_price=Decimal("20000"), is_active=True,
        )

    def _quote(self):
        return ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin,
            activation_note="D2 product display quote",
        )

    def test_product_rate_side_mapping_and_decimal_metadata(self):
        quote = self._quote()
        usd = PriceService.get_product_prices(self.usd_product, self.user, quote=quote)
        syp = PriceService.get_product_prices(self.syp_product, self.user, quote=quote)
        usd_meta = usd["price_conversions"]["SYP"]
        syp_meta = syp["price_conversions"]["USD"]
        self.assertEqual(usd_meta["rate_side"], RateSide.PLATFORM_SELLS_BASE.value)
        self.assertEqual(usd_meta["converted_amount"], "20000.00000000")
        self.assertEqual(syp_meta["rate_side"], RateSide.PLATFORM_BUYS_BASE.value)
        self.assertEqual(syp_meta["converted_amount"], "2.00000000")
        self.assertEqual(usd["price_conversions"]["USD"]["rate_side"], RateSide.NONE.value)
        self.assertTrue(usd_meta["display_only"])
        self.assertEqual(usd_meta["quote_id"], quote.id)
        self.assertIsInstance(usd_meta["converted_amount"], str)

    def test_product_endpoints_reuse_one_quote_and_include_metadata(self):
        self._quote()
        client = APIClient()
        client.force_authenticate(self.user)
        with patch("store.serializers.ExchangeRateQuoteService.get_active_quote", wraps=ExchangeRateQuoteService.get_active_quote) as resolver:
            response = client.get("/api/store/user/products/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(resolver.call_count, 1)
        product = next(item for item in response.data if item["id"] == self.usd_product.id)
        self.assertEqual(product["price_info"]["price_conversions"]["SYP"]["rate_side"], "PLATFORM_SELLS_BASE")
        self.assertTrue(product["price_info"]["display_only"])

    def test_no_quote_keeps_native_price_and_nulls_cross_currency_display(self):
        before_legacy = ExchangeRate.objects.count()
        before_quotes = ExchangeRateQuote.objects.count()
        price = PriceService.get_product_prices(self.usd_product, self.user)
        self.assertEqual(price["base_price"], 2.0)
        self.assertEqual(price["converted_prices"]["USD"], 2.0)
        self.assertIsNone(price["converted_prices"]["SYP"])
        self.assertFalse(price["price_conversions"]["SYP"]["rate_available"])
        self.assertEqual(price["price_conversions"]["SYP"]["error_code"], "FX_RATE_UNAVAILABLE")
        self.assertEqual(ExchangeRate.objects.count(), before_legacy)
        self.assertEqual(ExchangeRateQuote.objects.count(), before_quotes)

        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/store/user/convert-price/?amount=2&from_currency=USD&to_currency=SYP")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["converted_amount"])
        self.assertFalse(response.data["rate_available"])
        self.assertEqual(response.data["price_conversion"]["error_code"], "FX_RATE_UNAVAILABLE")

    def test_same_currency_preview_needs_no_quote(self):
        result = CurrencyService.convert_product_display(
            amount="12.50", source_currency="USD", target_currency="USD", quote=False,
        )
        self.assertEqual(result["rate_side"], "NONE")
        self.assertEqual(result["converted_amount"], "12.50000000")
        self.assertTrue(result["rate_available"])


class ProductPricingArchitectureTests(TestCase):
    def test_display_pricing_boundary_has_no_fallback_literals(self):
        from pathlib import Path
        root = Path(__file__).resolve().parent
        for filename in ("services/price_service.py", "serializers.py"):
            text = (root / filename).read_text(encoding="utf-8")
            self.assertNotIn("* 116", text, filename)
            self.assertNotIn("1/116", text, filename)
            self.assertNotIn("ExchangeRate.objects", text, filename)
