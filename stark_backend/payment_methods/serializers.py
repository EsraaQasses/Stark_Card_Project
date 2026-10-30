# payment_methods/serializers.py
import json

# stark-image-upload-v1: multipart nested fields and validated image uploads
from rest_framework import serializers
from .models import PaymentMethod, PaymentMethodField, PaymentMethodImage
from .media_service import media_transaction, retire_file, save_upload, validate_image

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
            "id", "title", "name", "icon_url", "qr_image", "instruction_image", "currency", "description", "account_details",
            "instructions", "note",
            "requires_receipt",
            "is_active", "fields", "additional_images",
            "created_at", "updated_at"
        ]
        read_only_fields = ('created_at', 'updated_at')

class PaymentMethodCreateSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(required=False, default=True)
    requires_receipt = serializers.BooleanField(required=False, default=True)
    fields = PaymentMethodFieldSerializer(many=True, required=False)
    additional_images = PaymentMethodImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = PaymentMethod
        fields = [
            "id", "title", "name", "icon_url", "qr_image", "instruction_image", "currency", "description", "account_details",
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
        return validate_image(value)

    def validate_instruction_image(self, value):
        return validate_image(value)

    def validate_qr_image(self, value):
        return validate_image(value)

    def create(self, validated_data):
        return self._save(PaymentMethod(), validated_data)

    def update(self, instance, validated_data):
        return self._save(instance, validated_data)

    def _save(self, instance, validated_data):
        fields_data = validated_data.pop('fields', None)
        with media_transaction() as uploaded:
            if instance.pk:
                instance = PaymentMethod.objects.select_for_update().get(pk=instance.pk)
            for name in ('icon_url', 'qr_image', 'instruction_image'):
                if name in validated_data:
                    value = validated_data.pop(name)
                    retire_file(getattr(instance, name))
                    if value:
                        save_upload(instance, name, value, uploaded)
                    else:
                        setattr(instance, name, None)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if fields_data is not None:
                instance.fields.all().delete()
                for field_data in fields_data:
                    PaymentMethodField.objects.create(payment_method=instance, **field_data)
        return instance
