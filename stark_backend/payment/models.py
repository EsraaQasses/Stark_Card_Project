# payments/models.py - FIXED VERSION
from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from decimal import Decimal
from django.utils import timezone

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
        ('refunded', 'Refunded'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    wallet = models.ForeignKey('wallets.Wallet', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    store_product = models.ForeignKey('store.StoreProduct', on_delete=models.CASCADE, related_name='payments')
    
    # Payment details
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    profit_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    final_price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(
        max_length=3,
        choices=(("USD", "US Dollar"), ("SYP", "Syrian Pound")),
        default="USD"
    )
    amount_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    amount_syp = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    exchange_rate_used = models.DecimalField(max_digits=16, decimal_places=6, null=True, blank=True)
    exchange_rate_quote = models.ForeignKey(
        'wallets.ExchangeRateQuote', on_delete=models.PROTECT,
        null=True, blank=True, related_name='payments'
    )
    exchange_rate_side = models.CharField(
        max_length=24,
        choices=(
            ('PLATFORM_BUYS_BASE', 'Platform buys base'),
            ('PLATFORM_SELLS_BASE', 'Platform sells base'),
            ('NONE', 'No conversion'),
        ),
        null=True, blank=True,
    )
    source_amount = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    source_currency = models.CharField(max_length=3, null=True, blank=True)
    target_amount = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    target_currency = models.CharField(max_length=3, null=True, blank=True)
    rounding_mode = models.CharField(max_length=64, null=True, blank=True)
    operation_context = models.JSONField(default=dict, blank=True)
    image_url = models.URLField(max_length=2048, null=True, blank=True)
    image_source = models.CharField(max_length=16, null=True, blank=True)
    image_available = models.BooleanField(null=True, blank=True)
    image_is_fallback = models.BooleanField(default=False)
    
    # User input data
    user_inputs = models.JSONField(default=dict)
    
    # Payment status and tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    external_transaction_id = models.CharField(max_length=255, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    refunded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='refunded_payments')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['store_product', 'status']),
        ]
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
    
    def __str__(self):
        return f"Payment #{self.id} - {self.user.name} - {self.final_price} {self.currency} - {self.status}"
    
    def save(self, *args, **kwargs):
        if self.pk:
            previous = type(self).objects.get(pk=self.pk)
            snapshot_fields = (
                "exchange_rate_quote_id", "exchange_rate_side", "source_amount",
                "source_currency", "target_amount", "target_currency", "rounding_mode",
                "operation_context", "exchange_rate_used", "amount_usd", "amount_syp",
                "image_url", "image_source", "image_available", "image_is_fallback",
            )
            snapshot_update = not kwargs.get("update_fields") or bool(
                set(kwargs.get("update_fields") or ()) & set(snapshot_fields)
            )
            if snapshot_update and (previous.status in {"success", "refunded"} or (previous.operation_context or {}).get("snapshot_locked")) and any(
                getattr(previous, field) != getattr(self, field) for field in snapshot_fields
            ):
                raise ValidationError("Financial conversion snapshots are immutable after execution.")
        if not self.final_price and self.base_price and self.profit_percentage:
            self.final_price = self.calculate_final_price()
        has_conversion_snapshot = bool(
            self.exchange_rate_side and self.source_currency and self.target_currency
        )
        if self.final_price and not has_conversion_snapshot and (self.amount_usd is None or self.amount_syp is None):
            try:
                from wallets.services import ExchangeService
                rates = ExchangeService.get_exchange_rates()
                usd_to_syp = rates["usd_to_syp"]["value"]
                syp_to_usd = rates["syp_to_usd"]["value"]
                self.exchange_rate_used = usd_to_syp
            except Exception:
                usd_to_syp = Decimal('116')
                syp_to_usd = Decimal('1') / usd_to_syp
                self.exchange_rate_used = usd_to_syp

            if self.currency == "USD":
                self.amount_usd = self.final_price
                self.amount_syp = (self.final_price * usd_to_syp).quantize(Decimal('0.01'))
            else:
                self.amount_syp = self.final_price
                self.amount_usd = (self.final_price * syp_to_usd).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)
    
    def calculate_final_price(self):
        """Calculate final price with profit percentage"""
        profit_amount = (self.base_price * self.profit_percentage) / Decimal('100')
        return self.base_price + profit_amount
    
    def get_profit_amount(self):
        """Calculate the profit amount"""
        if self.profit_percentage and self.base_price:
            return (self.base_price * self.profit_percentage) / Decimal('100')
        return Decimal('0')
    
    @property
    def is_refundable(self):
        """Check if payment can be refunded"""
        return (
            self.status == 'success' and
            self.processed_at and
            (timezone.now() - self.processed_at).days <= 30  # 30-day refund window
        )
    
    @property
    def can_be_cancelled(self):
        """Check if payment can be cancelled"""
        return self.status in ['pending', 'processing']
    
    @property
    def description(self):
        """Get payment description"""
        if self.store_product:
            return f"Purchase: {self.store_product.name}"
        return f"Payment #{self.id}"
