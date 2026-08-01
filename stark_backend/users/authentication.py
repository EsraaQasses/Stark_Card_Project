from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

AUTH_VERSION_CLAIM = "auth_version"


def cleanup_expired_auth_sessions(*, user=None):
    """Delete temporary login sessions after their server-side deadline."""
    from .models import AdminLoginSession, UserLoginSession

    now = timezone.now()
    admin_sessions = AdminLoginSession.objects.filter(expires_at__lte=now)
    user_sessions = UserLoginSession.objects.filter(expires_at__lte=now)
    if user is not None:
        admin_sessions = admin_sessions.filter(user=user)
        user_sessions = user_sessions.filter(user=user)
    return admin_sessions.delete()[0] + user_sessions.delete()[0]


@transaction.atomic
def revoke_user_authentication(user, *, increment_auth_version=True):
    """Revoke JWTs and temporary sessions for one user atomically."""
    from .models import AdminLoginSession, UserLoginSession

    locked_user = get_user_model().objects.select_for_update().get(pk=user.pk)
    for token in OutstandingToken.objects.filter(user=locked_user):
        BlacklistedToken.objects.get_or_create(token=token)
    if increment_auth_version:
        locked_user.auth_version += 1
        locked_user.save(update_fields=["auth_version"])
    UserLoginSession.objects.filter(user=locked_user).delete()
    AdminLoginSession.objects.filter(user=locked_user).delete()
    Session.objects.filter(session_data__contains=f'"_auth_user_id": "{locked_user.pk}"').delete()
    return locked_user


def logout_user(user, refresh_token=None):
    """Perform one canonical, global logout for the authenticated account."""
    if refresh_token:
        token = RefreshToken(refresh_token)
        user_id = str(token.get(settings.SIMPLE_JWT["USER_ID_CLAIM"]))
        if user_id != str(user.pk):
            raise ValueError("LOGOUT_TOKEN_USER_MISMATCH")
        token.blacklist()
    return revoke_user_authentication(user)


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
