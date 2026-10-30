"""Keep old media until database commit; remove new uploads on save failure."""
import logging
from contextlib import contextmanager

from django.db import transaction
from rest_framework import serializers

from .models import PaymentMethod, PaymentMethodImage

logger = logging.getLogger(__name__)


def delete_unreferenced(storage, name):
    if not name:
        return
    try:
        if (PaymentMethod.objects.filter(icon_url=name).exists()
                or PaymentMethod.objects.filter(qr_image=name).exists()
                or PaymentMethod.objects.filter(instruction_image=name).exists()
                or PaymentMethodImage.objects.filter(image=name).exists()):
            return
        storage.delete(name)
    except Exception:
        logger.exception("Payment media cleanup failed for %s", name)


@contextmanager
def media_transaction():
    uploaded = []
    try:
        with transaction.atomic():
            yield uploaded
    except Exception:
        for storage, name in uploaded:
            delete_unreferenced(storage, name)
        raise


def save_upload(instance, field_name, upload, uploaded):
    field = instance._meta.get_field(field_name)
    storage = field.storage
    name = storage.save(field.generate_filename(instance, upload.name), upload)
    uploaded.append((storage, name))
    setattr(instance, field_name, name)


def retire_file(file):
    if file and file.name:
        storage, name = file.storage, file.name
        transaction.on_commit(lambda: delete_unreferenced(storage, name), robust=True)


def validate_image(value):
    if value is None:
        return value
    if value.size > 5 * 1024 * 1024:
        raise serializers.ValidationError("Image must be 5 MB or smaller.")
    if getattr(value, "content_type", "").lower() not in {"image/png", "image/jpeg", "image/webp"}:
        raise serializers.ValidationError("Only PNG, JPG or WEBP images are allowed.")
    return value
