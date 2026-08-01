from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

AUTH_VERSION_CLAIM = "auth_version"


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    refresh[AUTH_VERSION_CLAIM] = user.auth_version
    access = refresh.access_token
    access[AUTH_VERSION_CLAIM] = user.auth_version
    return refresh, access


class VersionedJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        claim = validated_token.get(AUTH_VERSION_CLAIM)
        if not isinstance(claim, int) or isinstance(claim, bool) or claim < 0:
            from rest_framework_simplejwt.exceptions import AuthenticationFailed
            raise AuthenticationFailed("Token authentication epoch is invalid.", code="invalid_token")
        if claim != user.auth_version:
            from rest_framework_simplejwt.exceptions import AuthenticationFailed
            raise AuthenticationFailed("Token authentication epoch has expired.", code="token_not_valid")
        return user


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user_model = get_user_model()
        claim_name = settings.SIMPLE_JWT["USER_ID_CLAIM"]
        try:
            user = user_model.objects.get(pk=refresh[claim_name])
        except user_model.DoesNotExist:
            from rest_framework_simplejwt.exceptions import AuthenticationFailed
            raise AuthenticationFailed("User not found.", code="user_not_found")
        claim = refresh.get(AUTH_VERSION_CLAIM)
        if not isinstance(claim, int) or isinstance(claim, bool) or claim < 0 or claim != user.auth_version:
            from rest_framework_simplejwt.exceptions import AuthenticationFailed
            raise AuthenticationFailed("Token authentication epoch has expired.", code="token_not_valid")
        return super().validate(attrs)
