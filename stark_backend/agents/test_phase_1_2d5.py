from decimal import Decimal
from pathlib import Path

from django.test import TestCase

from agents.models import AgentProfile
from agents.services.commission_service import credit_agent_commission, reverse_agent_commission
from finance.conversion import CurrencyConversionService, RateSide
from finance.services import FinanceService
from transactions.models import Transaction
from users.models import User
from wallets.models import Wallet


class CommissionSnapshotTests(TestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            name="d5-agent", email="d5-agent@example.com", password="Password-9!", role="agent"
        )
        self.user = User.objects.create_user(
            name="d5-user", email="d5-user@example.com", password="Password-9!", role="user"
        )
        self.user.agent = self.agent
        self.user.save(update_fields=["agent"])
        AgentProfile.objects.create(user=self.agent, commission_rate=Decimal("10"))
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.wallet.available_balance = Decimal("100")
        self.wallet.save(update_fields=["available_balance"])

    def test_same_currency_commission_captures_source_and_is_idempotent(self):
        conversion = CurrencyConversionService.convert(
            amount="20", source_currency="USD", target_currency="USD",
            rate_side=RateSide.NONE, operation_type="purchase_same_currency",
        )
        source = FinanceService.withdraw(
            wallet_id=self.wallet.id, amount="20", transaction_type="purchase",
            idempotency_key="d5-source", conversion_result=conversion,
        )
        FinanceService.approve(source.id)
        amount = credit_agent_commission(self.user, "20", "USD", source_tx=source)
        replay = credit_agent_commission(self.user, "20", "USD", source_tx=source)
        self.assertEqual(amount, Decimal("2.0000"))
        self.assertEqual(replay, amount)
        commissions = Transaction.objects.filter(transaction_type="commission")
        self.assertEqual(commissions.count(), 1)
        commission = commissions.get()
        self.assertEqual(commission.exchange_rate_side, RateSide.NONE.value)
        self.assertEqual(commission.related_transaction_id, source.id)
        self.assertEqual(commission.operation_context["commission"]["source_transaction_id"], source.id)

    def test_reversal_uses_exact_original_amount_and_is_idempotent(self):
        source = FinanceService.withdraw(
            wallet_id=self.wallet.id, amount="20", transaction_type="purchase",
            idempotency_key="d5-source-reversal",
            conversion_result=CurrencyConversionService.convert(
                amount="20", source_currency="USD", target_currency="USD",
                rate_side=RateSide.NONE, operation_type="purchase_same_currency",
            ),
        )
        FinanceService.approve(source.id)
        credit_agent_commission(self.user, "20", "USD", source_tx=source)
        commission = Transaction.objects.get(transaction_type="commission")
        reversal = reverse_agent_commission(commission.id, reason="provider compensation")
        replay = reverse_agent_commission(commission.id, reason="provider compensation")
        self.assertEqual(reversal.id, replay.id)
        self.assertEqual(reversal.amount, Decimal("-2.00000000"))
        self.assertEqual(reversal.related_transaction_id, commission.id)
        self.assertEqual(reversal.exchange_rate_side, RateSide.NONE.value)

    def test_commission_architecture_has_no_legacy_rate_or_wallet_mutation(self):
        source = Path(__file__).with_name("services").joinpath("commission_service.py").read_text(encoding="utf-8")
        self.assertNotIn("ExchangeRate.objects", source)
        self.assertNotIn("ExchangeService", source)
        self.assertNotIn("116", source)
        self.assertNotIn("syp_to_usd", source)
        self.assertNotIn("available_balance =", source)
