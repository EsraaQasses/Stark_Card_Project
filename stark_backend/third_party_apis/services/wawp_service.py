"""Small, provider-only WAWP v2 client.

The token is deliberately supplied only inside this service. Callers receive
normalized results and never see provider response bodies or credentials.
"""
import logging
import re
from urllib.parse import urlencode

import requests
from django.conf import settings

from ..models import ThirdPartyAPI

logger = logging.getLogger(__name__)


class WAWPServiceError(Exception):
    def __init__(self, code, message, status_code=None):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class WAWPService:
    BASE_URL = "https://api.wawp.net/v2"
    TIMEOUT = 10
    MAX_MESSAGE_LENGTH = 4096

    @classmethod
    def normalize_phone(cls, phone):
        value = str(phone or "").strip()
        value = re.sub(r"[\s().-]", "", value)
        if value.startswith("00"):
            value = "+" + value[2:]
        if not re.fullmatch(r"\+[1-9]\d{7,14}", value):
            raise WAWPServiceError("WAWP_INVALID_PHONE", "Phone number must be in international format.")
        return value[1:] + "@c.us"

    @classmethod
    def _config(cls):
        config = ThirdPartyAPI.objects.filter(provider="wawp", is_active=True).first()
        if not config:
            raise WAWPServiceError("WAWP_NOT_CONFIGURED", "WAWP is not configured or is inactive.")
        if not config.instance_id or not config.get_api_key():
            raise WAWPServiceError("WAWP_INVALID_CONFIGURATION", "WAWP configuration is incomplete.")
        return config

    @classmethod
    def _request(cls, config, endpoint, *, body=None):
        token = config.get_api_key()
        # WAWP v2 currently documents instance_id/access_token as query params.
        # Do not log this URL: it contains the encrypted credential after decrypt.
        params = urlencode({"instance_id": config.instance_id, "access_token": token})
        try:
            response = requests.post(
                f"{cls.BASE_URL}/{endpoint}?{params}",
                json=body or {},
                headers={"Content-Type": "application/json"},
                timeout=cls.TIMEOUT,
            )
        except requests.Timeout as exc:
            raise WAWPServiceError("WAWP_TIMEOUT", "WAWP did not respond in time.") from exc
        except requests.RequestException as exc:
            logger.warning("WAWP request failed: %s", exc.__class__.__name__)
            raise WAWPServiceError("WAWP_CONNECTION_ERROR", "Unable to reach WAWP.") from exc

        try:
            data = response.json()
        except ValueError:
            data = None

        if not 200 <= response.status_code < 300:
            code = {
                400: "WAWP_BAD_REQUEST", 401: "WAWP_INVALID_CREDENTIALS",
                404: "WAWP_SESSION_NOT_FOUND", 429: "WAWP_RATE_LIMITED",
            }.get(response.status_code, "WAWP_PROVIDER_ERROR")
            message = {
                "WAWP_INVALID_CREDENTIALS": "WAWP credentials were rejected.",
                "WAWP_SESSION_NOT_FOUND": "The configured WAWP session was not found.",
                "WAWP_RATE_LIMITED": "WAWP rate limit was reached.",
            }.get(code, "WAWP rejected the request.")
            raise WAWPServiceError(code, message, response.status_code)
        if not isinstance(data, dict):
            raise WAWPServiceError("WAWP_MALFORMED_RESPONSE", "WAWP returned an invalid response.", response.status_code)
        return data

    @classmethod
    def test_connection(cls):
        data = cls._request(cls._config(), "session/info")
        provider_status = str(data.get("status") or "").upper()
        if provider_status != "WORKING":
            return {"success": False, "status": "disconnected", "error_code": "WAWP_SESSION_DISCONNECTED", "message": "WAWP session is not connected."}
        return {"success": True, "status": "connected"}

    @classmethod
    def send_text(cls, phone, message):
        if not isinstance(message, str) or not message.strip():
            raise WAWPServiceError("WAWP_INVALID_MESSAGE", "Message cannot be empty.")
        if len(message) > cls.MAX_MESSAGE_LENGTH:
            raise WAWPServiceError("WAWP_MESSAGE_TOO_LONG", "Message exceeds the maximum length.")
        chat_id = cls.normalize_phone(phone)
        data = cls._request(cls._config(), "send/text", body={"chatId": chat_id, "message": message})
        return {"success": True, "status": "accepted", "message_id": cls._message_id(data)}

    @staticmethod
    def _message_id(data):
        message_id = data.get("message_id")
        if message_id:
            return str(message_id)
        value = data.get("id")
        if isinstance(value, dict):
            return value.get("_serialized") or value.get("id")
        return str(value) if value else None
