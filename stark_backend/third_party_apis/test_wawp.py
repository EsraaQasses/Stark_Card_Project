import secrets
from unittest.mock import Mock, patch

from django.test import TestCase
import requests
from rest_framework.test import APIClient

from users.models import User
from .models import ThirdPartyAPI
from .services.wawp_service import WAWPService, WAWPServiceError


class WAWPServiceTests(TestCase):
    def setUp(self):
        self.token = "wawp-" + secrets.token_urlsafe(24)
        self.config = ThirdPartyAPI.objects.create(
            name="Stark WAWP", provider="wawp", base_url=WAWPService.BASE_URL,
            instance_id="123456789012", is_active=True,
        )
        self.config.set_api_key(self.token)
        self.config.save()

    def response(self, status_code, data):
        response = Mock()
        response.status_code = status_code
        response.json.return_value = data
        return response

    @patch("third_party_apis.services.wawp_service.requests.post")
    def test_connection_success(self, post):
        post.return_value = self.response(200, {"name": "wawp", "status": "WORKING"})
        self.assertEqual(WAWPService.test_connection(), {"success": True, "status": "connected"})
        self.assertIn("access_token=", post.call_args.args[0])

    @patch("third_party_apis.services.wawp_service.requests.post")
    def test_disconnected_session_is_normalized(self, post):
        post.return_value = self.response(200, {"status": "SCAN_QR"})
        result = WAWPService.test_connection()
        self.assertEqual(result["error_code"], "WAWP_SESSION_DISCONNECTED")

    @patch("third_party_apis.services.wawp_service.requests.post")
    def test_send_text_formats_chat_id_and_normalizes_success(self, post):
        post.return_value = self.response(200, {"id": {"_serialized": "true_123@c.us_abc"}})
        result = WAWPService.send_text("+963 912 345 678", "hello")
        self.assertEqual(result["message_id"], "true_123@c.us_abc")
        self.assertEqual(post.call_args.kwargs["json"]["chatId"], "963912345678@c.us")

    @patch("third_party_apis.services.wawp_service.requests.post")
    def test_provider_errors_do_not_expose_body(self, post):
        post.return_value = self.response(401, {"error": "token=secret-wawp-token"})
        with self.assertRaises(WAWPServiceError) as caught:
            WAWPService.test_connection()
        self.assertEqual(caught.exception.code, "WAWP_INVALID_CREDENTIALS")
        self.assertNotIn("secret-wawp-token", str(caught.exception))

    def test_invalid_phone_and_message(self):
        with self.assertRaises(WAWPServiceError):
            WAWPService.normalize_phone("123")
        with self.assertRaises(WAWPServiceError):
            WAWPService.send_text("+963912345678", "")

    @patch("third_party_apis.services.wawp_service.requests.post", side_effect=requests.Timeout)
    def test_timeout_is_normalized(self, post):
        with self.assertRaises(WAWPServiceError) as caught:
            WAWPService.test_connection()
        self.assertEqual(caught.exception.code, "WAWP_TIMEOUT")

    @patch("third_party_apis.services.wawp_service.requests.post", side_effect=requests.ConnectionError)
    def test_connection_failure_is_normalized(self, post):
        with self.assertRaises(WAWPServiceError) as caught:
            WAWPService.test_connection()
        self.assertEqual(caught.exception.code, "WAWP_CONNECTION_ERROR")

    @patch("third_party_apis.services.wawp_service.requests.post")
    def test_malformed_response_is_normalized(self, post):
        post.return_value = self.response(200, [])
        with self.assertRaises(WAWPServiceError) as caught:
            WAWPService.test_connection()
        self.assertEqual(caught.exception.code, "WAWP_MALFORMED_RESPONSE")

    @patch("third_party_apis.services.wawp_service.requests.post")
    def test_http_400_404_429_and_500_are_stable(self, post):
        expected = {400: "WAWP_BAD_REQUEST", 404: "WAWP_SESSION_NOT_FOUND", 429: "WAWP_RATE_LIMITED", 500: "WAWP_PROVIDER_ERROR"}
        for status_code, code in expected.items():
            post.return_value = self.response(status_code, {"token": "must not leak"})
            with self.assertRaises(WAWPServiceError) as caught:
                WAWPService.test_connection()
            self.assertEqual(caught.exception.code, code)

    def test_inactive_configuration_is_not_used(self):
        self.config.is_active = False
        self.config.save(update_fields=["is_active"])
        with self.assertRaises(WAWPServiceError) as caught:
            WAWPService.test_connection()
        self.assertEqual(caught.exception.code, "WAWP_NOT_CONFIGURED")


class WAWPApiTests(TestCase):
    def setUp(self):
        self.token = "wawp-" + secrets.token_urlsafe(24)
        self.client = APIClient()
        self.admin = User.objects.create_superuser(name="wawp-admin", email="wawp-admin@example.com", password="Password-9!")
        self.user = User.objects.create_user(name="wawp-user", email="wawp-user@example.com", phone="+963912345678")
        self.client.force_authenticate(self.admin)

    def test_configuration_token_is_write_only_and_encrypted(self):
        response = self.client.post("/api/third_party_apis/wawp/config/", {
            "instance_id": "123456789012", "access_token": self.token,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["has_access_token"])
        self.assertNotIn(self.token, response.data)
        config = ThirdPartyAPI.objects.get(provider="wawp")
        self.assertNotEqual(config.encrypted_api_key, self.token)
        self.assertEqual(config.get_api_key(), self.token)

    def test_non_admin_cannot_access_configuration(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/third_party_apis/wawp/config/").status_code, 403)

    def test_user_recipient_uses_authoritative_phone(self):
        config = ThirdPartyAPI.objects.create(name="Stark WAWP", provider="wawp", base_url=WAWPService.BASE_URL, instance_id="123456789012", is_active=True)
        config.set_api_key(self.token)
        config.save()
        with patch("third_party_apis.services.wawp_service.requests.post") as post:
            post.return_value = self._response(200, {"id": {"id": "abc"}})
            response = self.client.post("/api/third_party_apis/wawp/test-message/", {"user_id": self.user.id, "message": "hello"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.call_args.kwargs["json"]["chatId"], "963912345678@c.us")

    @staticmethod
    def _response(status_code, data):
        response = Mock()
        response.status_code = status_code
        response.json.return_value = data
        return response
