from decimal import Decimal
from pathlib import Path

from django.test import TestCase

from agents.models import AgentProfile
from finance.conversion import RateSide, RateUnavailable
from transactions.models import Transaction
from users.models import User
from wallets.models import ExchangeRateQuote, Wallet
from wallets.rate_quotes import ExchangeRateQuoteService

from .financial_service import (
    CashoutStateConflict,
    ShippingFinanceService,
)
from .models import AgentAdminShippingRequest, AgentShippingRequest, StandardShippingRequest


class ShippingCashoutMigrationTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            name="d4-admin", email="d4-admin@example.com", password="Password-9!"
        )
        self.user = User.objects.create_user(
            name="d4-user", email="d4-user@example.com", password="Password-9!"
        )
        self.agent = User.objects.create_user(
            name="d4-agent", email="d4-agent@example.com", password="Password-9!", role="agent"
        )
        self.quote = ExchangeRateQuoteService.activate_quote(
            buy_rate="10000", sell_rate="10000", actor=self.admin,
            activation_note="D4 zero-spread test quote",
        )

    def wallet(self, user, currency, balance="0"):
        wallet = Wallet.objects.get(user=user, currency=currency)
        wallet.available_balance = Decimal(balance)
        wallet.pending_balance = Decimal("0")
        wallet.save(update_fields=["available_balance", "pending_balance"])
        return wallet

    def test_standard_cross_currency_captures_buy_snapshot_and_approves_exact_amount(self):
        self.wallet(self.user, "SYP")
        request = StandardShippingRequest.objects.create(
            user=self.user, amount=Decimal("2"), currency="USD", wallet_currency="SYP"
        )
        context = ShippingFinanceService.ensure_snapshot(
            request, target_currency="SYP", credited_wallet_id=Wallet.objects.get(user=self.user, currency="SYP").id
        )
        self.assertEqual(context.conversion.rate_side, RateSide.PLATFORM_BUYS_BASE)
        self.assertEqual(context.credited_amount, Decimal("20000.00000000"))
        tx = ShippingFinanceService.process_shipping(request, approver=self.admin)
        self.assertEqual(tx.target_amount, Decimal("20000.00000000"))
        self.assertEqual(tx.exchange_rate_quote_id, self.quote.id)
        self.assertEqual(tx.exchange_rate_side, RateSide.PLATFORM_BUYS_BASE.value)

    def test_syp_to_usd_uses_sell_snapshot(self):
        self.wallet(self.user, "USD")
        request = StandardShippingRequest.objects.create(
            user=self.user, amount=Decimal("25000"), currency="SYP", wallet_currency="USD"
        )
        context = ShippingFinanceService.ensure_snapshot(
            request, target_currency="USD", credited_wallet_id=Wallet.objects.get(user=self.user, currency="USD").id
        )
        self.assertEqual(context.conversion.rate_side, RateSide.PLATFORM_SELLS_BASE)
        self.assertEqual(context.credited_amount, Decimal("2.50000000"))

    def test_same_currency_works_without_quote_and_duplicate_approval_replays(self):
        ExchangeRateQuote.objects.all().update(status=ExchangeRateQuote.STATUS_SUPERSEDED)
        self.wallet(self.user, "USD")
        request = StandardShippingRequest.objects.create(
            user=self.user, amount=Decimal("10"), currency="USD", wallet_currency="USD"
        )
        tx = ShippingFinanceService.process_shipping(request, approver=self.admin)
        replay = ShippingFinanceService.process_shipping(request, approver=self.admin)
        self.assertEqual(tx.id, replay.id)
        self.assertEqual(tx.exchange_rate_side, RateSide.NONE.value)
        self.assertEqual(Wallet.objects.get(user=self.user, currency="USD").available_balance, Decimal("10.00000000"))

    def test_cross_currency_requires_quote_before_mutation(self):
        ExchangeRateQuote.objects.all().update(status=ExchangeRateQuote.STATUS_SUPERSEDED)
        with self.assertRaises(RateUnavailable):
            ShippingFinanceService.prepare(
                flow_type="shipping", user_id=self.user.id, amount="1",
                submitted_currency="USD", target_currency="SYP",
            )
        self.assertFalse(Transaction.objects.filter(user=self.user).exists())

    def test_quote_supersession_does_not_change_captured_shipping_amount(self):
        self.wallet(self.user, "SYP")
        request = StandardShippingRequest.objects.create(
            user=self.user, amount=Decimal("1"), currency="USD", wallet_currency="SYP"
        )
        ShippingFinanceService.ensure_snapshot(
            request, target_currency="SYP", credited_wallet_id=Wallet.objects.get(user=self.user, currency="SYP").id
        )
        ExchangeRateQuoteService.activate_quote(
            buy_rate="12000", sell_rate="12000", actor=self.admin,
            activation_note="D4 replacement quote",
        )
        tx = ShippingFinanceService.process_shipping(request, approver=self.admin)
        self.assertEqual(tx.target_amount, Decimal("10000.00000000"))
        self.assertEqual(tx.exchange_rate_quote_id, self.quote.id)

    def test_agent_admin_cross_currency_credits_exact_target(self):
        self.wallet(self.agent, "SYP")
        request = AgentAdminShippingRequest.objects.create(
            agent=self.agent, amount=Decimal("3"), currency="USD", wallet_currency="SYP"
        )
        tx = ShippingFinanceService.process_shipping(request, approver=self.admin)
        self.assertEqual(tx.target_amount, Decimal("30000.00000000"))
        self.assertEqual(tx.exchange_rate_side, RateSide.PLATFORM_BUYS_BASE.value)

    def test_cashout_approval_uses_reservation_snapshot_after_quote_change(self):
        source = self.wallet(self.user, "USD", "5")
        recipient = self.agent
        tx, context = ShippingFinanceService.reserve_cashout(
            user=self.user, wallet=source, amount="2", payout_currency="SYP",
            recipient=recipient, operation_key="d4-cashout-1",
        )
        self.assertEqual(tx.target_amount, Decimal("20000.00000000"))
        ExchangeRateQuoteService.activate_quote(
            buy_rate="12000", sell_rate="12000", actor=self.admin,
            activation_note="D4 cashout replacement",
        )
        finalized, target_wallet, replayed = ShippingFinanceService.finalize_cashout(
            transaction_id=tx.id, approver=self.admin
        )
        self.assertFalse(replayed)
        self.assertEqual(finalized.target_amount, Decimal("20000.00000000"))
        self.assertEqual(target_wallet.currency, "SYP")
        self.assertEqual(Wallet.objects.get(user=recipient, currency="SYP").available_balance, Decimal("20000.00000000"))

    def test_cashout_rejection_is_idempotent_and_approval_conflicts(self):
        source = self.wallet(self.user, "USD", "5")
        tx, _ = ShippingFinanceService.reserve_cashout(
            user=self.user, wallet=source, amount="2", payout_currency="USD",
            recipient=self.agent, operation_key="d4-cashout-2",
        )
        rejected, _ = ShippingFinanceService.reject_cashout(transaction_id=tx.id, approver=self.admin)
        replay, _ = ShippingFinanceService.reject_cashout(transaction_id=tx.id, approver=self.admin)
        self.assertEqual(rejected.id, replay.id)
        with self.assertRaises(CashoutStateConflict):
            ShippingFinanceService.finalize_cashout(transaction_id=tx.id, approver=self.admin)
        source.refresh_from_db()
        self.assertEqual(source.available_balance, Decimal("5.00000000"))
        self.assertEqual(source.pending_balance, Decimal("0.00000000"))

    def test_cashout_retry_reuses_original_snapshot(self):
        source = self.wallet(self.user, "USD", "5")
        tx, original = ShippingFinanceService.reserve_cashout(
            user=self.user, wallet=source, amount="1", payout_currency="SYP",
            recipient=self.agent, operation_key="d4-cashout-retry",
        )
        ExchangeRateQuoteService.activate_quote(
            buy_rate="13000", sell_rate="13000", actor=self.admin,
            activation_note="D4 retry quote",
        )
        replay, retried = ShippingFinanceService.reserve_cashout(
            user=self.user, wallet=source, amount="1", payout_currency="SYP",
            recipient=self.agent, operation_key="d4-cashout-retry",
        )
        self.assertEqual(replay.id, tx.id)
        self.assertEqual(retried.credited_amount, original.credited_amount)
        self.assertEqual(retried.conversion.quote_id, original.conversion.quote_id)

    def test_active_shipping_modules_have_no_116_or_legacy_rate_lookup(self):
        views = Path(__file__).with_name("views.py").read_text(encoding="utf-8")
        orchestration = Path(__file__).with_name("financial_service.py").read_text(encoding="utf-8")
        self.assertNotIn("116", views)
        self.assertNotIn("ExchangeRate.objects", views)
        self.assertNotIn("ExchangeRate.objects", orchestration)
        self.assertNotIn("available_balance =", orchestration)
