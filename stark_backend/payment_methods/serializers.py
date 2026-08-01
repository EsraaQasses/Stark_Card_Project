# payment_methods/serializers.py
import json
from rest_framework import serializers
from .models import PaymentMethod, PaymentMethodField

class PaymentMethodFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethodField
        fields = ["id", "field_name", "field_key", "input_type", "is_required", "placeholder", "order"]

class PaymentMethodSerializer(serializers.ModelSerializer):
    fields = PaymentMethodFieldSerializer(many=True, read_only=True)
    
    class Meta:
        model = PaymentMethod
        fields = [
            "id", "title", "name", "icon_url", "account_details",
            "instructions", "note",
            "requires_receipt",
            "is_active", "fields",
            "created_at", "updated_at"
        ]
        read_only_fields = ('created_at', 'updated_at')

class PaymentMethodCreateSerializer(serializers.ModelSerializer):
    fields = PaymentMethodFieldSerializer(many=True, required=False)
    
    class Meta:
        model = PaymentMethod
        fields = [
            "id", "title", "name", "icon_url", "account_details",
            "instructions", "note",
            "requires_receipt",
            "is_active", "fields"
        ]

    def validate(self, attrs):
        raw_fields = self.initial_data.get('fields')
        if isinstance(raw_fields, str):
            try:
                attrs['fields'] = json.loads(raw_fields)
            except json.JSONDecodeError:
                raise serializers.ValidationError({
                    "fields": "Invalid JSON format for fields"
                })
        return attrs

    def create(self, validated_data):
        fields_data = validated_data.pop('fields', [])
        payment_method = PaymentMethod.objects.create(**validated_data)
        
        for field_data in fields_data:
            PaymentMethodField.objects.create(payment_method=payment_method, **field_data)
            
        return payment_method

    def update(self, instance, validated_data):
        fields_data = validated_data.pop('fields', [])
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        instance.fields.all().delete()
        for field_data in fields_data:
            PaymentMethodField.objects.create(payment_method=instance, **field_data)
            
        return instance
