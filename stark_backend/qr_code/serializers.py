from rest_framework import serializers
from .models import UserQRCode
from users.models import User

class UserQRCodeSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    qr_code_url = serializers.SerializerMethodField()
    qr_data = serializers.CharField(read_only=True)

    class Meta:
        model = UserQRCode
        fields = ['id', 'user', 'user_name', 'user_email', 'user_phone',
                 'qr_code_url', 'qr_data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_qr_code_url(self, obj):
        if obj.qr_code:
            return obj.qr_code.url
        return None

class QRCodeGenerateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    
    def validate_user_id(self, value):
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")
        return value
