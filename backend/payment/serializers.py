# payments/serializers.py
from rest_framework import serializers
from .models import Payment, PaymentConfig
from store.models import StoreProduct
from wallets.models import Wallet

class PaymentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentConfig
        fields = ['profit_percentage', 'updated_at']
        read_only_fields = ['updated_at']

class PaymentCreateSerializer(serializers.Serializer):
    store_product_id = serializers.IntegerField()
    user_inputs = serializers.JSONField()
    
    def validate_store_product_id(self, value):
        try:
            store_product = StoreProduct.objects.get(id=value, is_active=True)
            return value
        except StoreProduct.DoesNotExist:
            raise serializers.ValidationError("Store product not found or inactive")
    
    def validate_user_inputs(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("User inputs must be a JSON object")
        return value

class PaymentSerializer(serializers.ModelSerializer):
    store_product_name = serializers.CharField(source='store_product.name', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    wallet_currency = serializers.CharField(source='wallet.currency', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'user', 'user_name', 'store_product', 'store_product_name',
            'base_price', 'profit_percentage', 'final_price', 'user_inputs',
            'status', 'external_transaction_id', 'error_message',
            'created_at', 'updated_at', 'processed_at', 'wallet_currency'
        ]
        read_only_fields = [
            'id', 'user', 'base_price', 'profit_percentage', 'final_price',
            'status', 'external_transaction_id', 'error_message',
            'created_at', 'updated_at', 'processed_at'
        ]