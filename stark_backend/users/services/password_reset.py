import hashlib
import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

from ..models import PasswordResetAuthorization, PasswordResetChallenge, User
from ..authentication import revoke_user_authentication
from ..utils.email_service import EmailService


def hash_secret(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_code():
    return "".join(secrets.choice(string.digits) for _ in range(6))


def invalidate_user_authentication(user):
    """Blacklist outstanding JWTs and remove server-side sessions where available."""
    revoke_user_authentication(user, increment_auth_version=False)


def invalidate_challenges(user):
    now = timezone.now()
    PasswordResetChallenge.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=now)
    PasswordResetAuthorization.objects.filter(user=user, consumed_at__isnull=True).update(consumed_at=now)


def issue_challenge(user, request):
    # Serialize issuance per user so concurrent requests cannot leave two active challenges.
    user = User.objects.select_for_update().get(pk=user.pk)
    now = timezone.now()
    lifetime = getattr(settings, "PASSWORD_RESET_CODE_LIFETIME", 600)
    cooldown = getattr(settings, "PASSWORD_RESET_RESEND_COOLDOWN", 60)
    code = generate_code()
    request_id = secrets.token_urlsafe(32)
    invalidate_challenges(user)
    challenge = PasswordResetChallenge.objects.create(
        user=user,
        request_id=request_id,
        code_hash=make_password(code),
        expires_at=now + timedelta(seconds=lifetime),
        resend_available_at=now + timedelta(seconds=cooldown),
        max_attempts=getattr(settings, "PASSWORD_RESET_MAX_ATTEMPTS", 5),
        requested_ip=request.META.get("REMOTE_ADDR"),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
    )
    EmailService.send_secure_password_reset_code(user, code, lifetime // 60)
    return challenge


def validate_new_password(user, password):
    validate_password(password, user=user)
    if user.check_password(password):
        raise ValueError("PASSWORD_REUSE")


@transaction.atomic
def complete_password_reset(authorization, password):
    authorization = PasswordResetAuthorization.objects.select_for_update().select_related("user").get(pk=authorization.pk)
    if authorization.consumed_at or authorization.is_expired:
        raise ValueError("RESET_TOKEN_INVALID")
    user = User.objects.select_for_update().get(pk=authorization.user_id)
    validate_new_password(user, password)
    user.set_password(password)
    user.password_changed_at = timezone.now()
    user.auth_version += 1
    user.save(update_fields=["password", "password_changed_at", "auth_version"])
    authorization.consumed_at = timezone.now()
    authorization.save(update_fields=["consumed_at"])
    invalidate_challenges(user)
    invalidate_user_authentication(user)
    return user
