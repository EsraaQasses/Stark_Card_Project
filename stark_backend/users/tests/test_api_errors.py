import json

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied, ValidationError as DjangoValidationError
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import Throttled, ValidationError, APIException
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory

from api.exceptions import api_exception_handler


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "STATE_CONFLICT"
    default_detail = "The operation conflicts with current state."


class GlobalAPIErrorTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_request_id_is_echoed_and_error_is_bilingual(self):
        supplied = "trace-2026.08.03"
        response = self.client.get(reverse("user-profile"), HTTP_X_REQUEST_ID=supplied)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["X-Request-ID"], supplied)
        self.assertEqual(response.data["success"], False)
        self.assertEqual(response.data["error"]["code"], "AUTHENTICATION_REQUIRED")
        self.assertEqual(set(response.data["error"]["message"]), {"en", "ar"})
        self.assertEqual(response.data["meta"]["request_id"], supplied)

    def test_invalid_request_is_normalized_without_stack_trace(self):
        response = self.client.get(reverse("password-reset-request"))
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.data["error"]["code"], "METHOD_NOT_ALLOWED")
        self.assertNotIn("Traceback", str(response.data))
        self.assertNotIn("stark_backend", str(response.data))

    def test_not_found_and_throttle_are_normalized(self):
        missing = self.client.get("/api/users/not-a-real-route/")
        self.assertEqual(missing.status_code, 404)
        missing_data = getattr(missing, "data", None) or json.loads(missing.content)
        self.assertEqual(missing_data["error"]["code"], "NOT_FOUND")

        factory = APIRequestFactory()
        request = Request(factory.get("/api/test/"))
        request.request_id = "throttle-test"
        throttled = api_exception_handler(Throttled(wait=12), {"request": request})
        self.assertEqual(throttled.status_code, 429)
        self.assertEqual(throttled.data["error"]["code"], "RATE_LIMITED")
        self.assertEqual(throttled.data["error"]["details"], {"retry_after": 12})

    def test_validation_conflict_and_permission_errors_are_normalized(self):
        factory = APIRequestFactory()
        request = Request(factory.post("/api/test/"))
        request.request_id = "error-test"
        cases = (
            (ValidationError({"email": ["This field is required."]}), 400, "VALIDATION_ERROR"),
            (ConflictError(), 409, "CONFLICT"),
            (DjangoPermissionDenied(), 403, "AUTH_FORBIDDEN"),
            (DjangoValidationError({"amount": ["Invalid amount."]}), 400, "VALIDATION_ERROR"),
        )
        for exception, expected_status, expected_code in cases:
            with self.subTest(expected_code=expected_code):
                response = api_exception_handler(exception, {"request": request})
                self.assertEqual(response.status_code, expected_status)
                self.assertEqual(response.data["error"]["code"], expected_code)
                self.assertEqual(set(response.data["error"]["message"]), {"en", "ar"})

    def test_unexpected_exception_is_sanitized(self):
        factory = APIRequestFactory()
        request = Request(factory.get("/api/test/"))
        request.request_id = "unexpected-test"
        response = api_exception_handler(RuntimeError("secret token / database password / SQL detail"), {"request": request})
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data["error"]["code"], "INTERNAL_ERROR")
        self.assertNotIn("secret token", str(response.data))
        self.assertNotIn("database password", str(response.data))
        self.assertNotIn("Traceback", str(response.data))
