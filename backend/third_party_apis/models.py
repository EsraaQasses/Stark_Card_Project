from django.db import models
from django.utils import timezone
from .utils.encryption import encrypt_text, decrypt_text

class ThirdPartyAPI(models.Model):
    
    PROVIDER_CHOICES = [
        ("daily", "Daily"),
        ("alfaour", "Alfaour"),
        ("alaaeddin", "Alaaeddin"),
    ]
    
    name = models.CharField(max_length=120)
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    description = models.TextField(blank=True)
    
    base_url = models.URLField()
    encrypted_api_key = models.TextField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    max_daily_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    priority = models.IntegerField(default=1)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'third_party_apis'
        verbose_name = 'Third Party API'
        verbose_name_plural = 'Third Party APIs'
        ordering = ["priority", "name"]
        indexes = [
            models.Index(fields=['provider', 'is_active']),
            models.Index(fields=['is_active', 'priority']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.provider})"
    
    def set_api_key(self, plain_api_key: str):
        if plain_api_key is None:
            self.encrypted_api_key = None
        else:
            self.encrypted_api_key = encrypt_text(plain_api_key)
    
    def get_api_key(self) -> str | None:
        if not self.encrypted_api_key:
            return None
        return decrypt_text(self.encrypted_api_key)

class APITransaction(models.Model):
    
    api_config = models.ForeignKey(ThirdPartyAPI, on_delete=models.CASCADE, related_name='transactions')
    internal_transaction = models.ForeignKey('transactions.Transaction', on_delete=models.CASCADE, null=True, blank=True)
    
    request_payload = models.JSONField(default=dict)
    endpoint_used = models.CharField(max_length=255)
    request_timestamp = models.DateTimeField(auto_now_add=True)
    
    response_payload = models.JSONField(null=True, blank=True)
    response_timestamp = models.DateTimeField(null=True, blank=True)
    http_status_code = models.IntegerField(null=True, blank=True)
    
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    
    external_transaction_id = models.CharField(max_length=255, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'api_transactions'
        verbose_name = 'API Transaction'
        verbose_name_plural = 'API Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['api_config', 'created_at']),
            models.Index(fields=['success', 'created_at']),
            models.Index(fields=['external_transaction_id']),
        ]
    
    def __str__(self):
        return f"{self.api_config.name} - {self.created_at}"
    
    def save(self, *args, **kwargs):
        if self.response_payload and not self.response_timestamp:
            self.response_timestamp = timezone.now()
        super().save(*args, **kwargs)