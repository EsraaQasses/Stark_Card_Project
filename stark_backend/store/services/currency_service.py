# store/services/currency_service.py
from decimal import Decimal, ROUND_HALF_UP
from django.conf import settings
import logging
from wallets.services import ExchangeService
from finance.conversion import CurrencyConversionService
from wallets.display import convert_display

logger = logging.getLogger(__name__)

class CurrencyService:
    """Centralized service for all currency conversions and calculations"""
    
    @staticmethod
    def get_exchange_rates():
        """Get current exchange rates with caching"""
        try:
            rates = ExchangeService.get_exchange_rates()
            
            # Validate and ensure proper rates
            usd_to_syp = Decimal(str(rates.get("usd_to_syp", {}).get("value", 116)))
            syp_to_usd = Decimal('1') / usd_to_syp if usd_to_syp > 0 else (Decimal('1') / Decimal('116'))
            
            return {
                "usd_to_syp": usd_to_syp,
                "syp_to_usd": syp_to_usd
            }
        except Exception as e:
            logger.error(f"Error getting exchange rates: {str(e)}")
            # Return safe defaults
            return {
                "usd_to_syp": Decimal('116'),
                "syp_to_usd": (Decimal('1') / Decimal('116'))  # 1/116
            }
    
    @staticmethod
    def get_display_rates(quote=None):
        """Return quote metadata for display; never invents a fallback rate."""
        if quote is False:
            return {
                "rate_available": False,
                "quote_id": None,
                "version": None,
                "effective_at": None,
                "status": None,
                "platform_buy_usd_rate_syp": None,
                "platform_sell_usd_rate_syp": None,
                "usd_to_syp": {"value": None, "change": None},
                "syp_to_usd": {"value": None, "change": None},
                "error_code": "FX_RATE_UNAVAILABLE",
            }
        if quote is not None:
            syp_to_usd = CurrencyConversionService.convert(
                amount="1", source_currency="SYP", target_currency="USD",
                rate_side="PLATFORM_SELLS_BASE", operation_type="wallet_equivalent_display",
                quote=quote,
            )
            return {
                "rate_available": True,
                "quote_id": quote.id,
                "version": quote.version,
                "effective_at": quote.effective_at,
                "status": quote.status,
                "platform_buy_usd_rate_syp": str(quote.platform_buy_base_rate),
                "platform_sell_usd_rate_syp": str(quote.platform_sell_base_rate),
                "usd_to_syp": {"value": str(quote.platform_buy_base_rate), "change": 0},
                "syp_to_usd": {"value": str(syp_to_usd.target_amount), "change": 0},
            }
        rates = ExchangeService.get_exchange_rates(display_only=True)
        return rates

    @staticmethod
    def convert_display(*, amount, source_currency, target_currency, quote=None):
        """Quote-bound display estimate with explicit rate-side policy."""
        return convert_display(
            amount=amount,
            source_currency=source_currency,
            target_currency=target_currency,
            quote=quote,
        )

    @staticmethod
    def convert_product_display(*, amount, source_currency, target_currency, quote=None):
        """Convert a product price using product-value display semantics."""
        source_currency = str(source_currency).upper()
        target_currency = str(target_currency).upper()
        if source_currency == target_currency:
            return CurrencyService.convert_display(
                amount=amount, source_currency=source_currency,
                target_currency=target_currency, quote=quote,
            )
        side = "PLATFORM_SELLS_BASE" if (source_currency, target_currency) == ("USD", "SYP") else "PLATFORM_BUYS_BASE"
        if quote is False:
            from wallets.display import _unavailable
            unavailable = _unavailable(amount, source_currency, target_currency)
            unavailable["rate_side"] = side
            return unavailable
        if quote is None:
            from wallets.rate_quotes import ExchangeRateQuoteService
            quote = ExchangeRateQuoteService.get_active_quote()
            if quote is None:
                return CurrencyService.convert_product_display(
                    amount=amount, source_currency=source_currency,
                    target_currency=target_currency, quote=False,
                )
        result = CurrencyConversionService.convert(
            amount=amount,
            source_currency=source_currency,
            target_currency=target_currency,
            rate_side=side,
            operation_type="product_price_display_sell" if side == "PLATFORM_SELLS_BASE" else "product_price_display_buy",
            quote=quote,
        )
        from wallets.display import _conversion_metadata
        return _conversion_metadata(result, quote)

    @staticmethod
    def convert_financial(*, amount, source_currency, target_currency, rate_side, operation_type, quote=None):
        """Use the quote-bound conversion boundary for financial mutations."""
        return CurrencyConversionService.convert(
            amount=amount,
            source_currency=source_currency,
            target_currency=target_currency,
            rate_side=rate_side,
            operation_type=operation_type,
            quote=quote,
        )

    @staticmethod
    def convert_amount(amount, from_currency, to_currency, exchange_rates=None):
        """Legacy display/pricing conversion; not for ledger mutations."""
        if from_currency == to_currency:
            return Decimal(str(amount))
        
        if exchange_rates is None:
            exchange_rates = CurrencyService.get_exchange_rates()
        
        amount_decimal = Decimal(str(amount))
        
        if from_currency == "USD" and to_currency == "SYP":
            return amount_decimal * exchange_rates["usd_to_syp"]
        elif from_currency == "SYP" and to_currency == "USD":
            return amount_decimal * exchange_rates["syp_to_usd"]
        else:
            raise ValueError(f"Unsupported currency conversion: {from_currency} to {to_currency}")
    
    @staticmethod
    def calculate_price_per_unit(min_amount, min_amount_price):
        """Calculate price per unit safely"""
        if not min_amount or not min_amount_price:
            return Decimal('0')
        
        min_amount_decimal = Decimal(str(min_amount))
        min_price_decimal = Decimal(str(min_amount_price))
        
        if min_amount_decimal <= 0:
            return Decimal('0')
        
        return (min_price_decimal / min_amount_decimal).quantize(Decimal('0.00000001'))
    
    @staticmethod
    def calculate_amount_based_price(amount, price_per_unit, min_amount=None, max_amount=None):
        """Calculate price for amount-based products with validation"""
        amount_decimal = Decimal(str(amount))
        price_per_unit_decimal = Decimal(str(price_per_unit))
        
        # Validate amount range
        if min_amount is not None:
            min_amount_decimal = Decimal(str(min_amount))
            if max_amount is not None:
                max_amount_decimal = Decimal(str(max_amount))
                
                # FIXED: Handle fixed quantity products (min = max)
                if min_amount_decimal == max_amount_decimal:
                    if amount_decimal != min_amount_decimal:
                        raise ValueError(f"Amount must be exactly {min_amount}")
                else:
                    # Normal range validation
                    if amount_decimal < min_amount_decimal:
                        raise ValueError(f"Amount must be at least {min_amount}")
                    
                    if amount_decimal > max_amount_decimal:
                        raise ValueError(f"Amount must be at most {max_amount}")
            else:
                # Only min amount specified
                if amount_decimal < min_amount_decimal:
                    raise ValueError(f"Amount must be at least {min_amount}")
        
        elif max_amount is not None:
            max_amount_decimal = Decimal(str(max_amount))
            if amount_decimal > max_amount_decimal:
                raise ValueError(f"Amount must be at most {max_amount}")
        
        return (amount_decimal * price_per_unit_decimal).quantize(Decimal('0.00000001'))
