from rest_framework import serializers
from .models import LastAction, Notification, Ad, SystemLog, PushDeviceToken
import re


class PushDeviceTokenSerializer(serializers.ModelSerializer):
    # Registration intentionally upserts an existing token, so the model's
    # UniqueValidator must not reject the second registration request.
    token = serializers.CharField(max_length=255, validators=[])

    class Meta:
        model = PushDeviceToken
        fields = ["token", "platform"]

    def validate_token(self, value):
        token = value.strip()
        if not token.startswith(("ExpoPushToken[", "ExponentPushToken[")) or not token.endswith("]"):
            raise serializers.ValidationError("A valid Expo push token is required.")
        return token

    def validate_platform(self, value):
        return value.lower()


class PushDeviceTokenUnregisterSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255, validators=[])

    def validate_token(self, value):
        token = value.strip()
        if not token.startswith(("ExpoPushToken[", "ExponentPushToken[")) or not token.endswith("]"):
            raise serializers.ValidationError("A valid Expo push token is required.")
        return token
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "message", "details", "icon", "created_at", "is_read"]
        read_only_fields = ["id", "type", "title", "message", "details", "icon", "created_at"]


class AdSerializer(serializers.ModelSerializer):
    
    def validate_background_color(self, value):
        # Validate hex color format (#RRGGBB or #RGB)
        hex_color_pattern = re.compile(r'^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')
        if not hex_color_pattern.match(value):
            raise serializers.ValidationError("يجب أن يكون لون الخلفية بصيغة HEX صحيحة (مثال: #FFFFFF أو #FFF)")
        return value
    
    class Meta:
        model = Ad
        fields = ['id', 'title', 'text', 'background_color', 'font_size', 
                  'text_color', 'image', 'link', 'is_active', 'created_at']


class SystemLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = SystemLog
        fields = ['id', 'user_name', 'operation_type', 'operation_name', 'url', 
                  'description', 'device_info', 'ip_address', 'created_at']
        

class LastActionSerializer(serializers.ModelSerializer):
    admin_name = serializers.CharField(source='admin.full_name', read_only=True)
    target_name = serializers.CharField(source='target_user.full_name', read_only=True)

    class Meta:
        model = LastAction
        fields = ['id', 'admin_name', 'target_name', 'action_type', 'description', 'created_at']
