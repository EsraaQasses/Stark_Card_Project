import re
import uuid
import logging

from django.http import JsonResponse

from .errors import error_payload, normalize_response_error


_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
logger = logging.getLogger(__name__)


class RequestIDMiddleware:
    """Attach one bounded correlation ID to every request and response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        supplied = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID")
        request.request_id = supplied if supplied and _REQUEST_ID.fullmatch(supplied) else str(uuid.uuid4())
        try:
            response = self.get_response(request)
        except Exception:
            logger.exception("Unhandled middleware exception request_id=%s", request.request_id)
            response = JsonResponse(
                error_payload(code="INTERNAL_ERROR", request_id=request.request_id),
                status=500,
            )
        if response.status_code >= 400:
            if hasattr(response, "data"):
                response.data = normalize_response_error(response.data, status_code=response.status_code, request_id=request.request_id)
            elif response.status_code in {400, 401, 403, 404, 405, 409, 429, 500}:
                response = JsonResponse(normalize_response_error({}, status_code=response.status_code, request_id=request.request_id), status=response.status_code)
        response["X-Request-ID"] = request.request_id
        return response
