# payment_methods/models.py
from django.db import models

class PaymentMethod(models.Model):
    title = models.CharField(max_length=255)
    name = models.CharField(max_length=255, unique=True)
    icon_url = models.ImageField(upload_to="payment_methods/", blank=True, null=True)
    account_details = models.TextField() 
    instructions = models.TextField()
    note = models.TextField(blank=True, null=True) 
    requires_receipt = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class PaymentMethodField(models.Model):
    INPUT_TYPE_CHOICES = (
        ("text", "Text"),
        ("number", "Number"),
        ("email", "Email"),
        ("phone", "Phone"),
        ("file", "File"),
    )
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.CASCADE, related_name="fields")
    field_name = models.CharField(max_length=255)
    field_key = models.SlugField(max_length=255)
    input_type = models.CharField(max_length=20, choices=INPUT_TYPE_CHOICES)
    is_required = models.BooleanField(default=True)
    placeholder = models.CharField(max_length=255, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.payment_method.title} - {self.field_name}"
