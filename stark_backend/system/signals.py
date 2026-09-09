import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Notification)
def send_push_after_notification_created(sender, instance, created, **kwargs):
    if not created:
        return

    def dispatch():
        try:
            from .services.push_notifications import send_push_to_user

            send_push_to_user(
                user_id=instance.recipient_id,
                title=instance.title,
                body=instance.message,
                data={
                    "notification_id": instance.id,
                    "type": instance.type,
                    **(instance.details if isinstance(instance.details, dict) else {}),
                },
                notification_id=instance.id,
            )
        except Exception:
            logger.exception("Push notification dispatch failed for notification %s", instance.id)

    transaction.on_commit(dispatch)
