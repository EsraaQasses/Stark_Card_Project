from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from finance.services import FinanceService
from transactions.models import Transaction
from users.models import User
from wallets.models import ExchangeRateQuote, Wallet
from wallets.services import WalletService


class WalletEndpointFlowTests(TestCase):
    """API-level coverage for wallet reads, ledger transitions, and transfers."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            name="wallet_endpoint_admin",
            email="wallet_endpoint_admin@example.test",
            password="AdminPassword123!",
            full_name="Wallet Endpoint Admin",
        )
        self.user = User.objects.create_user(
            name="wallet_endpoint_user",
            email="wallet_endpoint_user@example.test",
            password="UserPassword123!",
            full_name="Wallet Endpoint User",
            phone="+963951111111",
        )
        self.recipient = User.objects.create_user(
            name="wallet_endpoint_recipient",
            email="wallet_endpoint_recipient@example.test",
            password="RecipientPassword123!",
            full_name="Wallet Endpoint Recipient",
            phone="+963952222222",
        )
        self.client.force_authenticate(self.user)

    def test_authenticated_wallet_read_endpoints(self):
        for path in (
            "/api/wallets/wallet/",
            "/api/wallets/wallet/USD/",
            "/api/wallets/wallet/SYP/",
            "/api/wallets/wallet/transactions/",
            "/api/wallets/exchange-rate/",
            "/api/wallets/exchange-rates/history/",
        ):
            response = self.client.get(path)
            self.assertIn(response.status_code, (200, 503), (path, response.data))

    def test_wallet_read_with_active_quote_and_zero_balances(self):
        ExchangeRateQuote.objects.create(
            platform_buy_base_rate=Decimal("116"),
            platform_sell_base_rate=Decimal("116"),
            status=ExchangeRateQuote.STATUS_ACTIVE,
            source="manual",
            effective_at=timezone.now(),
            created_by=self.admin,
            activation_note="Zero-balance display regression test",
        )
        response = self.client.get("/api/wallets/wallet/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data["USD"]["display_conversion"]["available"]["converted_amount"],
            "0.00000000",
        )
        self.assertEqual(
            response.data["SYP"]["display_conversion"]["total"]["converted_amount"],
            "0.00000000",
        )

    def test_wallet_read_keeps_equivalents_when_display_conversion_fails(self):
        from unittest.mock import patch

        with patch(
            "wallets.services.wallet_equivalents",
            side_effect=RuntimeError("simulated display failure"),
        ):
            fallback_data = WalletService.get_wallet_data(self.user)
            response = self.client.get("/api/wallets/wallet/")

        self.assertIn("equivalents", fallback_data)
        self.assertIn("USD", fallback_data["equivalents"])
        self.assertIn("SYP", fallback_data["equivalents"])
        self.assertEqual(response.status_code, 200, response.data)

    def test_currency_preference_and_invalid_currency(self):
        response = self.client.put(
            "/api/wallets/change-currency/", {"currency": "SYP"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.currency_preference, "SYP")

        invalid = self.client.put(
            "/api/wallets/change-currency/", {"currency": "EUR"}, format="json"
        )
        self.assertEqual(invalid.status_code, 400)

    def test_deposit_approval_and_withdrawal_flow(self):
        wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.assertEqual(wallet.available_balance, Decimal("0"))

        deposit = self.client.post(
            "/api/wallets/wallet/deposit/",
            {"amount": "10.00", "currency": "USD", "note": "Endpoint test"},
            format="json",
        )
        self.assertEqual(deposit.status_code, 200, deposit.data)
        deposit_tx = Transaction.objects.get(pk=deposit.data["transaction_id"])
        self.assertEqual(deposit_tx.status, "pending")
        wallet.refresh_from_db()
        self.assertEqual(wallet.available_balance, Decimal("0"))
        self.assertEqual(wallet.pending_balance, Decimal("10.00"))

        self.client.force_authenticate(self.admin)
        approved = self.client.post(
            f"/api/transactions/approve/{deposit_tx.id}/",
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(approved.status_code, 200, approved.data)
        wallet.refresh_from_db()
        self.assertEqual(wallet.available_balance, Decimal("10.00"))
        self.assertEqual(wallet.pending_balance, Decimal("0"))

        self.client.force_authenticate(self.user)
        withdrawal = self.client.post(
            "/api/wallets/wallet/withdraw/",
            {"amount": "4.00", "currency": "USD", "note": "Endpoint test"},
            format="json",
        )
        self.assertEqual(withdrawal.status_code, 200, withdrawal.data)
        self.assertEqual(withdrawal.data["available_balance"], 6.0)
        withdrawal_tx = Transaction.objects.get(pk=withdrawal.data["transaction_id"])
        self.assertEqual(withdrawal_tx.status, "pending")
        wallet.refresh_from_db()
        self.assertEqual(wallet.available_balance, Decimal("6.00"))
        self.assertEqual(wallet.pending_balance, Decimal("4.00"))

        self.client.force_authenticate(self.admin)
        rejected = self.client.post(
            f"/api/transactions/approve/{withdrawal_tx.id}/",
            {"action": "reject"},
            format="json",
        )
        self.assertEqual(rejected.status_code, 200, rejected.data)
        wallet.refresh_from_db()
        self.assertEqual(wallet.available_balance, Decimal("10.00"))
        self.assertEqual(wallet.pending_balance, Decimal("0"))

    def test_admin_wallet_endpoints_and_non_admin_denial(self):
        self.assertEqual(
            self.client.get("/api/wallets/admin/wallets-summary/").status_code, 403
        )
        self.assertEqual(
            self.client.get("/api/wallets/admin/wallet-stats/").status_code, 403
        )

        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.get("/api/wallets/admin/wallets-summary/").status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/wallets/admin/wallet-stats/").status_code, 200
        )

    def test_transfer_lookup_and_transfer_flow(self):
        sender_wallet = Wallet.objects.get(user=self.user, currency="USD")
        recipient_wallet = Wallet.objects.get(user=self.recipient, currency="USD")
        deposit = FinanceService.deposit(
            wallet_id=sender_wallet.id, amount=Decimal("20.00"), note="Transfer seed"
        )
        FinanceService.approve(deposit.id, admin_user=self.admin)

        lookup = self.client.get(
            "/api/transactions/transfer/lookup/",
            {"phone": self.recipient.phone},
        )
        self.assertEqual(lookup.status_code, 200, lookup.data)
        self.assertEqual(lookup.data["id"], self.recipient.id)

        transfer = self.client.post(
            "/api/transactions/transfer/",
            {
                "wallet_id": sender_wallet.id,
                "recipient_id": self.recipient.id,
                "amount": "7.50",
                "idempotency_key": "wallet-endpoint-transfer-001",
            },
            format="json",
        )
        self.assertEqual(transfer.status_code, 201, transfer.data)
        sender_wallet.refresh_from_db()
        recipient_wallet.refresh_from_db()
        self.assertEqual(sender_wallet.available_balance, Decimal("12.50"))
        self.assertEqual(recipient_wallet.available_balance, Decimal("7.50"))

        self.client.force_authenticate(self.recipient)
        history = self.client.get("/api/transactions/transactions/", {"transaction_type": "transfer"})
        self.assertEqual(history.status_code, 200, history.data)
        received = next(item for item in history.data if item["direction"] == "in")
        self.assertEqual(received["amount"], "7.50000000")
        self.assertEqual(received["sender_name"], "Wallet Endpoint User")
        self.assertEqual(received["status"], "approved")
        self.assertIsNotNone(received["created_at"])

    def test_invalid_deposit_withdrawal_and_transfer_inputs(self):
        responses = []
        for path in (
            "/api/wallets/wallet/deposit/",
            "/api/wallets/wallet/withdraw/",
        ):
            response = self.client.post(path, {"amount": "not-a-number"}, format="json")
            responses.append((path, response))
        for path, response in responses:
            self.assertEqual(response.status_code, 400, (path, response.data))

        transfer = self.client.post(
            "/api/transactions/transfer/",
            {"wallet_id": Wallet.objects.get(user=self.user, currency="USD").id, "amount": "1"},
            format="json",
        )
        self.assertEqual(transfer.status_code, 400)
