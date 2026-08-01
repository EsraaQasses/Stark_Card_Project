# transactions/models.py - COMPLETE VERSION
from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from decimal import Decimal
from django.utils import timezone

from wallets.models import Wallet

User = settings.AUTH_USER_MODEL

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ("deposit", "Deposit"),
        ("withdrawal", "Withdrawal"),
        ("transfer", "Transfer"),
        ("purchase", "Purchase"),
        ("purchase_hold", "Purchase Hold"),
        ("cashout", "Cashout"),
        ("refund", "Refund"),
        ("commission", "Commission"),
        ("fee", "Fee"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    )

    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name="transactions",
        verbose_name="User"
    )
    wallet = models.ForeignKey(
    'wallets.Wallet',
    on_delete=models.CASCADE,
    related_name="transactions",
    verbose_name="Wallet"
)
    currency = models.CharField(
        max_length=3,
        choices=(("USD", "US Dollar"), ("SYP", "Syrian Pound")),
        default="USD",
        verbose_name="Currency"
    )
    
    # Transaction details
    transaction_type = models.CharField(
        max_length=20, 
        choices=TRANSACTION_TYPES,
        verbose_name="Transaction Type"
    )
    amount = models.DecimalField(
        max_digits=20, 
        decimal_places=8,
        verbose_name="Amount"
    )
    
    # SYP equivalent tracking (for accurate reporting)
    amount_syp = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        null=True, 
        blank=True,
        verbose_name="Amount (SYP)",
        help_text="Automatically calculated SYP equivalent"
    )
    amount_usd = models.DecimalField(
        max_digits=20,
        decimal_places=8,
        null=True,
        blank=True,
        verbose_name="Amount (USD)",
        help_text="Automatically calculated USD equivalent"
    )
    exchange_rate_used = models.DecimalField(
        max_digits=16, 
        decimal_places=6, 
        null=True, 
        blank=True,
        verbose_name="Exchange Rate Used",
        help_text="USD to SYP rate at transaction time"
    )
    
    # Status and notes
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default="pending",
        verbose_name="Status"
    )
    note = models.TextField(
        null=True, 
        blank=True,
        verbose_name="Note",
        help_text="Additional information about this transaction"
    )
    
    # References
    related_transaction = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="related_transactions",
        verbose_name="Related Transaction",
        help_text="For refunds or related transactions"
    )
    external_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="External Reference",
        help_text="Reference ID from external payment processor"
    )
    payment = models.ForeignKey(
        'payment.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
        verbose_name="Payment",
        help_text="Related payment record"
    )
    exchange_rate_quote = models.ForeignKey(
        'wallets.ExchangeRateQuote', on_delete=models.PROTECT,
        null=True, blank=True, related_name='transactions'
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
    
    # For transfers
    recipient = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_transactions",
        verbose_name="Recipient",
        help_text="For transfer transactions"
    )
    recipient_wallet = models.ForeignKey(
        Wallet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_transfers",
        verbose_name="Recipient Wallet",
        help_text="Recipient's wallet for transfers"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=128, unique=True, null=True, blank=True)
    balance_after = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    balance_before = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)

    class Meta:
        verbose_name = "Transaction"
        verbose_name_plural = "Transactions"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['transaction_type', 'status']),
            models.Index(fields=['transaction_type', 'status', 'created_at']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['external_reference']),
        ]

    def __str__(self):
        return f"TX#{self.id} - {self.user.name} - {self.transaction_type} - {abs(self.amount)} {self.currency} ({self.status})"

    def save(self, *args, **kwargs):
        """Calculate USD/SYP equivalents when saving"""
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
            if snapshot_update and (previous.status in {"approved", "cancelled"} or (previous.operation_context or {}).get("snapshot_locked")) and any(
                getattr(previous, field) != getattr(self, field) for field in snapshot_fields
            ):
                raise ValidationError("Financial conversion snapshots are immutable after execution.")
        if self.wallet_id:
            self.currency = self.wallet.currency

        has_conversion_snapshot = bool(
            self.exchange_rate_side and self.source_currency and self.target_currency
        )
        if self.amount is not None and not has_conversion_snapshot and (self.amount_syp is None or self.amount_usd is None):
            try:
                from wallets.services import ExchangeService  # Import inside method
                rates = ExchangeService.get_exchange_rates()
                usd_to_syp = rates["usd_to_syp"]["value"]
                syp_to_usd = rates["syp_to_usd"]["value"]
                self.exchange_rate_used = usd_to_syp
            except Exception:
                usd_to_syp = Decimal('116')
                syp_to_usd = Decimal('1') / usd_to_syp
                self.exchange_rate_used = usd_to_syp

            if self.currency == "USD":
                self.amount_usd = self.amount
                self.amount_syp = (self.amount * usd_to_syp).quantize(Decimal('0.00000001'))
            else:
                self.amount_syp = self.amount
                self.amount_usd = (self.amount * syp_to_usd).quantize(Decimal('0.00000001'))
        
        # Set processed_at when status changes to approved
        if self.status == 'approved' and not self.processed_at:
            self.processed_at = timezone.now()
        
        super().save(*args, **kwargs)

    @property
    def is_income(self):
        """Check if transaction adds to balance"""
        return self.amount > 0

    @property
    def is_expense(self):
        """Check if transaction deducts from balance"""
        return self.amount < 0

    @property
    def absolute_amount(self):
        """Get absolute amount (positive)"""
        return abs(self.amount)

    @property
    def amount_display(self):
        """Get formatted amount with sign"""
        sign = "+" if self.is_income else "-"
        return f"{sign}{self.absolute_amount} {self.currency}"

    @property
    def amount_syp_display(self):
        """Get formatted SYP amount"""
        if self.amount_syp:
            return f"ل.س{abs(self.amount_syp):,.0f}"
        return "N/A"

    @property
    def description(self):
        """Get transaction description"""
        if self.transaction_type == 'purchase' and self.payment:
            return f"Purchase: {self.payment.store_product.name}"
        elif self.transaction_type == 'deposit':
            return "Deposit"
        elif self.transaction_type == 'transfer' and self.recipient:
            return f"Transfer to {self.recipient.name}"
        elif self.transaction_type == 'cashout' and self.recipient:
            return f"Cashout to agent {self.recipient.name}"
        elif self.transaction_type == 'refund' and self.related_transaction:
            return f"Refund for TX#{self.related_transaction.id}"
        else:
            return self.transaction_type.capitalize()

    def can_be_refunded(self):
        """Check if transaction can be refunded"""
        return (
            self.status == 'approved' and
            self.transaction_type in ['purchase', 'transfer'] and
            self.is_expense and
            not Transaction.objects.filter(
                related_transaction=self,
                transaction_type='refund',
                status='approved'
            ).exists()
        )

    def create_refund(self, reason=""):
        """Create a refund transaction for this transaction"""
        if not self.can_be_refunded():
            raise ValueError("Transaction cannot be refunded")
        from finance.services import FinanceService
        return FinanceService.refund(
            transaction_id=self.pk,
            reason=reason,
            idempotency_key=f"refund:{self.pk}",
        )

    def approve(self, admin_user=None):
        """Approve the transaction"""
        from finance.services import FinanceService
        FinanceService.approve(self.pk, admin_user=admin_user)
        return True

    def reject(self, admin_user=None, reason=""):
        """Reject the transaction"""
        from finance.services import FinanceService
        FinanceService.reject(self.pk, admin_user=admin_user, reason=reason)
        return True

    def cancel(self, reason=""):
        """Cancel the transaction (user-initiated)"""
        from finance.services import FinanceService
        FinanceService.cancel(self.pk, reason=reason)
        return True
