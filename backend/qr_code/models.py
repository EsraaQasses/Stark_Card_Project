from django.db import models
from users.models import User

class UserQRCode(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='qr_code')
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    qr_data = models.TextField(blank=True)  # Store the raw data for regeneration
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"QR Code for {self.user.name}"