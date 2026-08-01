from decimal import Decimal
from pathlib import Path

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from wallets.display import convert_display, wallet_equivalents
from wallets.models import ExchangeRate, ExchangeRateQuote, Wallet
from wallets.rate_quotes import ExchangeRateQuoteService
from wallets.serializers import WalletSerializer


class WalletDisplayMigrationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            name="display-admin", full_name="Display Admin", email="display-admin@example.com",
            password="Password-9!", role="admin",
        )
        self.user = User.objects.create_user(
            name="display-user", full_name="Display User", email="display-user@example.com",
            password="Password-9!",
        )
        self.usd = Wallet.objects.get(user=self.user, currency="USD")
        self.syp = Wallet.objects.get(user=self.user, currency="SYP")
        self.usd.available_balance = Decimal("2")
        self.usd.pending_balance = Decimal("0.5")
        self.syp.available_balance = Decimal("30000")
        self.syp.pending_balance = Decimal("5000")
        self.usd.save(update_fields=["available_balance", "pending_balance"])
        self.syp.save(update_fields=["available_balance", "pending_balance"])

    def test_wallet_display_uses_explicit_sides_and_metadata(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin,
            activation_note="D1 display quote",
        )
        usd = wallet_equivalents(self.usd, target_currency="SYP", quote=quote)
        syp = wallet_equivalents(self.syp, target_currency="USD", quote=quote)
        self.assertEqual(usd["available"]["converted_amount"], "20000.00000000")
        self.assertEqual(usd["pending"]["converted_amount"], "5000.00000000")
        self.assertEqual(usd["available"]["rate_side"], "PLATFORM_BUYS_BASE")
        self.assertEqual(syp["available"]["converted_amount"], "3.00000000")
        self.assertEqual(syp["pending"]["converted_amount"], "0.50000000")
        self.assertEqual(syp["available"]["rate_side"], "PLATFORM_SELLS_BASE")
        for item in (usd["available"], usd["pending"], syp["available"], syp["pending"]):
            self.assertTrue(item["rate_available"])
            self.assertEqual(item["quote_id"], quote.id)
            self.assertEqual(item["quote_version"], quote.version)
            self.assertTrue(item["display_only"])
            self.assertIsInstance(item["converted_amount"], str)

    def test_same_currency_display_is_available_without_quote(self):
        result = convert_display(
            amount="12.5", source_currency="USD", target_currency="USD"
        )
        self.assertTrue(result["rate_available"])
        self.assertEqual(result["rate_side"], "NONE")
        self.assertEqual(result["converted_amount"], "12.50000000")
        self.assertTrue(result["display_only"])

    def test_no_quote_preserves_native_balances_and_returns_unavailable_metadata(self):
        before_legacy = ExchangeRate.objects.count()
        before_quotes = ExchangeRateQuote.objects.count()
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/wallets/wallet/USD/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["available"], 2.0)
        self.assertFalse(response.data["rate_available"])
        self.assertEqual(response.data["error_code"], "FX_RATE_UNAVAILABLE")
        self.assertIsNone(response.data["converted"]["available"]["converted_amount"])
        self.assertEqual(response.data["converted"]["available"]["error_code"], "FX_RATE_UNAVAILABLE")
        self.assertEqual(ExchangeRate.objects.count(), before_legacy)
        self.assertEqual(ExchangeRateQuote.objects.count(), before_quotes)

    def test_wallet_serializer_keeps_legacy_fields_nullable_and_adds_metadata(self):
        data = WalletSerializer(self.usd).data
        self.assertIsNone(data["available_balance_syp"])
        self.assertIsNone(data["pending_balance_syp"])
        self.assertFalse(data["display_conversions"]["available"]["rate_available"])
        self.assertIsNone(data["display_conversions"]["available"]["converted_amount"])


class WalletDisplayArchitectureTests(TestCase):
    def test_display_adapter_contains_no_legacy_fallback_or_manual_reciprocal(self):
        paths = [Path(__file__).with_name("display.py")]
        findings = []
        for path in paths:
            text = path.read_text(encoding="utf-8")
            if "116" in text or "ExchangeRate.objects" in text or "1 /" in text:
                findings.append(path.name)
        services_text = Path(__file__).with_name("services.py").read_text(encoding="utf-8")
        wallet_service_text = services_text.split("class WalletService:", 1)[1]
        if "116" in wallet_service_text or "ExchangeRate.objects" in wallet_service_text or "1 /" in wallet_service_text:
            findings.append("WalletService")
        self.assertEqual([], findings)
