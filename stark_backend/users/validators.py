import os
from django.core.exceptions import ValidationError
from django.conf import settings
from PIL import Image

def validate_avatar_size(value):
    """
    Validate that avatar file size is within limit
    """
    if value.size > settings.AVATAR_MAX_SIZE:
        raise ValidationError(f'File size too large. Maximum size is {settings.AVATAR_MAX_SIZE // 1024 // 1024}MB.')

def validate_avatar_extension(value):
    """
    Validate that avatar has allowed extension
    """
    ext = os.path.splitext(value.name)[1].lower().lstrip('.')
    if ext not in settings.ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(f'Unsupported file extension. Allowed: {", ".join(settings.ALLOWED_IMAGE_EXTENSIONS)}')

def validate_avatar_dimensions(value):
    """
    Validate avatar dimensions
    """
    try:
        with Image.open(value) as img:
            width, height = img.size
            if width > 2000 or height > 2000:
                raise ValidationError('Image dimensions too large. Maximum 2000x2000 pixels.')
            if width < 50 or height < 50:
                raise ValidationError('Image dimensions too small. Minimum 50x50 pixels.')
    except Exception as e:
        raise ValidationError('Invalid image file.')