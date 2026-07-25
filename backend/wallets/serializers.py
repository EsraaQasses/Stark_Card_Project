from rest_framework import serializers
from .models import ExchangeRate, Wallet
from decimal import Decimal

class WalletSerializer(serializers.ModelSerializer):
    total_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Wallet
        fields = ["id", "user", "currency", "available_balance", "pending_balance", "total_balance"]
        read_only_fields = ["id", "user", "available_balance", "pending_balance"]

class ExchangeRateSerializer(serializers.ModelSerializer):
    syp_to_usd = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    
    class Meta:
        model = ExchangeRate
        fields = ["id", "usd_to_syp", "syp_to_usd", "updated_at"]
        
    def validate_usd_to_syp(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Exchange rate must be greater than zero")
        return value