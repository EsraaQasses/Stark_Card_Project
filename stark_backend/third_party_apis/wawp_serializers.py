from rest_framework import serializers

from users.models import User
from .models import ThirdPartyAPI
from .services.wawp_service import WAWPService


class WAWPConfigurationSerializer(serializers.ModelSerializer):
    has_access_token = serializers.SerializerMethodField()
    access_token = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = ThirdPartyAPI
        fields = ["id", "instance_id", "is_active", "has_access_token", "access_token", "created_at", "updated_at"]
        read_only_fields = ["id", "has_access_token", "created_at", "updated_at"]

    def get_has_access_token(self, obj):
        return bool(obj.encrypted_api_key)

    def validate_instance_id(self, value):
        if not value or not value.strip() or len(value.strip()) > 64:
            raise serializers.ValidationError("A valid WAWP instance ID is required.")
        return value.strip()

    def validate(self, attrs):
        if not self.instance and not attrs.get("access_token"):
            raise serializers.ValidationError({"access_token": "This field is required for a new configuration."})
        return attrs

    def create(self, validated_data):
        token = validated_data.pop("access_token")
        config = ThirdPartyAPI.objects.create(
            name="Stark WAWP", provider="wawp", base_url=WAWPService.BASE_URL,
            **validated_data,
        )
        config.set_api_key(token)
        config.save(update_fields=["encrypted_api_key"])
        return config

    def update(self, instance, validated_data):
        token = validated_data.pop("access_token", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if token is not None:
            instance.set_api_key(token)
        instance.save()
        return instance


class WAWPTestMessageSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False, allow_blank=False)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False)
    message = serializers.CharField(max_length=WAWPService.MAX_MESSAGE_LENGTH, allow_blank=False, trim_whitespace=True)

    def validate(self, attrs):
        if bool(attrs.get("phone")) == bool(attrs.get("user_id")):
            raise serializers.ValidationError("Provide exactly one of phone or user_id.")
        if attrs.get("user_id") and not attrs["user_id"].phone:
            raise serializers.ValidationError({"user_id": "The selected user has no phone number."})
        return attrs
