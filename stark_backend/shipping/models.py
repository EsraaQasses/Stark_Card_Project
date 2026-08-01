# shipping/models.py - ENHANCED VERSION
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal

User = settings.AUTH_USER_MODEL

class Shipping(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("processing", "Processing"),
        ("failed", "Failed"),
    )

    # Make sure this line uses 'all_requests.Request' exactly
    request = models.OneToOneField('all_requests.Request', on_delete=models.CASCADE, related_name="shipping")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shippings")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    admin_notes = models.TextField(blank=True, null=True)
    
    # Wallet transaction reference
    transaction_ref = models.CharField(max_length=100, blank=True, null=True)
    
    # Tracking fields
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name="approved_shippings",
        verbose_name="Approved By"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['user', 'status']),
            models.Index(fields=['transaction_ref']),
        ]
        verbose_name = "Shipping Request"
        verbose_name_plural = "Shipping Requests"

    def __str__(self):
        return f"Shipping #{self.id} - {self.user.name} - {self.amount} {self.currency.upper()} ({self.status})"

    @property
    def currency_display(self):
        """Get currency display name"""
        return self.currency.upper()

    @property
    def status_display(self):
        """Get status display name"""
        return dict(self.STATUS_CHOICES).get(self.status, self.status)

    @property
    def is_approved(self):
        """Check if shipping is approved"""
        return self.status == 'approved'

    @property
    def is_pending(self):
        """Check if shipping is pending"""
        return self.status == 'pending'

    @property
    def can_be_approved(self):
        """Check if shipping can be approved"""
        return (
            self.status in ['pending', 'processing'] and
            self.amount > Decimal('0') and
            self.user.is_active and
            self.request.status not in ['completed', 'rejected']
        )

    def approve(self, admin_user=None, notes=""):
        """Approve shipping programmatically"""
        if not self.can_be_approved:
            return False, "Cannot approve this shipping"
        
        self.status = 'approved'
        self.admin_notes = notes
        self.approved_by = admin_user
        self.save()
        
        return True, "Shipping approved"

    def reject(self, admin_user=None, reason=""):
        """Reject shipping programmatically"""
        self.status = 'rejected'
        self.admin_notes = reason
        self.save()
        
        return True, "Shipping rejected"


class StandardShippingRequest(models.Model):
    STATUS_CHOICES = Shipping.STATUS_CHOICES

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="standard_shippings")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    wallet_currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    payment_method = models.ForeignKey(
        'payment_methods.PaymentMethod',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    user_input_data = models.JSONField(default=dict, blank=True)
    receipt_image = models.ImageField(upload_to='receipts/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    admin_notes = models.TextField(blank=True, null=True)
    transaction_ref = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_standard_shippings",
        verbose_name="Approved By"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "status"]),
        ]
        verbose_name = "Standard Shipping Request"
        verbose_name_plural = "Standard Shipping Requests"

    def __str__(self):
        return f"StandardShipping #{self.id} - {self.user} - {self.amount} {self.currency} ({self.status})"


class AgentShippingRequest(models.Model):
    STATUS_CHOICES = Shipping.STATUS_CHOICES

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="agent_shippings")
    agent = models.ForeignKey(User, on_delete=models.CASCADE, related_name="assigned_agent_shippings")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    wallet_currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    user_input_data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    agent_notes = models.TextField(blank=True, null=True)
    user_transaction_ref = models.CharField(max_length=100, blank=True, null=True)
    agent_transaction_ref = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_agent_shippings",
        verbose_name="Approved By"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["agent", "status"]),
        ]
        verbose_name = "Agent Shipping Request"
        verbose_name_plural = "Agent Shipping Requests"

    def __str__(self):
        return f"AgentShipping #{self.id} - {self.user} via {self.agent} - {self.amount} {self.currency} ({self.status})"


class AgentAdminShippingRequest(models.Model):
    STATUS_CHOICES = Shipping.STATUS_CHOICES

    agent = models.ForeignKey(User, on_delete=models.CASCADE, related_name="admin_shippings")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    wallet_currency = models.CharField(max_length=3, choices=(("USD", "USD"), ("SYP", "SYP")), default="USD")
    user_input_data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    admin_notes = models.TextField(blank=True, null=True)
    transaction_ref = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_admin_agent_shippings",
        verbose_name="Approved By"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["agent", "status"]),
        ]
        verbose_name = "Agent Shipping via Admin Request"
        verbose_name_plural = "Agent Shipping via Admin Requests"

    def __str__(self):
        return f"AgentAdminShipping #{self.id} - {self.agent} - {self.amount} {self.currency} ({self.status})"

# Make sure this line uses 'all_requests.Request' exactly
@receiver(post_save, sender='all_requests.Request')
def create_shipping_for_payment_request(sender, instance, created, **kwargs):
    """
    Automatically create shipping record when a payment request is created
    """
    if created and instance.request_type in ['payment', 'cashout']:
        # For cashout requests, only create shipping if it is a shipping-channel request
        if instance.request_type == 'cashout':
            user_input = instance.user_input_data or {}
            channel = str(user_input.get('shipping_channel') or '').lower().strip()
            if channel not in ['agent', 'admin']:
                return
        # Check if shipping already exists
        if hasattr(instance, 'shipping'):
            return
        
        if instance.request_type == "payment":
            from wallets.models import Wallet
            from .financial_service import ShippingFinanceService
            wallet_currency = str((instance.user_input_data or {}).get("wallet_currency") or instance.currency).upper()
            wallet = Wallet.objects.filter(user=instance.user, currency=wallet_currency).first()
            if wallet is None:
                raise ValueError("Target wallet does not exist.")
            context = ShippingFinanceService.prepare(
                flow_type="shipping", user_id=instance.user_id,
                amount=instance.amount, submitted_currency=instance.currency,
                target_currency=wallet_currency, credited_wallet_id=wallet.id,
                operation_key=f"request-shipping:{instance.id}",
            )
            instance.user_input_data = ShippingFinanceService.write_snapshot(instance.user_input_data, context)
            instance.save(update_fields=["user_input_data", "updated_at"])
        Shipping.objects.create(
            request=instance,
            user=instance.user,
            amount=instance.amount,
            currency=instance.currency,
            status='pending'
        )
        print(f"Created shipping for payment request #{instance.id}")
