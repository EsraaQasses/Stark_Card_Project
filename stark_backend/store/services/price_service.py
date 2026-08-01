# store/services/price_service.py
from decimal import Decimal
import logging
from store.services.currency_service import CurrencyService
from wallets.rate_quotes import ExchangeRateQuoteService
from store.services.pricing import PricingPolicy
from finance.conversion import RateUnavailable
from wallets.display import _conversion_metadata

logger = logging.getLogger(__name__)

class PriceService:
    """Service for calculating final prices with user profit margins"""
    
    @staticmethod
    def calculate_user_profit_percentage(user):
        return PricingPolicy.category_profit_percentage(user)
    
    @staticmethod
    def _get_agent_commission_percentage(user):
        """Get agent commission percentage for user if applicable."""
        return PricingPolicy.agent_adjustment_percentage(user)

    @staticmethod
    def calculate_final_price(base_price, user, include_agent_commission=True):
        """Calculate final price with user's category profit and optional agent commission.

        Agent commission is calculated as a percentage of the final price (not the base),
        so we solve: final = base_with_profit / (1 - agent_commission_pct).
        """
        return PricingPolicy.native_final_amount(
            base_price, user, include_agent_adjustment=include_agent_commission,
        )[-1]

    @staticmethod
    def calculate_pricing(*, amount, source_currency, target_currency=None, user=None,
                          product=None, store_product=None, quote=None,
                          include_agent_commission=True, operation_type="product_pricing"):
        """Compatibility entry point returning the canonical immutable result."""
        return PricingPolicy.calculate(
            native_base_amount=amount,
            native_currency=source_currency,
            wallet_currency=target_currency or source_currency,
            user=user,
            product_id=getattr(product, "id", None),
            store_product_id=getattr(store_product, "id", None),
            provider_product_id=getattr(getattr(product, "external_product", None), "id", None),
            provider_cost_amount=getattr(getattr(product, "external_product", None), "base_price", None),
            provider_cost_currency="USD" if getattr(getattr(product, "external_product", None), "base_price", None) is not None else None,
            quote=quote,
            operation_type=operation_type,
            include_agent_adjustment=include_agent_commission,
            product_profit_percentage=getattr(product, "product_profit_percentage", Decimal("0")),
        )
    
    @staticmethod
    def get_product_prices(product, user=None, quote=None):
        """Get native and quote-bound display prices without touching execution."""
        base_currency = str(product.currency).upper()
        base_price = Decimal(str(product.base_price))
        quote = quote if quote is not None else ExchangeRateQuoteService.get_active_quote()
        resolved_quote = quote if quote is not None else False
        conversions = {}
        converted_prices = {}
        converted_price_strings = {}
        for target_currency in ("USD", "SYP"):
            unavailable_cross_currency = (
                resolved_quote is False and target_currency != base_currency
            )
            try:
                if unavailable_cross_currency:
                    raise RateUnavailable("No active quote for display pricing.")
                result = PricingPolicy.for_product(
                    product=product, user=user, wallet_currency=target_currency,
                    quote=resolved_quote, operation_type="product_pricing",
                )
                pricing_metadata = result.to_customer_dict()
                metadata = CurrencyService.convert_product_display(
                    amount=base_price, source_currency=base_currency,
                    target_currency=target_currency, quote=resolved_quote,
                )
                metadata["pricing"] = pricing_metadata
            except RateUnavailable:
                metadata = CurrencyService.convert_product_display(
                    amount=base_price, source_currency=base_currency,
                    target_currency=target_currency, quote=False,
                )
            conversions[target_currency] = metadata
            value = metadata["converted_amount"]
            converted_prices[target_currency] = None if value is None else float(value)
            converted_price_strings[target_currency] = value

        user_final_prices = None
        if user:
            user_final_prices = {
                currency: None if conversions[currency]["converted_amount"] is None else float(
                    conversions[currency]["pricing"]["final_customer_charge"]
                    if "pricing" in conversions[currency]
                    else converted_prices[currency]
                )
                for currency in converted_prices
            }
        cross_metadata = conversions["SYP" if base_currency == "USD" else "USD"]
        return {
            "base_currency": base_currency,
            "base_price": float(base_price),
            "base_price_decimal": str(base_price),
            "converted_prices": converted_prices,
            "converted_price_strings": converted_price_strings,
            "price_conversions": conversions,
            "user_final_prices": user_final_prices,
            "exchange_rates": CurrencyService.get_display_rates(quote=resolved_quote),
            "rate_available": cross_metadata["rate_available"],
            "quote_id": cross_metadata["quote_id"],
            "quote_version": cross_metadata["quote_version"],
            "display_only": True,
        }

    @staticmethod
    def convert_product_price(amount, source_currency, target_currency, quote=None):
        """Canonical display/preview conversion for calculators."""
        return CurrencyService.convert_product_display(
            amount=amount, source_currency=source_currency,
            target_currency=target_currency, quote=quote,
        )
