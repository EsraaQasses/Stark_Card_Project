from rest_framework import serializers
from .models import ThirdPartyAPI, APITransaction

class ThirdPartyAPISerializer(serializers.ModelSerializer):
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    is_connected = serializers.BooleanField(read_only=True)
    api_key_set = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ThirdPartyAPI
        fields = [
            'id', 'name', 'provider', 'provider_display', 'description',
            'base_url', 'is_active', 'max_daily_limit', 'priority',
            'is_connected', 'api_key_set', 'products_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_api_key_set(self, obj):
        return bool(obj.encrypted_api_key)

    def get_products_count(self, obj):
        try:
            from store.models import ExternalProduct
            return ExternalProduct.objects.filter(api_config=obj).count()
        except Exception:
            return 0
    
    def validate(self, attrs):
        return attrs

class ThirdPartyAPICreateSerializer(ThirdPartyAPISerializer):
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta(ThirdPartyAPISerializer.Meta):
        fields = ThirdPartyAPISerializer.Meta.fields + ['api_key']
    
    def create(self, validated_data):
        api_key = validated_data.pop('api_key', None)
        instance = super().create(validated_data)
        if api_key:
            instance.set_api_key(api_key)
            instance.save()
        return instance
    
    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        instance = super().update(instance, validated_data)
        if api_key is not None:
            instance.set_api_key(api_key or None)
            instance.save()
        return instance

class APITransactionSerializer(serializers.ModelSerializer):
    api_name = serializers.CharField(source='api_config.name', read_only=True)
    provider = serializers.CharField(source='api_config.provider', read_only=True)
    
    class Meta:
        model = APITransaction
        fields = [
            'id', 'api_config', 'api_name', 'provider', 'internal_transaction',
            'endpoint_used', 'request_payload', 'response_payload',
            'http_status_code', 'success', 'error_message',
            'external_transaction_id', 'request_timestamp', 'response_timestamp',
            'created_at'
        ]
        read_only_fields = ['created_at']
