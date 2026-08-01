# all_requests/models.py
from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

class Request(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("shipping", "Shipping"),
        ("in_progress", "In Progress"),
        ("objection", "Objection"),
        ("completed", "Completed"),
        ("rejected", "Rejected"),
    )
    
    TYPE_CHOICES = (
        ("payment", "Payment Request"),
        ("cashout", "Take Money Request"),
        ("support", "Support Request"),
        ("refund", "Refund Request"),
        ("other", "Other"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="requests")
    request_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="payment")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    title = models.CharField(max_length=255)
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), null=True, blank=True)
    
    payment_method = models.ForeignKey('payment_methods.PaymentMethod', on_delete=models.SET_NULL, null=True, blank=True)
    user_input_data = models.JSONField(default=dict, blank=True)  
    receipt_image = models.ImageField(upload_to='receipts/', null=True, blank=True)
    
    admin_notes = models.TextField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.name} - {self.title} ({self.status})"

class RequestComment(models.Model):
    request = models.ForeignKey(Request, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    comment = models.TextField()
    is_admin_note = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.user.name} on {self.request.title}"
