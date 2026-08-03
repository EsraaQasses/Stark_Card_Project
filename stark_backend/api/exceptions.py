import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed, NotAuthenticated, NotFound, MethodNotAllowed,
    ParseError, PermissionDenied, Throttled, ValidationError, APIException,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .errors import error_payload, message_for, redact

logger = logging.getLogger(__name__)


STATUS_CODES = {
    400: "INVALID_REQUEST",
    401: "AUTHENTICATION_REQUIRED",
    403: "AUTH_FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
}


def _request_id(request):
    return getattr(request, "request_id", None) or request.headers.get("X-Request-ID")


def _fields(data):
    if isinstance(data, dict):
        return data.get("fields") or data.get("errors") or data
    return {"non_field_errors": data} if data else {}


def _legacy_code(data, default):
    if isinstance(data, dict):
        return data.get("error_code") or data.get("code") or default
    return default


def _response_code(exc, response):
    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        return "AUTH_INVALID_TOKEN" if isinstance(exc, AuthenticationFailed) else "AUTHENTICATION_REQUIRED"
    if isinstance(exc, (PermissionDenied, DjangoPermissionDenied)):
        return "AUTH_FORBIDDEN"
    if isinstance(exc, (NotFound, Http404)):
        return "NOT_FOUND"
    if isinstance(exc, MethodNotAllowed):
        return "METHOD_NOT_ALLOWED"
    if isinstance(exc, Throttled):
        return "RATE_LIMITED"
    if isinstance(exc, (ValidationError, DjangoValidationError, ParseError)):
        return "VALIDATION_ERROR" if isinstance(exc, (ValidationError, DjangoValidationError)) else "INVALID_REQUEST"
    return STATUS_CODES.get(getattr(response, "status_code", 500), "INTERNAL_ERROR")


def api_exception_handler(exc, context):
    request = context.get("request")
    request_id = _request_id(request) if request else None
    if isinstance(exc, DjangoValidationError):
        raw = getattr(exc, "message_dict", None) or getattr(exc, "messages", [str(exc)])
        response = Response(raw, status=status.HTTP_400_BAD_REQUEST)
    elif isinstance(exc, DjangoPermissionDenied):
        response = Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    else:
        response = drf_exception_handler(exc, context)

    if response is None:
        logger.error(
            "Unhandled API exception request_id=%s",
            request_id,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        response = Response(error_payload(code="INTERNAL_ERROR", request_id=request_id), status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    else:
        code = _response_code(exc, response)
        data = response.data
        if isinstance(exc, Throttled):
            details = {"retry_after": exc.wait} if exc.wait is not None else None
        else:
            details = None
        if isinstance(data, dict) and data.get("detail") and code in {"AUTH_INVALID_TOKEN", "AUTHENTICATION_REQUIRED", "AUTH_FORBIDDEN", "NOT_FOUND", "METHOD_NOT_ALLOWED"}:
            details = {"legacy_detail": str(data["detail"])}
        if isinstance(data, dict):
            code = _legacy_code(data, code)
        response.data = error_payload(
            code=code,
            fields=_fields(data) if isinstance(exc, (ValidationError, DjangoValidationError)) else {},
            details=details,
            request_id=request_id,
            message=message_for(code),
        )

    response["X-Request-ID"] = request_id or ""
    return response
