from django.db import models
from django.conf import settings
from decimal import Decimal

User = settings.AUTH_USER_MODEL

class Wallet(models.Model):
    CURRENCY_CHOICES = (
        ("USD", "US Dollar"),
        ("SYP", "Syrian Pound"),
    )

    user = models.ForeignKey(User, related_name="wallets", on_delete=models.CASCADE)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    available_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    pending_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    class Meta:
        unique_together = ("user", "currency")

    @property
    def total_balance(self):
        return self.available_balance + self.pending_balance

    def update_balances(self):
        """Update wallet balances from transactions"""
        from transactions.models import Transaction
        
        # Calculate available balance (approved transactions)
        available = Transaction.objects.filter(
            user=self.user, 
            wallet__currency=self.currency,
            status='approved'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # Calculate pending balance (pending transactions)
        pending = Transaction.objects.filter(
            user=self.user,
            wallet__currency=self.currency, 
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        self.available_balance = available
        self.pending_balance = pending
        self.save()

    def __str__(self):
        return f"{self.user.username} - {self.currency}: {self.total_balance}"

class ExchangeRate(models.Model):
    usd_to_syp = models.DecimalField(max_digits=20, decimal_places=3)
    syp_to_usd = models.DecimalField(max_digits=20, decimal_places=6, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Calculate inverse rate automatically
        if self.usd_to_syp and self.usd_to_syp > 0:
            self.syp_to_usd = Decimal('1') / self.usd_to_syp
        super().save(*args, **kwargs)

    def __str__(self):
        return f"1 USD = {self.usd_to_syp} SYP"