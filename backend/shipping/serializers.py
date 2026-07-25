# shipping/serializers.py
from rest_framework import serializers
from .models import Shipping
from all_requests.serializers import RequestSerializer

class ShippingSerializer(serializers.ModelSerializer):
    request_details = RequestSerializer(source='request', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)

    class Meta:
        model = Shipping
        fields = [
            "id", "request", "request_details", "user", "user_name", "amount", "currency",
            "status", "admin_notes", "transaction_ref", "created_at", "updated_at", "processed_at"
        ]
        read_only_fields = ["id", "request", "user", "created_at", "updated_at", "processed_at"]

class ShippingStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipping
        fields = ["status", "admin_notes"]