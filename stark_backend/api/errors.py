from __future__ import annotations

from typing import Any


ERROR_MESSAGES = {
    "VALIDATION_ERROR": ("Request validation failed.", "فشل التحقق من صحة الطلب."),
    "AUTHENTICATION_REQUIRED": ("Authentication is required.", "المصادقة مطلوبة."),
    "AUTH_INVALID_CREDENTIALS": ("Invalid credentials.", "بيانات تسجيل الدخول غير صحيحة."),
    "AUTH_INVALID_TOKEN": ("The authentication token is invalid or expired.", "رمز المصادقة غير صالح أو منتهي الصلاحية."),
    "AUTH_FORBIDDEN": ("You do not have permission to perform this action.", "ليس لديك صلاحية لتنفيذ هذا الإجراء."),
    "NOT_FOUND": ("The requested resource was not found.", "المورد المطلوب غير موجود."),
    "METHOD_NOT_ALLOWED": ("This method is not allowed.", "هذه الطريقة غير مسموحة."),
    "RATE_LIMITED": ("Too many requests. Please try again later.", "طلبات كثيرة جداً. يرجى المحاولة لاحقاً."),
    "CONFLICT": ("The request conflicts with the current resource state.", "يتعارض الطلب مع حالة المورد الحالية."),
    "INVALID_REQUEST": ("The request is invalid.", "الطلب غير صالح."),
    "INTERNAL_ERROR": ("An unexpected error occurred.", "حدث خطأ غير متوقع."),
}


def message_for(code: str, fallback: str | None = None) -> dict[str, str]:
    en, ar = ERROR_MESSAGES.get(code, (fallback or "The request could not be completed.", "تعذر إكمال الطلب."))
    return {"en": en, "ar": ar}


_SENSITIVE_KEYS = {
    "password", "password_confirmation", "confirm_password", "token", "access", "refresh",
    "reset_token", "otp", "otp_code", "secret", "api_key", "apikey", "authorization",
    "cookie", "sql", "traceback", "stack", "path",
}


def redact(value: Any):
    """Remove credentials and implementation details from client-visible details."""
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if str(key).lower() in _SENSITIVE_KEYS or any(part in str(key).lower() for part in ("token", "secret", "password")) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(item) for item in value]
    return value


def error_payload(*, code: str, fields=None, details=None, request_id=None, message=None):
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message or message_for(code),
            "fields": redact(fields or {}),
            "details": redact(details),
        },
        "meta": {"request_id": request_id},
    }


def normalize_response_error(data, *, status_code, request_id):
    """Wrap legacy DRF `Response` error bodies without touching success bodies."""
    if not isinstance(data, dict):
        return error_payload(code="INVALID_REQUEST", details=data, request_id=request_id)
    if data.get("success") is False and isinstance(data.get("error"), dict) and "meta" in data:
        data.setdefault("meta", {})["request_id"] = request_id
        return data
    code = data.get("error_code") or data.get("code")
    if not code:
        code = {400: "INVALID_REQUEST", 401: "AUTHENTICATION_REQUIRED", 403: "AUTH_FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 409: "CONFLICT", 429: "RATE_LIMITED"}.get(status_code, "INTERNAL_ERROR")
    existing_message = data.get("message")
    bilingual = existing_message if isinstance(existing_message, dict) and {"en", "ar"}.issubset(existing_message) else None
    details = data.get("details")
    if "error" in data and not isinstance(data["error"], dict):
        details = {"legacy_error": data["error"], **(details or {})} if isinstance(details, dict) else {"legacy_error": data["error"], "details": details}
    fields = data.get("fields") or data.get("errors") or {}
    return error_payload(code=code, fields=fields, details=details, request_id=request_id, message=bilingual or message_for(code))
