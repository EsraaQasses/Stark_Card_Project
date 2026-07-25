from rest_framework import serializers

from users.serializers import UserSerializer
from .models import LastAction, Notification, Ad, SystemLog

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "icon", "created_at", "is_read"]
        read_only_fields = ["id", "created_at"]


class AdSerializer(serializers.ModelSerializer):
    section_name = serializers.ReadOnlyField(source='section.name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = Ad
        fields = [
            'id', 'section', 'section_name', 'product', 'product_name',
            'text', 'background_color', 'font_size', 'text_color', 'image', 'link', 'created_at'
        ]


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