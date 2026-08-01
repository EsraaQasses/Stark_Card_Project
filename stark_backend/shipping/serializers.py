# shipping/serializers.py
from rest_framework import serializers
from .models import Shipping, StandardShippingRequest, AgentShippingRequest, AgentAdminShippingRequest
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


class StandardShippingRequestSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    payment_method_title = serializers.CharField(source='payment_method.title', read_only=True)

    class Meta:
        model = StandardShippingRequest
        fields = [
            "id", "user", "user_name", "user_email", "user_phone", "user_role", "amount", "currency", "wallet_currency",
            "payment_method", "payment_method_title", "user_input_data", "receipt_image",
            "status", "admin_notes", "transaction_ref", "created_at", "updated_at", "processed_at"
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at", "processed_at", "transaction_ref"]


class AgentShippingRequestSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    agent_name = serializers.CharField(source='agent.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    agent_email = serializers.CharField(source='agent.email', read_only=True)
    agent_phone = serializers.CharField(source='agent.phone', read_only=True)
    agent_role = serializers.CharField(source='agent.role', read_only=True)

    class Meta:
        model = AgentShippingRequest
        fields = [
            "id", "user", "user_name", "user_email", "user_phone", "user_role",
            "agent", "agent_name", "agent_email", "agent_phone", "agent_role",
            "amount", "currency", "wallet_currency",
            "user_input_data", "status", "agent_notes",
            "user_transaction_ref", "agent_transaction_ref", "created_at", "updated_at", "processed_at"
        ]
        read_only_fields = [
            "id", "user", "agent", "created_at", "updated_at", "processed_at",
            "user_transaction_ref", "agent_transaction_ref"
        ]


class AgentAdminShippingRequestSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.name', read_only=True)
    agent_email = serializers.CharField(source='agent.email', read_only=True)
    agent_phone = serializers.CharField(source='agent.phone', read_only=True)
    agent_role = serializers.CharField(source='agent.role', read_only=True)

    class Meta:
        model = AgentAdminShippingRequest
        fields = [
            "id", "agent", "agent_name", "agent_email", "agent_phone", "agent_role",
            "amount", "currency", "wallet_currency",
            "user_input_data", "status", "admin_notes", "transaction_ref",
            "created_at", "updated_at", "processed_at"
        ]
        read_only_fields = ["id", "agent", "created_at", "updated_at", "processed_at", "transaction_ref"]
