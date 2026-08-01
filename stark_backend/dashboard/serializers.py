from rest_framework import serializers
from users.models import User
from wallets.models import Wallet
from wallets.display import wallet_equivalents
from wallets.rate_quotes import ExchangeRateQuoteService
from transactions.models import Transaction
from store.serializers import SectionSerializer as BaseSectionSerializer
from payment_methods.serializers import PaymentMethodSerializer as BasePaymentMethodSerializer

class DashboardUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email", "phone", "role", "agent"]

class WalletSerializer(serializers.ModelSerializer):
    display_conversions = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._display_quote = self.context.get("exchange_rate_quote") or ExchangeRateQuoteService.get_active_quote()

    class Meta:
        model = Wallet
        fields = ["id", "user", "currency", "balance", "display_conversions"]

    def get_display_conversions(self, obj):
        quote = self._display_quote
        target = "USD" if obj.currency == "SYP" else "SYP"
        return wallet_equivalents(obj, target_currency=target, quote=quote)

class TransactionSerializer(serializers.ModelSerializer):
    user = DashboardUserSerializer(read_only=True)
    class Meta:
        model = Transaction
        fields = [
            "id",
            "user",
            "wallet",
            "currency",
            "transaction_type",
            "amount",
            "amount_syp",
            "amount_usd",
            "exchange_rate_used",
            "status",
            "note",
            "related_transaction",
            "external_reference",
            "payment",
            "recipient",
            "recipient_wallet",
            "created_at",
            "updated_at",
            "processed_at",
        ]

class SectionSerializer(BaseSectionSerializer):
    pass

class PaymentMethodSerializer(BasePaymentMethodSerializer):
    pass



