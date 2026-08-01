"""Quote-bound, read-only wallet display conversions."""

from decimal import Decimal

from finance.conversion import (
    ConversionError,
    CurrencyConversionService,
    RateSide,
    RateUnavailable,
)
from finance.precision import MONEY_QUANTUM

from .models import ExchangeRateQuote
from .rate_quotes import ExchangeRateQuoteService


DISPLAY_ONLY = True


def display_rate_side(source_currency, target_currency):
    source_currency = str(source_currency).upper()
    target_currency = str(target_currency).upper()
    if source_currency == target_currency:
        return RateSide.NONE
    if (source_currency, target_currency) == ("USD", "SYP"):
        return RateSide.PLATFORM_BUYS_BASE
    if (source_currency, target_currency) == ("SYP", "USD"):
        return RateSide.PLATFORM_SELLS_BASE
    raise ConversionError("Only USD/SYP display conversions are supported.")


def _unavailable(amount, source_currency, target_currency):
    return {
        "rate_available": False,
        "quote_id": None,
        "quote_version": None,
        "rate_side": display_rate_side(source_currency, target_currency).value,
        "rate_used": None,
        "source_amount": str(Decimal(str(amount)).quantize(MONEY_QUANTUM)),
        "source_currency": str(source_currency).upper(),
        "converted_amount": None,
        "target_currency": str(target_currency).upper(),
        "calculated_at": None,
        "display_only": DISPLAY_ONLY,
        "error_code": "FX_RATE_UNAVAILABLE",
    }


def convert_display(*, amount, source_currency, target_currency, quote=None):
    """Return a stable metadata-rich estimate without mutating financial state."""
    source_currency = str(source_currency).upper()
    target_currency = str(target_currency).upper()
    side = display_rate_side(source_currency, target_currency)
    if source_currency != target_currency and quote is None:
        quote = ExchangeRateQuoteService.get_active_quote()
    if source_currency != target_currency and quote is None:
        return _unavailable(amount, source_currency, target_currency)

    result = CurrencyConversionService.convert(
        amount=amount,
        source_currency=source_currency,
        target_currency=target_currency,
        rate_side=side,
        operation_type="wallet_equivalent_display",
        quote=quote,
    )
    return _conversion_metadata(result, quote)


def _conversion_metadata(result, quote=None):
    quote_version = None
    if result.quote_id:
        quote_version = quote.version if isinstance(quote, ExchangeRateQuote) else ExchangeRateQuote.objects.only("version").get(pk=result.quote_id).version
    return {
        "rate_available": True,
        "quote_id": result.quote_id,
        "quote_version": quote_version,
        "rate_side": result.rate_side.value,
        "rate_used": None if result.rate_used is None else str(result.rate_used),
        "source_amount": str(result.source_amount),
        "source_currency": result.source_currency,
        "converted_amount": str(result.target_amount),
        "target_currency": result.target_currency,
        "calculated_at": result.calculated_at,
        "display_only": DISPLAY_ONLY,
        "error_code": None,
    }


def wallet_equivalents(wallet, *, target_currency="SYP", quote=None):
    """Build available/pending/total estimates using one quote per request."""
    target_currency = str(target_currency).upper()
    return {
        "available": convert_display(
            amount=wallet.available_balance, source_currency=wallet.currency,
            target_currency=target_currency, quote=quote,
        ),
        "pending": convert_display(
            amount=wallet.pending_balance, source_currency=wallet.currency,
            target_currency=target_currency, quote=quote,
        ),
        "total": convert_display(
            amount=wallet.total_balance, source_currency=wallet.currency,
            target_currency=target_currency, quote=quote,
        ),
    }
