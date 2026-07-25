from django.db import models
from django.conf import settings
from wallets.models import Wallet

User = settings.AUTH_USER_MODEL

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ("deposit", "Deposit"),
        ("transfer", "Transfer"),
        ("purchase", "Purchase"),
    )

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    agent = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_transactions",
        limit_choices_to={"role": "agent"}
    )
    admin = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_transactions",
        limit_choices_to={"role": "admin"}
    )
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="transactions")
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    recipient_wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE,null=True,
    blank=True, related_name="received_transactions")


    def __str__(self):
        return f"{self.user} - {self.transaction_type} - {self.amount} ({self.status})"