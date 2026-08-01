# payments/serializers.py - FIXED VERSION
from rest_framework import serializers
from .models import Payment, PaymentConfig
from decimal import Decimal
import json
from django.utils import timezone


def format_damascus_datetime(value, fmt):
    """Render aware datetimes using the active Django timezone."""
    if not value:
        return None
    return timezone.localtime(value).strftime(fmt)


class PaymentConfigSerializer(serializers.ModelSerializer):
    """Serializer for payment configuration"""
    class Meta:
        model = PaymentConfig
        fields = ['id', 'profit_percentage', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def validate_profit_percentage(self, value):
        """Validate profit percentage"""
        if value < Decimal('0') or value > Decimal('100'):
            raise serializers.ValidationError(
                "Profit percentage must be between 0 and 100"
            )
        return value


class PaymentCreateSerializer(serializers.Serializer):
    """Serializer for creating new payments"""
    store_product_id = serializers.IntegerField()
    user_inputs = serializers.JSONField()
    wallet_currency = serializers.ChoiceField(choices=[("USD", "USD"), ("SYP", "SYP")], required=False)
    
    def validate_store_product_id(self, value):
        """Validate store product exists and is active"""
        try:
            from store.models import StoreProduct
            store_product = StoreProduct.objects.get(id=value, is_active=True)
            return value
        except ImportError:
            raise serializers.ValidationError("Store app not available")
        except StoreProduct.DoesNotExist:
            raise serializers.ValidationError("Store product not found or inactive")
    
    def validate_user_inputs(self, value):
        """Validate user inputs JSON"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("User inputs must be a JSON object")
        return value


class PaymentSerializer(serializers.ModelSerializer):
    """Main payment serializer for user views"""
    store_product_name = serializers.CharField(source='store_product.name', read_only=True)
    store_product_price = serializers.DecimalField(
        source='store_product.price', 
        max_digits=10, 
        decimal_places=2, 
        read_only=True
    )
    store_product_currency = serializers.CharField(source='store_product.currency', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    status_display = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()
    profit_amount = serializers.SerializerMethodField()
    gamer_id = serializers.SerializerMethodField()
    selected_option = serializers.SerializerMethodField()
    is_refundable = serializers.BooleanField(read_only=True)
    can_be_cancelled = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'user', 'user_name', 'store_product', 'store_product_name', 
            'store_product_price', 'store_product_currency', 'base_price', 'profit_percentage', 'profit_amount',
            'final_price', 'currency', 'amount_usd', 'amount_syp', 'exchange_rate_used', 'exchange_rate_quote',
            'exchange_rate_side', 'source_amount', 'source_currency', 'target_amount', 'target_currency',
            'rounding_mode', 'operation_context', 'wallet', 'status', 'status_display', 'external_transaction_id',
            'image_url', 'image_source', 'image_available', 'image_is_fallback',
            'error_message', 'user_inputs', 'gamer_id', 'selected_option', 'notes', 'is_refundable', 'can_be_cancelled',
            'created_at', 'created_at_formatted', 'updated_at', 'processed_at',
            'refunded_at', 'refunded_by'
        ]
        read_only_fields = fields
    
    def get_status_display(self, obj):
        """Get human-readable status"""
        return dict(Payment.STATUS_CHOICES).get(obj.status, obj.status)
    
    def get_created_at_formatted(self, obj):
        """Format created date"""
        return format_damascus_datetime(obj.created_at, '%Y-%m-%d %H:%M:%S')
    
    def get_profit_amount(self, obj):
        """Get calculated profit amount"""
        return float(obj.get_profit_amount())

    def get_gamer_id(self, obj):
        """Expose gamer_id from user_inputs for payment record"""
        if isinstance(obj.user_inputs, dict):
            return obj.user_inputs.get('gamer_id') or obj.user_inputs.get('player_id')
        return None

    def get_selected_option(self, obj):
        """Expose selected_option from user_inputs for payment record"""
        if isinstance(obj.user_inputs, dict):
            return obj.user_inputs.get('selected_option')
        return None


class PaymentStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating payment status"""
    status = serializers.ChoiceField(choices=Payment.STATUS_CHOICES)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_status(self, value):
        """Validate status transition"""
        payment = self.context.get('payment')
        if payment and payment.status == 'success' and value != 'refunded':
            raise serializers.ValidationError(
                "Cannot change status of completed payment. Use refund instead."
            )
        return value


class PaymentRefundSerializer(serializers.Serializer):
    """Serializer for refunding payments"""
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)
    
    def validate(self, attrs):
        """Validate refund request"""
        payment = self.context.get('payment')
        if not payment:
            raise serializers.ValidationError("Payment not found")
        
        if not payment.is_refundable:
            raise serializers.ValidationError("Payment cannot be refunded")
        
        return attrs


class PaymentListSerializer(serializers.ModelSerializer):
    """Serializer for listing payments with minimal info"""
    store_product_name = serializers.CharField(source='store_product.name', read_only=True)
    created_at_formatted = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id', 'store_product_name', 'final_price', 'currency', 'status',
            'status_display', 'created_at', 'created_at_formatted'
        ]
        read_only_fields = fields
    
    def get_created_at_formatted(self, obj):
        """Format created date"""
        return format_damascus_datetime(obj.created_at, '%Y-%m-%d %H:%M')
    
    def get_status_display(self, obj):
        """Get human-readable status"""
        return dict(Payment.STATUS_CHOICES).get(obj.status, obj.status)


class PaymentStatisticsSerializer(serializers.Serializer):
    """Serializer for payment statistics"""
    total_payments = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    successful_payments = serializers.IntegerField()
    successful_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    failed_payments = serializers.IntegerField()
    pending_payments = serializers.IntegerField()
    refunded_payments = serializers.IntegerField()
    refunded_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    average_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    success_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    
    def to_representation(self, instance):
        """Format success rate as percentage"""
        data = super().to_representation(instance)
        data['success_rate'] = f"{data['success_rate']}%"
        return data
