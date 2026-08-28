# wallets/models.py
from django.db import models
from django.conf import settings
from decimal import Decimal
from django.db.models import Sum, Q
from django.db.models.functions import Abs
import logging
from model_utils import FieldTracker
from django.core.exceptions import ValidationError


logger = logging.getLogger(__name__)
User = settings.AUTH_USER_MODEL

class ExchangeRate(models.Model):
    """Store USD to SYP exchange rates"""
    usd_to_syp = models.DecimalField(max_digits=20, decimal_places=3)
    syp_to_usd = models.DecimalField(max_digits=20, decimal_places=6, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        """Validate exchange rate"""
        if self.usd_to_syp < Decimal('10') or self.usd_to_syp > Decimal('1000'):
            raise ValidationError("Exchange rate seems unrealistic. Expected between 10 and 1,000 SYP per USD.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        if self.usd_to_syp and self.usd_to_syp > 0:
            self.syp_to_usd = Decimal('1') / self.usd_to_syp
        super().save(*args, **kwargs)

    def __str__(self):
        return f"1 USD = {self.usd_to_syp} SYP"
    
    class Meta:
        verbose_name = "Exchange Rate"
        verbose_name_plural = "Exchange Rates"


class ExchangeRateQuote(models.Model):
    """Immutable USD/SYP quote history used by the Phase 1.2 foundation."""

    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_SUPERSEDED = "superseded"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = (
        (STATUS_DRAFT, "Draft"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_SUPERSEDED, "Superseded"),
        (STATUS_CANCELLED, "Cancelled"),
    )
    SOURCE_CHOICES = (
        ("manual", "Manual"),
        ("migration", "Migration"),
        ("system", "System"),
    )

    base_currency = models.CharField(max_length=3, default="USD")
    quote_currency = models.CharField(max_length=3, default="SYP")
    platform_buy_base_rate = models.DecimalField(max_digits=20, decimal_places=6)
    platform_sell_base_rate = models.DecimalField(max_digits=20, decimal_places=6)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    source = models.CharField(max_length=12, choices=SOURCE_CHOICES, default="manual")
    effective_at = models.DateTimeField(null=True, blank=True)
    superseded_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="exchange_rate_quotes",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    activation_note = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-version", "-created_at"]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(base_currency=models.F("quote_currency")),
                name="exchange_quote_distinct_currencies",
            ),
            models.CheckConstraint(
                check=models.Q(platform_buy_base_rate__gt=0),
                name="exchange_quote_buy_rate_positive",
            ),
            models.CheckConstraint(
                check=models.Q(platform_sell_base_rate__gt=0),
                name="exchange_quote_sell_rate_positive",
            ),
            models.CheckConstraint(
                check=models.Q(platform_sell_base_rate__gte=models.F("platform_buy_base_rate")),
                name="exchange_quote_sell_not_below_buy",
            ),
            models.UniqueConstraint(
                fields=["base_currency", "quote_currency"],
                condition=models.Q(status="active"),
                name="exchange_quote_one_active_pair",
            ),
        ]
        indexes = [
            models.Index(fields=["base_currency", "quote_currency", "status"]),
            models.Index(fields=["base_currency", "quote_currency", "effective_at"]),
            models.Index(fields=["base_currency", "quote_currency", "version"]),
        ]

    def clean(self):
        super().clean()
        if self.base_currency == self.quote_currency:
            raise ValidationError("Base and quote currencies must differ.")
        if self.platform_buy_base_rate <= 0 or self.platform_sell_base_rate <= 0:
            raise ValidationError("Both quote rates must be positive.")
        if self.platform_sell_base_rate < self.platform_buy_base_rate:
            raise ValidationError("Sell rate cannot be below buy rate.")
        if self.status in {self.STATUS_ACTIVE, self.STATUS_SUPERSEDED} and not self.effective_at:
            raise ValidationError("Active and superseded quotes require effective_at.")

    def save(self, *args, **kwargs):
        if self.pk and not getattr(self, "_lifecycle_update", False):
            previous = type(self).objects.get(pk=self.pk)
            if not getattr(self, "_lifecycle_update", False) and previous.status in {self.STATUS_ACTIVE, self.STATUS_SUPERSEDED} and previous.status != self.status:
                raise ValidationError("Quote lifecycle changes must use ExchangeRateQuoteService.")
            if not getattr(self, "_lifecycle_update", False) and previous.status in {self.STATUS_ACTIVE, self.STATUS_SUPERSEDED}:
                immutable_fields = (
                    "base_currency", "quote_currency", "platform_buy_base_rate",
                    "platform_sell_base_rate", "source", "created_by", "activation_note", "version",
                )
                if any(getattr(previous, field) != getattr(self, field) for field in immutable_fields):
                    raise ValidationError("Activated or historical quote fields are immutable.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in {self.STATUS_ACTIVE, self.STATUS_SUPERSEDED}:
            raise ValidationError("Active or historical quotes cannot be deleted.")
        return super().delete(*args, **kwargs)


class Wallet(models.Model):
    """
    Wallet per user per currency.
    """
    CURRENCY_CHOICES = (
        ("USD", "US Dollar"),
        ("SYP", "Syrian Pound"),
    )
    user = models.ForeignKey(
        User,
        related_name="wallets",
        on_delete=models.CASCADE,
        verbose_name="User"
    )
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default="USD",
        verbose_name="Currency"
    )
    available_balance = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.00,
        verbose_name="Available Balance"
    )
    pending_balance = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.00,
        verbose_name="Pending Balance"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    tracker = FieldTracker(fields=['available_balance', 'pending_balance'])

    class Meta:
        verbose_name = "Wallet"
        verbose_name_plural = "Wallets"
        unique_together = ("user", "currency")
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['available_balance']),
            models.Index(fields=['currency']),
        ]

    def __str__(self):
        return f"{self.user.name} - {self.currency} Available: {self.available_balance}, Pending: {self.pending_balance}"

    @property
    def total_balance(self):
        """Total balance in USD"""
        return self.available_balance + self.pending_balance

    @property
    def balance(self):
        """Alias for available_balance for backward compatibility"""
        return self.available_balance

    @property
    def available_balance_syp(self):
        """Display-only SYP equivalent; ``None`` means no active quote."""
        from .display import convert_display
        result = convert_display(
            amount=self.available_balance, source_currency=self.currency, target_currency="SYP"
        )
        return None if result["converted_amount"] is None else Decimal(result["converted_amount"])

    @property
    def pending_balance_syp(self):
        """Display-only SYP equivalent; ``None`` means no active quote."""
        from .display import convert_display
        result = convert_display(
            amount=self.pending_balance, source_currency=self.currency, target_currency="SYP"
        )
        return None if result["converted_amount"] is None else Decimal(result["converted_amount"])

    @property
    def total_balance_syp(self):
        """Display-only total SYP equivalent; ``None`` means unavailable."""
        available = self.available_balance_syp
        pending = self.pending_balance_syp
        if available is None or pending is None:
            return None
        return (available + pending).quantize(Decimal('0.00000001'))

    def update_balances(self):
        """Update wallet balances from approved transactions"""
        try:
            # Use string reference to avoid circular import
            from transactions.models import Transaction
            
            # Transfer direction is determined by amount sign, so don't force transfer as outflow.
            outflow_types = ["purchase", "withdrawal", "fee", "purchase_hold", "cashout"]

            approved_in = Transaction.objects.filter(
                wallet=self,
                status='approved',
                amount__gt=0
            ).exclude(
                transaction_type__in=outflow_types
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

            approved_out = Transaction.objects.filter(
                wallet=self,
                status='approved'
            ).filter(
                Q(amount__lt=0) | Q(transaction_type__in=outflow_types)
            ).aggregate(total=Sum(Abs('amount')))['total'] or Decimal('0')

            pending_out = Transaction.objects.filter(
                wallet=self,
                status='pending'
            ).filter(
                Q(amount__lt=0) | Q(transaction_type__in=outflow_types)
            ).aggregate(total=Sum(Abs('amount')))['total'] or Decimal('0')

            pending_in = Transaction.objects.filter(
                wallet=self,
                status='pending',
                amount__gt=0
            ).exclude(
                transaction_type__in=outflow_types
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

            self.available_balance = approved_in - approved_out - pending_out
            self.pending_balance = pending_in + pending_out
            self.save()
            
            return True
        except Exception as e:
            logger.error(f"Could not update wallet balances: {e}")
            return False

    def deduct_funds(self, amount, note="", transaction_type="purchase", allow_overdraft=False, overdraft_limit=None):
        """Deduct funds from wallet and create transaction"""
        from finance.services import FinanceService
        return FinanceService.withdraw(
            wallet_id=self.pk,
            amount=amount,
            note=note,
            transaction_type=transaction_type,
            allow_overdraft=allow_overdraft,
            overdraft_limit=overdraft_limit,
        )

    def add_funds(self, amount, note="", transaction_type="deposit"):
        """Add funds to wallet and create transaction"""
        from finance.services import FinanceService
        return FinanceService.deposit(
            wallet_id=self.pk,
            amount=amount,
            note=note,
            transaction_type=transaction_type,
        )

    def approve_transaction(self, transaction):
        """Approve a pending transaction"""
        from finance.services import FinanceService
        FinanceService.approve(transaction.pk)
        return True

    def reject_transaction(self, transaction):
        """Reject a pending transaction"""
        from finance.services import FinanceService
        FinanceService.reject(transaction.pk)
        return True

    def get_summary(self):
        """Get wallet summary for display"""
        return {
            'id': self.id,
            'user': self.user.name,
            'currency': self.currency,
            'available': float(self.available_balance),
            'pending': float(self.pending_balance),
            'total': float(self.total_balance),
            'available_syp': None if self.available_balance_syp is None else float(self.available_balance_syp),
            'pending_syp': None if self.pending_balance_syp is None else float(self.pending_balance_syp),
            'total_syp': None if self.total_balance_syp is None else float(self.total_balance_syp),
            'last_updated': self.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        }

    def deposit(self, amount, description="Deposit"):
        """Properly deposit funds to wallet"""
        return self.add_funds(amount, description, "deposit")
    
    def add_test_funds(self, amount=50000):
        """Add test funds for development"""
        return self.deposit(amount, "Test funds for development")
