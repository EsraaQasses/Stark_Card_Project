from rest_framework import serializers
from .models import ExchangeRate, ExchangeRateQuote, Wallet
from decimal import Decimal
from .display import wallet_equivalents
from .rate_quotes import ExchangeRateQuoteService
from .display import convert_display

class WalletSerializer(serializers.ModelSerializer):
    total_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    available_balance_syp = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    pending_balance_syp = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_balance_syp = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    display_conversions = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._display_quote = self.context.get("exchange_rate_quote") or ExchangeRateQuoteService.get_active_quote()
    
    class Meta:
        model = Wallet
        fields = [
            "id", "user", "currency", "available_balance", "pending_balance", "total_balance",
            "available_balance_syp", "pending_balance_syp", "total_balance_syp", "display_conversions"
        ]
        read_only_fields = ["id", "user", "available_balance", "pending_balance", "currency"]

    def get_display_conversions(self, obj):
        quote = self._display_quote
        target = "USD" if obj.currency == "SYP" else "SYP"
        return wallet_equivalents(obj, target_currency=target, quote=quote)

class ExchangeRateSerializer(serializers.ModelSerializer):
    syp_to_usd = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    
    class Meta:
        model = ExchangeRate
        fields = ["id", "usd_to_syp", "syp_to_usd", "updated_at"]
        
    def validate_usd_to_syp(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Exchange rate must be greater than zero")
        return value


class ExchangeRateQuoteSerializer(serializers.ModelSerializer):
    quote_id = serializers.IntegerField(source="id", read_only=True)
    platform_buy_usd_rate_syp = serializers.DecimalField(
        source="platform_buy_base_rate", max_digits=20, decimal_places=6, read_only=True
    )
    platform_sell_usd_rate_syp = serializers.DecimalField(
        source="platform_sell_base_rate", max_digits=20, decimal_places=6, read_only=True
    )
    spread_amount = serializers.SerializerMethodField()
    spread_percentage = serializers.SerializerMethodField()
    rate_available = serializers.SerializerMethodField()
    usd_to_syp = serializers.SerializerMethodField()
    syp_to_usd = serializers.SerializerMethodField()
    error_code = serializers.SerializerMethodField()

    class Meta:
        model = ExchangeRateQuote
        fields = [
            "quote_id", "base_currency", "quote_currency",
            "platform_buy_usd_rate_syp", "platform_sell_usd_rate_syp",
            "status", "source", "effective_at", "superseded_at",
            "created_by", "created_at", "activation_note", "version",
            "spread_amount", "spread_percentage",
            "rate_available", "usd_to_syp", "syp_to_usd", "error_code",
        ]

    def get_spread_amount(self, obj):
        return obj.platform_sell_base_rate - obj.platform_buy_base_rate

    def get_spread_percentage(self, obj):
        return ((obj.platform_sell_base_rate - obj.platform_buy_base_rate) / obj.platform_buy_base_rate * Decimal("100")).quantize(Decimal("0.000001"))

    def get_rate_available(self, obj):
        return obj.status == ExchangeRateQuote.STATUS_ACTIVE

    def get_usd_to_syp(self, obj):
        return str(obj.platform_buy_base_rate)

    def get_syp_to_usd(self, obj):
        if obj.status != ExchangeRateQuote.STATUS_ACTIVE:
            return None
        result = convert_display(
            amount=Decimal("1"), source_currency="SYP", target_currency="USD", quote=obj
        )
        return result["converted_amount"]

    def get_error_code(self, obj):
        return None if obj.status == ExchangeRateQuote.STATUS_ACTIVE else "FX_RATE_UNAVAILABLE"


class ExchangeRateQuoteActivationSerializer(serializers.Serializer):
    platform_buy_usd_rate_syp = serializers.DecimalField(max_digits=20, decimal_places=6)
    platform_sell_usd_rate_syp = serializers.DecimalField(max_digits=20, decimal_places=6)
    activation_note = serializers.CharField()
    expected_current_quote_id = serializers.IntegerField(required=False, allow_null=True)
