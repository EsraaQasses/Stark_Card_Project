# wallets/signals.py - ENHANCED
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.conf import settings
from django.core.cache import cache
from .models import Wallet, ExchangeRate
import logging

logger = logging.getLogger(__name__)
User = settings.AUTH_USER_MODEL

@receiver(post_save, sender=User)
def create_user_wallet(sender, instance, created, raw=False, **kwargs):
    """
    Automatically create a wallet when a new user is created
    """
    if raw or not created:
        return
    if created:
        try:
            Wallet.objects.get_or_create(user=instance, currency="USD")
            Wallet.objects.get_or_create(user=instance, currency="SYP")
            logger.info(f"Created wallets for user: {instance.name}")
        except Exception as e:
            logger.error(f"Failed to create wallet for user {instance.name}: {e}")


@receiver(post_save, sender=ExchangeRate)
def clear_exchange_rate_cache(sender, instance, **kwargs):
    """Clear exchange rate cache when rates are updated"""
    cache.delete("exchange_rates")
    if hasattr(cache, "delete_pattern"):
        cache.delete_pattern("wallet_data_*")
    cache.delete("admin_wallet_data")
    logger.info("Exchange rate cache cleared")


@receiver(post_save, sender=Wallet)
def clear_wallet_cache(sender, instance, **kwargs):
    """Clear wallet cache when wallet is updated"""
    cache.delete(f"wallet_data_{instance.user.id}")
    cache.delete("admin_wallet_data")
    logger.info(f"Wallet cache cleared for user: {instance.user.id}")

from model_utils import FieldTracker


@receiver(pre_save, sender=Wallet)
def log_balance_changes(sender, instance, **kwargs):
    """Log wallet balance changes for audit"""
    if not instance.pk:
        return 
    
    try:
        old_instance = Wallet.objects.get(pk=instance.pk)
        
        if old_instance.available_balance != instance.available_balance:
            logger.info(
                f"Wallet {instance.id} available balance changed: "
                f"{old_instance.available_balance} -> {instance.available_balance}"
            )
        
        if old_instance.pending_balance != instance.pending_balance:
            logger.info(
                f"Wallet {instance.id} pending balance changed: "
                f"{old_instance.pending_balance} -> {instance.pending_balance}"
            )
            
    except Wallet.DoesNotExist:
        pass
