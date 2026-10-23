# payment_methods/serializers.py
import json

# stark-image-upload-v1: multipart nested fields and validated image uploads
from rest_framework import serializers
from .models import PaymentMethod, PaymentMethodField, PaymentMethodImage

class PaymentMethodFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethodField
        fields = ["id", "field_name", "field_key", "input_type", "is_required", "placeholder", "order"]

# stark-payment-gallery-v1
class PaymentMethodImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethodImage
        fields = ['id', 'image', 'sort_order']
        read_only_fields = ['id', 'image', 'sort_order']

class PaymentMethodSerializer(serializers.ModelSerializer):
    additional_images = PaymentMethodImageSerializer(many=True, read_only=True)
    fields = PaymentMethodFieldSerializer(many=True, read_only=True)
    
    class Meta:
        model = PaymentMethod
        fields = [
            "id", "title", "name", "icon_url", "account_details",
            "instructions", "note",
            "requires_receipt",
            "is_active", "fields", "additional_images",
            "created_at", "updated_at"
        ]
        read_only_fields = ('created_at', 'updated_at')

class PaymentMethodCreateSerializer(serializers.ModelSerializer):
    fields = PaymentMethodFieldSerializer(many=True, required=False)
    additional_images = PaymentMethodImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = PaymentMethod
        fields = [
            "id", "title", "name", "icon_url", "account_details",
            "instructions", "note",
            "requires_receipt",
            "is_active", "fields", "additional_images"
        ]

    def to_internal_value(self, data):
        # DRF nested serializers do not parse JSON strings inside multipart forms.
        raw_fields = data.get('fields')
        if isinstance(raw_fields, str):
            try:
                parsed = json.loads(raw_fields)
            except (json.JSONDecodeError, TypeError):
                raise serializers.ValidationError({'fields': 'Invalid JSON format.'})
            if not isinstance(parsed, list):
                raise serializers.ValidationError({'fields': 'Expected a list.'})
            cleaned = data.copy()
            cleaned.pop('fields', None)
            result = super().to_internal_value(cleaned)
            child = PaymentMethodFieldSerializer(data=parsed, many=True)
            child.is_valid(raise_exception=True)
            result['fields'] = child.validated_data
            return result
        return super().to_internal_value(data)

    def validate_icon_url(self, value):
        if not value:
            return value
        if getattr(value, 'size', 0) > 5 * 1024 * 1024:
            raise serializers.ValidationError('Image must be 5 MB or smaller.')
        if getattr(value, 'content_type', '').lower() not in ('image/png', 'image/jpeg', 'image/webp'):
            raise serializers.ValidationError('Only PNG, JPG or WEBP images are allowed.')
        return value

    def create(self, validated_data):
        fields_data = validated_data.pop('fields', [])
        payment_method = PaymentMethod.objects.create(**validated_data)
        
        for field_data in fields_data:
            PaymentMethodField.objects.create(payment_method=payment_method, **field_data)
            
        return payment_method

    def update(self, instance, validated_data):
        fields_data = validated_data.pop('fields', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if fields_data is not None:
            instance.fields.all().delete()
            for field_data in fields_data:
                PaymentMethodField.objects.create(payment_method=instance, **field_data)
            
        return instance
