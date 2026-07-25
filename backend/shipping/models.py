# shipping/models.py
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

User = settings.AUTH_USER_MODEL

class Shipping(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("processing", "Processing"),
    )

    # Make sure this line uses 'all_requests.Request' exactly
    request = models.OneToOneField('all_requests.Request', on_delete=models.CASCADE, related_name="shipping")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shippings")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, choices=(("usd", "USD"), ("syp", "SYP")))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    admin_notes = models.TextField(blank=True, null=True)
    
    # Wallet transaction reference
    transaction_ref = models.CharField(max_length=100, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Shipping #{self.id} - {self.user.name} - {self.amount} {self.currency}"

# Make sure this line uses 'all_requests.Request' exactly
@receiver(post_save, sender='all_requests.Request')
def create_shipping_for_payment_request(sender, instance, created, **kwargs):
    """
    Automatically create shipping record when a payment request is created
    """
    if instance.request_type == 'payment' and created:
        Shipping.objects.create(
            request=instance,
            user=instance.user,
            amount=instance.amount,
            currency=instance.currency,
            status='pending'
        )