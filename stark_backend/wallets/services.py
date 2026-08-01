# wallets/services.py - FIXED VERSION
from decimal import Decimal
from django.core.cache import cache
from django.db.models import Sum
import logging
from .models import ExchangeRate, Wallet
from .rate_quotes import ExchangeRateQuoteService
from .display import convert_display, wallet_equivalents
from finance.precision import quantize_rate
from django.conf import settings
from users.models import User  # Add this import

logger = logging.getLogger(__name__)

class ExchangeService:
    """Service class for exchange rate operations"""
    
    @staticmethod
    def get_exchange_rates(display_only=False):
        """Get current exchange rates with caching"""
        active_quote = ExchangeRateQuoteService.get_active_quote()
        if active_quote:
            quote_cache_key = ExchangeRateQuoteService.cache_key(active_quote)
            cached_quote = cache.get(quote_cache_key)
            if cached_quote:
                return cached_quote
            buy_rate = active_quote.platform_buy_base_rate
            sell_rate = active_quote.platform_sell_base_rate
            syp_per_one = convert_display(
                amount=Decimal("1"), source_currency="SYP", target_currency="USD", quote=active_quote
            )["converted_amount"]
            rates_data = {
                "rate_available": True,
                "usd_to_syp": {"value": buy_rate, "change": 0},
                "syp_to_usd": {
                    "value": quantize_rate(syp_per_one),
                    "change": 0,
                },
                "quote_id": active_quote.id,
                "base_currency": active_quote.base_currency,
                "quote_currency": active_quote.quote_currency,
                "platform_buy_usd_rate_syp": buy_rate,
                "platform_sell_usd_rate_syp": sell_rate,
                "effective_at": active_quote.effective_at,
                "version": active_quote.version,
                "status": active_quote.status,
                "spread_amount": sell_rate - buy_rate,
                "spread_percentage": ((sell_rate - buy_rate) / buy_rate * 100).quantize(Decimal("0.000001")),
            }
            cache.set(quote_cache_key, rates_data, 300)
            return rates_data
        unavailable = {
            "rate_available": False,
            "code": "FX_RATE_UNAVAILABLE",
            "quote_id": None,
            "version": None,
            "effective_at": None,
            "status": None,
            "platform_buy_usd_rate_syp": None,
            "platform_sell_usd_rate_syp": None,
            "usd_to_syp": {"value": None, "change": None},
            "syp_to_usd": {"value": None, "change": None},
        }
        if display_only:
            return unavailable

        # Legacy compatibility for unmigrated transactional consumers. D1
        # display paths always pass display_only=True and never reach here.
        try:
            rate = ExchangeRate.objects.order_by("-updated_at").first()
            if not rate:
                logger.warning("ExchangeService: no ExchangeRate found, creating default 116.")
                rate = ExchangeRate.objects.create(usd_to_syp=Decimal("116"))
            if not rate.syp_to_usd or rate.syp_to_usd <= 0:
                rate.syp_to_usd = (Decimal("1") / rate.usd_to_syp).quantize(Decimal("0.000001"))
                rate.save(update_fields=["syp_to_usd", "updated_at"])
            return {
                "rate_available": False,
                "legacy_compatibility": True,
                "usd_to_syp": {"value": rate.usd_to_syp, "change": 0},
                "syp_to_usd": {"value": rate.syp_to_usd, "change": 0},
                "quote_id": None,
                "version": None,
                "effective_at": None,
                "status": None,
                "platform_buy_usd_rate_syp": None,
                "platform_sell_usd_rate_syp": None,
            }
        except Exception as exc:
            logger.error("Error getting legacy exchange rates: %s", exc)
            return unavailable


class WalletService:
    """Service class for wallet operations"""
    
    @staticmethod
    def get_or_create_wallet(user, currency="USD"):
        """Get or create wallet for user and currency"""
        wallet, created = Wallet.objects.get_or_create(user=user, currency=currency)
        if created:
            wallet.update_balances()
        return wallet
    
    @staticmethod
    def get_wallet_data(user=None):
        """
        Get wallet data for specific user with both currencies
        """
        if not user:
            return WalletService.get_admin_wallet_data()
        
        cache_key = f"wallet_data_{user.id}"
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return cached_data
        
        try:
            # Get user's wallets
            wallet_usd = WalletService.get_or_create_wallet(user, "USD")
            wallet_syp = WalletService.get_or_create_wallet(user, "SYP")
            wallet_usd.update_balances()
            wallet_syp.update_balances()
            
            quote = ExchangeRateQuoteService.get_active_quote()
            
            wallet_data = {
                "USD": {
                    "available": wallet_usd.available_balance,
                    "pending": wallet_usd.pending_balance,
                    "total": wallet_usd.total_balance
                },
                "SYP": {
                    "available": wallet_syp.available_balance,
                    "pending": wallet_syp.pending_balance,
                    "total": wallet_syp.total_balance
                },
                "exchange_rate": None if quote is None else str(quote.platform_buy_base_rate),
                "rate_available": quote is not None,
                "quote_id": None if quote is None else quote.id,
                "quote_version": None if quote is None else quote.version,
                "equivalents": {
                    "USD": wallet_equivalents(wallet_usd, target_currency="SYP", quote=quote),
                    "SYP": wallet_equivalents(wallet_syp, target_currency="USD", quote=quote),
                },
            }
            
            # Cache for 30 seconds
            cache.set(cache_key, wallet_data, 30)
            return wallet_data
            
        except Exception as e:
            logger.error(f"Error getting wallet data: {str(e)}")
            return {
                "USD": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")},
                "SYP": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")},
                "exchange_rate": None,
                "rate_available": False,
                "quote_id": None,
                "quote_version": None,
            }
    
    @staticmethod
    def get_admin_wallet_data():
        """Optimized wallet data for admin dashboard"""
        cache_key = "admin_wallet_data"
        cached = cache.get(cache_key)
        
        if cached:
            return cached
        
        try:
            # Use aggregate queries per currency
            wallets_usd = Wallet.objects.filter(currency="USD").aggregate(
                total_available=Sum('available_balance'),
                total_pending=Sum('pending_balance')
            )
            wallets_syp = Wallet.objects.filter(currency="SYP").aggregate(
                total_available=Sum('available_balance'),
                total_pending=Sum('pending_balance')
            )
            
            usd_available = wallets_usd['total_available'] or Decimal('0')
            usd_pending = wallets_usd['total_pending'] or Decimal('0')
            usd_total = usd_available + usd_pending

            syp_available = wallets_syp['total_available'] or Decimal('0')
            syp_pending = wallets_syp['total_pending'] or Decimal('0')
            syp_total = syp_available + syp_pending
            
            quote = ExchangeRateQuoteService.get_active_quote()
            
            data = {
                "USD": {
                    "available": usd_available,
                    "pending": usd_pending,
                    "total": usd_total
                },
                "SYP": {
                    "available": syp_available,
                    "pending": syp_pending,
                    "total": syp_total
                },
                "exchange_rate": None if quote is None else str(quote.platform_buy_base_rate),
                "rate_available": quote is not None,
                "quote_id": None if quote is None else quote.id,
                "quote_version": None if quote is None else quote.version,
                "equivalents": {
                    "USD": {
                        "available": None if quote is None else convert_display(
                            amount=usd_available, source_currency="USD", target_currency="SYP", quote=quote
                        ),
                        "pending": None if quote is None else convert_display(
                            amount=usd_pending, source_currency="USD", target_currency="SYP", quote=quote
                        ),
                        "total": None if quote is None else convert_display(
                            amount=usd_total, source_currency="USD", target_currency="SYP", quote=quote
                        ),
                    },
                    "SYP": {
                        "available": None if quote is None else convert_display(
                            amount=syp_available, source_currency="SYP", target_currency="USD", quote=quote
                        ),
                        "pending": None if quote is None else convert_display(
                            amount=syp_pending, source_currency="SYP", target_currency="USD", quote=quote
                        ),
                        "total": None if quote is None else convert_display(
                            amount=syp_total, source_currency="SYP", target_currency="USD", quote=quote
                        ),
                    },
                },
                "user_count": User.objects.count(),
                "active_wallets": Wallet.objects.count()
            }
            
            cache.set(cache_key, data, 60)  # Cache for 1 minute
            return data
            
        except Exception as e:
            logger.error(f"Error getting admin wallet data: {str(e)}")
            return {
                "USD": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")},
                "SYP": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")},
                "exchange_rate": None,
                "rate_available": False,
                "quote_id": None,
                "quote_version": None,
            }
