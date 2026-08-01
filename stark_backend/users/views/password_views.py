import re
import secrets
import string
from datetime import timedelta

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import PasswordResetAuthorization, PasswordResetChallenge, User
from ..permissions import IsAdminUser
from ..services.password_reset import (
    complete_password_reset, hash_secret, invalidate_challenges, invalidate_user_authentication,
    issue_challenge, validate_new_password,
)
from ..throttles import (
    AdminPasswordResetThrottle, PasswordChangeThrottle, PasswordResetRequestThrottle,
    PasswordResetResendThrottle, PasswordResetVerifyThrottle,
)
from ..utils.audit_logger import AuditLogger
from ..utils.email_service import EmailService


def message(en, ar):
    return {"en": en, "ar": ar}


def api_error(code, en, ar, details=None, http_status=status.HTTP_400_BAD_REQUEST):
    payload = {"code": code, "message": message(en, ar)}
    if details:
        payload["details"] = details
    return Response(payload, status=http_status)


class DeprecatedPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = Response({
            "code": "PASSWORD_RESET_ENDPOINT_DEPRECATED",
            "message": message(
                "This password-reset endpoint is no longer supported. Use the password-reset request flow.",
                "لم يعد هذا المسار مدعومًا. استخدم مسار طلب إعادة تعيين كلمة المرور.",
            ),
        }, status=status.HTTP_410_GONE)
        response["Deprecation"] = "true"
        response["Sunset"] = "Wed, 31 Dec 2026 23:59:59 GMT"
        return response


GENERIC_ACCEPTED = {
    "code": "PASSWORD_RESET_REQUEST_ACCEPTED",
    "message": message(
        "If an account exists for this email, a verification code has been sent.",
        "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم إرسال رمز التحقق.",
    ),
}


def generic_accepted_response():
    # This is deliberately opaque even when no account is eligible.
    return {
        **GENERIC_ACCEPTED,
        "request_id": secrets.token_urlsafe(32),
        "expires_in": getattr(settings, "PASSWORD_RESET_CODE_LIFETIME", 600),
        "resend_after": getattr(settings, "PASSWORD_RESET_RESEND_COOLDOWN", 60),
    }


def _ascii_code(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9]{6}", value) is not None


def _request_metadata(challenge):
    now = timezone.now()
    return {
        "request_id": challenge.request_id,
        "expires_in": max(0, int((challenge.expires_at - now).total_seconds())),
        "resend_after": max(0, int((challenge.resend_available_at - now).total_seconds())),
    }


def _delivery_limit_reached(user_key):
    hour_key = f"password-reset-hour:{user_key}"
    day_key = f"password-reset-day:{user_key}:{timezone.now().date().isoformat()}"
    hour_count = cache.get(hour_key, 0)
    day_count = cache.get(day_key, 0)
    if hour_count >= getattr(settings, "PASSWORD_RESET_REQUESTS_PER_HOUR", 5):
        return True
    if day_count >= getattr(settings, "PASSWORD_RESET_REQUESTS_PER_DAY", 10):
        return True
    cache.set(hour_key, hour_count + 1, 3600)
    cache.set(day_key, day_count + 1, 86400)
    return False


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRequestThrottle]

    def post(self, request):
        email = request.data.get("email")
        if not isinstance(email, str):
            return Response(generic_accepted_response(), status=status.HTTP_200_OK)
        email = email.strip().casefold()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            return Response(generic_accepted_response(), status=status.HTTP_200_OK)

        user = User.objects.filter(email__iexact=email, is_active=True, is_banned=False).first()
        if not user:
            return Response(generic_accepted_response(), status=status.HTTP_200_OK)
        if _delivery_limit_reached(hash_secret(email)):
            return Response(generic_accepted_response(), status=status.HTTP_200_OK)
        with transaction.atomic():
            challenge = issue_challenge(user, request)
        AuditLogger.log(request, "PASSWORD_CHANGE", "user", user.id, {"action": "reset_request"})
        return Response({**GENERIC_ACCEPTED, **_request_metadata(challenge)}, status=status.HTTP_200_OK)


class PasswordResetVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetVerifyThrottle]

    def post(self, request):
        request_id, code = request.data.get("request_id"), request.data.get("code")
        if not isinstance(request_id, str) or not _ascii_code(code):
            return api_error("PASSWORD_RESET_CODE_INVALID", "The verification code is invalid.", "رمز التحقق غير صالح.")
        with transaction.atomic():
            try:
                challenge = PasswordResetChallenge.objects.select_for_update().get(
                    request_id=request_id, purpose=PasswordResetChallenge.PURPOSE_PASSWORD_RESET
                )
            except PasswordResetChallenge.DoesNotExist:
                return api_error("PASSWORD_RESET_CODE_INVALID", "The verification code is invalid.", "رمز التحقق غير صالح.")
            if challenge.consumed_at or challenge.is_expired:
                return api_error("PASSWORD_RESET_CODE_EXPIRED", "The verification code has expired.", "انتهت صلاحية رمز التحقق.")
            if challenge.is_locked:
                return api_error("PASSWORD_RESET_CODE_TOO_MANY_ATTEMPTS", "Too many attempts.", "تم تجاوز عدد المحاولات المسموح به.")
            if not check_password(code, challenge.code_hash):
                challenge.attempts += 1
                if challenge.attempts >= challenge.max_attempts:
                    challenge.locked_at = timezone.now()
                challenge.save(update_fields=["attempts", "locked_at"])
                remaining = max(0, challenge.max_attempts - challenge.attempts)
                return api_error("PASSWORD_RESET_CODE_INVALID", "The verification code is invalid.", "رمز التحقق غير صالح.", {"attempts_remaining": remaining})
            now = timezone.now()
            challenge.verified_at = now
            challenge.consumed_at = now
            challenge.save(update_fields=["verified_at", "consumed_at"])
            raw_token = secrets.token_urlsafe(48)
            authorization = PasswordResetAuthorization.objects.create(
                user=challenge.user,
                token_hash=hash_secret(raw_token),
                challenge=challenge,
                expires_at=now + timedelta(seconds=getattr(settings, 'PASSWORD_RESET_AUTHORIZATION_LIFETIME', 600)),
            )
        return Response({
            "code": "PASSWORD_RESET_CODE_VERIFIED", "reset_token": raw_token,
            "expires_in": max(0, int((authorization.expires_at - timezone.now()).total_seconds())),
            "message": message("The verification code was accepted.", "تم قبول رمز التحقق."),
        }, status=status.HTTP_200_OK)


class PasswordResetResendView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetResendThrottle]

    def post(self, request):
        request_id = request.data.get("request_id")
        if not isinstance(request_id, str):
            return Response(generic_accepted_response(), status=status.HTTP_200_OK)
        with transaction.atomic():
            challenge = PasswordResetChallenge.objects.filter(
                request_id=request_id, purpose=PasswordResetChallenge.PURPOSE_PASSWORD_RESET,
                consumed_at__isnull=True,
            ).select_related("user").first()
            if not challenge or challenge.is_expired:
                return Response(generic_accepted_response(), status=status.HTTP_200_OK)
            if challenge.resend_available_at > timezone.now():
                return api_error("PASSWORD_RESET_RESEND_COOLDOWN", "Please wait before requesting another code.", "يرجى الانتظار قبل طلب رمز آخر.", {"resend_after": int((challenge.resend_available_at - timezone.now()).total_seconds())}, status.HTTP_429_TOO_MANY_REQUESTS)
            if _delivery_limit_reached(hash_secret(challenge.user.email.casefold())):
                return Response(generic_accepted_response(), status=status.HTTP_200_OK)
            new_challenge = issue_challenge(challenge.user, request)
        return Response({**GENERIC_ACCEPTED, **_request_metadata(new_challenge)}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("reset_token")
        password = request.data.get("new_password")
        confirmation = request.data.get("confirm_password")
        if not all(isinstance(value, str) for value in (token, password, confirmation)):
            return api_error("PASSWORD_RESET_INVALID_REQUEST", "Invalid reset request.", "طلب إعادة التعيين غير صالح.")
        if password != confirmation:
            return api_error("PASSWORD_RESET_PASSWORD_MISMATCH", "Passwords do not match.", "كلمتا المرور غير متطابقتين.")
        authorization = PasswordResetAuthorization.objects.filter(
            token_hash=hash_secret(token), purpose=PasswordResetAuthorization.PURPOSE_PASSWORD_RESET
        ).select_related("user").first()
        if not authorization:
            return api_error("PASSWORD_RESET_TOKEN_INVALID", "The reset token is invalid or expired.", "رمز إعادة التعيين غير صالح أو منتهي.")
        try:
            user = complete_password_reset(authorization, password)
        except ValueError as exc:
            if str(exc) == "PASSWORD_REUSE":
                return api_error("PASSWORD_RESET_OLD_PASSWORD_REUSE", "Choose a password different from your current password.", "اختر كلمة مرور مختلفة عن كلمة المرور الحالية.")
            return api_error("PASSWORD_RESET_TOKEN_INVALID", "The reset token is invalid or expired.", "رمز إعادة التعيين غير صالح أو منتهي.")
        except ValidationError as exc:
            return api_error("PASSWORD_RESET_PASSWORD_POLICY", "The password does not meet policy requirements.", "كلمة المرور لا تستوفي متطلبات الأمان.", {"errors": exc.messages})
        AuditLogger.log(request, "PASSWORD_CHANGE", "user", user.id, {"action": "reset_complete", "auth_revoked": True})
        EmailService.send_password_changed_notification(user)
        return Response({"code": "PASSWORD_RESET_COMPLETED", "message": message("Your password has been changed successfully. Please sign in again.", "تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.")}, status=status.HTTP_200_OK)


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [PasswordChangeThrottle]

    def post(self, request):
        current = request.data.get("current_password", request.data.get("old_password"))
        password = request.data.get("new_password")
        confirmation = request.data.get("confirm_password")
        if not isinstance(current, str) or not isinstance(password, str) or not isinstance(confirmation, str):
            return api_error("PASSWORD_CHANGE_INVALID_REQUEST", "Invalid password change request.", "طلب تغيير كلمة المرور غير صالح.")
        if not request.user.check_password(current):
            return api_error("PASSWORD_CHANGE_CURRENT_INVALID", "The current password is invalid.", "كلمة المرور الحالية غير صحيحة.", http_status=status.HTTP_400_BAD_REQUEST)
        if password != confirmation:
            return api_error("PASSWORD_RESET_PASSWORD_MISMATCH", "Passwords do not match.", "كلمتا المرور غير متطابقتين.")
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                validate_new_password(user, password)
                user.set_password(password)
                user.password_changed_at = timezone.now()
                user.auth_version += 1
                user.save(update_fields=["password", "password_changed_at", "auth_version"])
                invalidate_challenges(user)
                invalidate_user_authentication(user)
        except ValueError:
            return api_error("PASSWORD_RESET_OLD_PASSWORD_REUSE", "Choose a different password.", "اختر كلمة مرور مختلفة.")
        except ValidationError as exc:
            return api_error("PASSWORD_RESET_PASSWORD_POLICY", "The password does not meet policy requirements.", "كلمة المرور لا تستوفي متطلبات الأمان.", {"errors": exc.messages})
        AuditLogger.log(request, "PASSWORD_CHANGE", "user", user.id, {"change_type": "authenticated", "auth_revoked": True})
        EmailService.send_password_changed_notification(user)
        return Response({"code": "PASSWORD_CHANGE_COMPLETED", "message": message("Password changed successfully. Please sign in again.", "تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.")}, status=status.HTTP_200_OK)


class AdminPasswordResetSendView(APIView):
    permission_classes = [IsAdminUser]
    throttle_classes = [AdminPasswordResetThrottle]

    def post(self, request, user_id):
        reason = request.data.get("reason")
        if not isinstance(reason, str) or len(reason.strip()) < 10:
            return api_error("PASSWORD_RESET_REASON_REQUIRED", "A reason of at least 10 characters is required.", "سبب لا يقل عن 10 أحرف مطلوب.")
        target = User.objects.filter(pk=user_id, is_active=True).first()
        if not target or target.pk == request.user.pk or (target.role == "admin" and not request.user.is_superuser):
            return api_error("PASSWORD_RESET_ROLE_HIERARCHY", "You are not allowed to reset this account.", "لا يسمح لك بإعادة تعيين هذا الحساب.", http_status=status.HTTP_403_FORBIDDEN)
        with transaction.atomic():
            challenge = issue_challenge(target, request)
        AuditLogger.log(request, "PASSWORD_CHANGE", "user", target.id, {"action": "admin_reset_request", "actor_id": request.user.id, "reason": reason.strip()[:500]})
        return Response({**GENERIC_ACCEPTED, **_request_metadata(challenge)}, status=status.HTTP_200_OK)
