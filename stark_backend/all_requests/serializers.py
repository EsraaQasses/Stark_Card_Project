# requests/serializers.py
import json
from rest_framework import serializers
from .models import Request, RequestComment
from users.serializers import UserSerializer
from payment_methods.models import PaymentMethod

class RequestCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)

    class Meta:
        model = RequestComment
        fields = ["id", "user", "user_name", "user_role", "comment", "is_admin_note", "created_at"]
        read_only_fields = ["id", "user", "created_at"]

class RequestSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    payment_method_title = serializers.CharField(source='payment_method.title', read_only=True)
    comments = RequestCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Request
        fields = [
            "id", "user", "user_name", "user_email", "user_phone", "user_role", "request_type", "status",
            "title", "description", "amount", "currency", "payment_method", "payment_method_title",
            "user_input_data", "receipt_image", "admin_notes", "rejection_reason",
            "comments", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

class CreatePaymentRequestSerializer(serializers.ModelSerializer):
    request_type = serializers.ChoiceField(
        choices=Request.TYPE_CHOICES,
        required=False,
        default='payment'
    )

    class Meta:
        model = Request
        fields = [
            "request_type", "payment_method", "title", "description", "amount",
            "currency", "user_input_data", "receipt_image"
        ]
        extra_kwargs = {
            "title": {"required": False}
        }

    def validate(self, attrs):
        # Normalize user_input_data (multipart may send as JSON string)
        user_input = attrs.get("user_input_data") or {}
        if isinstance(user_input, str):
            try:
                user_input = json.loads(user_input)
            except json.JSONDecodeError:
                user_input = {}
        attrs["user_input_data"] = user_input

        wallet_currency = (user_input.get("wallet_currency") or "").upper()
        if wallet_currency not in {"USD", "SYP"}:
            raise serializers.ValidationError({
                "user_input_data": "wallet_currency is required and must be USD or SYP."
            })

        pm = attrs.get("payment_method")
        if pm:
            # Require receipt if method requires it
            requires_receipt = getattr(pm, "requires_receipt", True)
            if requires_receipt and not attrs.get("receipt_image"):
                raise serializers.ValidationError({
                    "receipt_image": "Receipt image is required for this method."
                })

        return attrs

    def create(self, validated_data):
        req_type = validated_data.pop('request_type', None) or 'payment'
        user = self.context['request'].user
        title_prefix = "Cashout Request" if req_type == "cashout" else "Payment Request"
        validated_data.update({
            'user': user,
            'request_type': req_type,
            'title': f"{title_prefix} - {validated_data.get('amount')} {validated_data.get('currency')}"
        })
        return super().create(validated_data)

class RequestStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ["status", "admin_notes", "rejection_reason"]
