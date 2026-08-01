from decimal import Decimal
from threading import Barrier, Thread
from unittest import skipUnless
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection, close_old_connections
from django.core.exceptions import ValidationError
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from users.models import User
from wallets.models import ExchangeRateQuote, Wallet
from wallets.rate_quotes import ExchangeRateQuoteService, QuoteConflict
from wallets.services import ExchangeService
from wallets.signals import create_user_wallet


class WalletSignalTests(TestCase):
    def test_create_user_wallet_skips_raw_fixture_loads(self):
        user = User.objects.create_user(name="fixture_user", password="pass12345", full_name="Fixture User")

        Wallet.objects.filter(user=user).delete()
        create_user_wallet(sender=User, instance=user, created=True, raw=True)

        self.assertFalse(Wallet.objects.filter(user=user).exists())


class ExchangeRateQuoteTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            name="quote-admin", full_name="Quote Admin", email="quote-admin@example.com",
            password="Password-9!", role="admin",
        )
        cache.clear()

    def test_activation_creates_zero_spread_quote_and_audit(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin,
            activation_note="Initial zero-spread quote",
        )
        self.assertEqual(quote.status, ExchangeRateQuote.STATUS_ACTIVE)
        self.assertEqual(quote.platform_buy_base_rate, Decimal("10000.000000"))
        self.assertEqual(quote.platform_sell_base_rate, Decimal("10000.000000"))
        self.assertEqual(quote.version, 1)
        self.assertTrue(self.admin.audit_logs.filter(action="RATE_ACTIVATED", resource_id=quote.id).exists())

    def test_unequal_spread_is_accepted_after_consumer_migration(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10500", actor=self.admin,
            activation_note="Enable separate buy and sell rates",
        )
        self.assertEqual(quote.platform_buy_base_rate, Decimal("10000.000000"))
        self.assertEqual(quote.platform_sell_base_rate, Decimal("10500.000000"))

    def test_model_constraints_and_draft_editing(self):
        draft = ExchangeRateQuote.objects.create(
            platform_buy_base_rate=Decimal("10000"),
            platform_sell_base_rate=Decimal("10000"),
            activation_note="Draft",
        )
        draft.platform_buy_base_rate = Decimal("10001")
        draft.platform_sell_base_rate = Decimal("10001")
        draft.save()
        self.assertEqual(draft.platform_buy_base_rate, Decimal("10001.000000"))
        with self.assertRaises(ValidationError):
            ExchangeRateQuote(
                base_currency="USD", quote_currency="USD",
                platform_buy_base_rate=Decimal("10000"), platform_sell_base_rate=Decimal("10000"),
            ).full_clean()
        with self.assertRaises(ValidationError):
            ExchangeRateQuote(
                platform_buy_base_rate=Decimal("10001"), platform_sell_base_rate=Decimal("10000"),
            ).full_clean()

    def test_no_active_quote_is_explicitly_unavailable(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get("/api/wallets/exchange-rates/current/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["code"], "FX_RATE_UNAVAILABLE")

    def test_exchange_service_caches_quote_identity_and_legacy_aliases(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="Cache quote"
        )
        rates = ExchangeService.get_exchange_rates()
        self.assertEqual(rates["quote_id"], quote.id)
        self.assertEqual(cache.get(ExchangeRateQuoteService.cache_key(quote))["quote_id"], quote.id)

    def test_superseding_is_immutable_and_versions_increase(self):
        first = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="First"
        )
        with self.captureOnCommitCallbacks(execute=True):
            second = ExchangeRateQuoteService.activate_quote(
                buy_rate="10100", sell_rate="10100", actor=self.admin,
                activation_note="Second", expected_current_quote_id=first.id,
            )
        first.refresh_from_db()
        self.assertEqual(first.status, ExchangeRateQuote.STATUS_SUPERSEDED)
        self.assertEqual(second.version, first.version + 1)
        with self.assertRaises(ValidationError):
            first.platform_buy_base_rate = Decimal("9999")
            first.save()
        with self.assertRaises(ValidationError):
            first.status = ExchangeRateQuote.STATUS_ACTIVE
            first.save()
        with self.assertRaises(ValidationError):
            first.delete()

    def test_stale_expected_quote_conflicts(self):
        first = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="First"
        )
        ExchangeRateQuoteService.activate_quote(
            buy_rate="10100", sell_rate="10100", actor=self.admin,
            activation_note="Second", expected_current_quote_id=first.id,
        )
        with self.assertRaises(QuoteConflict):
            ExchangeRateQuoteService.activate_quote(
                buy_rate="10200", sell_rate="10200", actor=self.admin,
                activation_note="Stale", expected_current_quote_id=first.id,
            )

    def test_cache_invalidation_happens_after_commit(self):
        first = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="First"
        )
        old_key = ExchangeRateQuoteService.cache_key(first)
        cache.set(old_key, {"quote_id": first.id})
        with self.captureOnCommitCallbacks(execute=True):
            second = ExchangeRateQuoteService.activate_quote(
                buy_rate="10100", sell_rate="10100", actor=self.admin,
                activation_note="Second", expected_current_quote_id=first.id,
            )
        self.assertIsNone(cache.get(old_key))
        self.assertNotEqual(old_key, ExchangeRateQuoteService.cache_key(second))

    def test_rollback_keeps_previous_quote_and_cache(self):
        first = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="First"
        )
        old_key = ExchangeRateQuoteService.cache_key(first)
        cache.set(old_key, {"quote_id": first.id})
        with patch("wallets.rate_quotes.AuditLog.objects.create", side_effect=RuntimeError("audit failure")):
            with self.assertRaises(RuntimeError):
                ExchangeRateQuoteService.activate_quote(
                    buy_rate="10100", sell_rate="10100", actor=self.admin,
                    activation_note="Rollback", expected_current_quote_id=first.id,
                )
        first.refresh_from_db()
        self.assertEqual(first.status, ExchangeRateQuote.STATUS_ACTIVE)
        self.assertEqual(cache.get(old_key), {"quote_id": first.id})

    def test_compatibility_endpoint_exposes_legacy_and_explicit_fields(self):
        quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin, activation_note="API quote"
        )
        client = APIClient()
        client.force_authenticate(self.admin)
        response = client.get("/api/wallets/exchange-rate/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["quote_id"], quote.id)
        self.assertEqual(response.data["usd_to_syp"], "10000.000000")
        self.assertEqual(response.data["syp_to_usd"], "0.000100")

    def test_activation_endpoint_requires_admin_and_rejects_stale_quote(self):
        user = User.objects.create_user(name="quote-user", email="quote-user@example.com", password="Password-9!")
        client = APIClient()
        client.force_authenticate(user)
        denied = client.post("/api/wallets/exchange-rates/activate/", {
            "platform_buy_usd_rate_syp": "10000", "platform_sell_usd_rate_syp": "10000",
            "activation_note": "Denied",
        }, format="json")
        self.assertEqual(denied.status_code, 403)
        client.force_authenticate(self.admin)
        first = client.post("/api/wallets/exchange-rates/activate/", {
            "platform_buy_usd_rate_syp": "10000", "platform_sell_usd_rate_syp": "10000",
            "activation_note": "First",
        }, format="json")
        self.assertEqual(first.status_code, 201)
        stale = client.post("/api/wallets/exchange-rates/activate/", {
            "platform_buy_usd_rate_syp": "10100", "platform_sell_usd_rate_syp": "10100",
            "activation_note": "Stale", "expected_current_quote_id": first.data["quote_id"] - 1,
        }, format="json")
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.data["code"], "FX_RATE_STALE_CURRENT_QUOTE")


@skipUnless(connection.vendor == "postgresql", "PostgreSQL quote activation concurrency coverage")
class ExchangeRateQuoteConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def test_concurrent_activation_with_same_expected_quote_has_one_winner(self):
        admin = User.objects.create_user(
            name="concurrent-quote-admin", full_name="Concurrent Quote Admin",
            email="concurrent-quote-admin@example.com", password="Password-9!", role="admin",
        )
        first = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=admin, activation_note="Initial"
        )
        barrier = Barrier(2)
        results = []

        def activate(rate):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                quote = ExchangeRateQuoteService.activate_quote(
                    buy_rate=rate, sell_rate=rate, actor=admin,
                    activation_note=f"Concurrent {rate}", expected_current_quote_id=first.id,
                )
                results.append(("ok", quote.id))
            except QuoteConflict:
                results.append(("conflict", None))
            finally:
                close_old_connections()

        threads = [Thread(target=activate, args=("10100",)), Thread(target=activate, args=("10200",))]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        self.assertCountEqual([result[0] for result in results], ["ok", "conflict"])
        self.assertEqual(ExchangeRateQuote.objects.filter(status="active").count(), 1)
        self.assertEqual(ExchangeRateQuote.objects.filter(status="active").first().version, 2)
