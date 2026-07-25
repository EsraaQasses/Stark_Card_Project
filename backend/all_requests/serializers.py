# requests/serializers.py
from rest_framework import serializers
from .models import Request, RequestComment
from users.serializers import UserSerializer

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
    payment_method_title = serializers.CharField(source='payment_method.title', read_only=True)
    comments = RequestCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Request
        fields = [
            "id", "user", "user_name", "user_email", "user_phone", "request_type", "status",
            "title", "description", "amount", "currency", "payment_method", "payment_method_title",
            "user_input_data", "receipt_image", "admin_notes", "rejection_reason",
            "comments", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

class CreatePaymentRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = [
            "payment_method", "title", "description", "amount", "currency",
            "user_input_data", "receipt_image"
        ]

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data.update({
            'user': user,
            'request_type': 'payment',
            'title': f"Payment Request - {validated_data.get('amount')} {validated_data.get('currency')}"
        })
        return super().create(validated_data)

class RequestStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ["status", "admin_notes", "rejection_reason"]