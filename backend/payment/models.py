# payments/models.py
from django.db import models
from django.conf import settings
from wallets.models import Wallet
from store.models import StoreProduct

User = settings.AUTH_USER_MODEL

class PaymentConfig(models.Model):
    """Global payment configuration"""
    profit_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=10.00,
        help_text="Default profit percentage added to product prices"
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Payment Configuration"
        verbose_name_plural = "Payment Configuration"
    
    def save(self, *args, **kwargs):
        # Ensure only one instance exists
        self.__class__.objects.exclude(id=self.id).delete()
        super().save(*args, **kwargs)
    
    @classmethod
    def get_config(cls):
        """Get or create the payment configuration"""
        try:
            return cls.objects.get()
        except cls.DoesNotExist:
            return cls.objects.create()

class Payment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    store_product = models.ForeignKey(StoreProduct, on_delete=models.CASCADE)
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE)
    
    # Payment details
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    profit_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # User input data
    user_inputs = models.JSONField(default=dict)
    
    # Payment status and tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    external_transaction_id = models.CharField(max_length=255, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - {self.user.name} - {self.final_price} - {self.status}"
    
    def calculate_final_price(self):
        """Calculate final price with profit percentage"""
        profit_amount = (self.base_price * self.profit_percentage) / 100
        return self.base_price + profit_amount
    
    def save(self, *args, **kwargs):
        if not self.final_price and self.base_price and self.profit_percentage:
            self.final_price = self.calculate_final_price()
        super().save(*args, **kwargs)