import logging

import requests
from django.conf import settings

from system.models import PushDeviceToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
MAX_EXPO_BATCH_SIZE = 100


def _chunks(items, size):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def send_push_to_user(*, user_id, title, body, data=None, notification_id=None):
    """Best-effort delivery to every active Expo device for a user."""
    devices = list(
        PushDeviceToken.objects.filter(user_id=user_id, is_active=True).only("id", "token")
    )
    if not devices:
        return {"sent": 0, "deactivated": 0}

    payload_data = data if isinstance(data, dict) else {}
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    expo_access_token = getattr(settings, "EXPO_ACCESS_TOKEN", "")
    if expo_access_token:
        headers["Authorization"] = f"Bearer {expo_access_token}"

    sent = 0
    deactivated = 0
    for batch in _chunks(devices, MAX_EXPO_BATCH_SIZE):
        messages = [
            {
                "to": device.token,
                "title": title,
                "body": body,
                "sound": "default",
                "priority": "high",
                "channelId": "default",
                "data": payload_data,
            }
            for device in batch
        ]
        try:
            response = requests.post(EXPO_PUSH_URL, json=messages, headers=headers, timeout=5)
            response.raise_for_status()
            result = response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning(
                "Expo push delivery failed for notification %s and user %s: %s",
                notification_id,
                user_id,
                exc,
            )
            continue

        tickets = result.get("data", []) if isinstance(result, dict) else []
        if isinstance(tickets, dict):
            tickets = [tickets]
        for device, ticket in zip(batch, tickets):
            if ticket.get("status") == "ok":
                sent += 1
            details = ticket.get("details") or {}
            if ticket.get("status") == "error" and details.get("error") == "DeviceNotRegistered":
                deactivated += PushDeviceToken.objects.filter(
                    id=device.id, is_active=True
                ).update(is_active=False)

    return {"sent": sent, "deactivated": deactivated}
