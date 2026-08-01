from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from enum import Enum

from django.utils import timezone

from wallets.models import ExchangeRateQuote
from wallets.rate_quotes import ExchangeRateQuoteService

from .precision import MONEY_QUANTUM, RATE_QUANTUM


class RateSide(str, Enum):
    PLATFORM_BUYS_BASE = "PLATFORM_BUYS_BASE"
    PLATFORM_SELLS_BASE = "PLATFORM_SELLS_BASE"
    NONE = "NONE"


class ConversionError(ValueError):
    code = "FX_RATE_INVALID"


class RateSideInvalid(ConversionError):
    code = "FX_RATE_SIDE_INVALID"


class RatePairMismatch(ConversionError):
    code = "FX_RATE_PAIR_MISMATCH"


class QuoteInactive(ConversionError):
    code = "FX_RATE_QUOTE_INACTIVE"


class RateUnavailable(ConversionError):
    code = "FX_RATE_UNAVAILABLE"


class ConversionResult:
    """Immutable, Decimal-only result of one authorized conversion."""

    __slots__ = (
        "source_amount", "source_currency", "target_amount", "target_currency",
        "quote_id", "rate_side", "rate_used", "operation_type",
        "unrounded_amount", "rounded_amount", "rounding_policy", "calculated_at",
        "_sealed",
    )

    def __init__(
        self,
        *, source_amount, source_currency, target_amount, target_currency,
        quote_id, rate_side, rate_used, operation_type, unrounded_amount,
        rounded_amount, rounding_policy, calculated_at,
    ):
        object.__setattr__(self, "source_amount", Decimal(str(source_amount)))
        object.__setattr__(self, "source_currency", str(source_currency).upper())
        object.__setattr__(self, "target_amount", Decimal(str(target_amount)))
        object.__setattr__(self, "target_currency", str(target_currency).upper())
        object.__setattr__(self, "quote_id", quote_id)
        object.__setattr__(self, "rate_side", RateSide(rate_side))
        object.__setattr__(self, "rate_used", None if rate_used is None else Decimal(str(rate_used)))
        object.__setattr__(self, "operation_type", str(operation_type))
        object.__setattr__(self, "unrounded_amount", Decimal(str(unrounded_amount)))
        object.__setattr__(self, "rounded_amount", Decimal(str(rounded_amount)))
        object.__setattr__(self, "rounding_policy", str(rounding_policy))
        object.__setattr__(self, "calculated_at", calculated_at)
        object.__setattr__(self, "_sealed", True)

    def __setattr__(self, name, value):
        if getattr(self, "_sealed", False):
            raise AttributeError("ConversionResult is immutable")
        object.__setattr__(self, name, value)

    def __repr__(self):
        return (
            f"ConversionResult({self.source_amount} {self.source_currency} -> "
            f"{self.target_amount} {self.target_currency}, quote={self.quote_id}, "
            f"side={self.rate_side.value})"
        )


class CurrencyConversionService:
    """Canonical, non-mutating FX conversion boundary."""

    BUY_SIDE_OPERATIONS = {
        "syp_denominated_charge_usd", "syp_product_paid_usd", "deposit_syp_to_usd", "product_price_display_buy",
        "platform_buy_usd", "cashout_syp_to_usd", "purchase_native_to_usd",
        "shipping_submitted_syp_to_usd", "cashout_reserved_syp_to_usd",
    }
    SELL_SIDE_OPERATIONS = {
        "usd_denominated_charge_syp", "usd_product_paid_syp", "cashout_usd_to_syp", "product_price_display_sell",
        "platform_sell_usd", "purchase_native_to_syp",
        "shipping_submitted_usd_to_syp", "cashout_reserved_usd_to_syp",
    }

    @classmethod
    def _amount(cls, amount) -> Decimal:
        value = Decimal(str(amount))
        if value <= 0:
            raise ConversionError("Conversion amount must be greater than zero.")
        return value

    @classmethod
    def _quote(cls, quote) -> ExchangeRateQuote:
        if quote is None:
            quote = ExchangeRateQuoteService.get_active_quote()
        elif not isinstance(quote, ExchangeRateQuote):
            quote = ExchangeRateQuoteService.get_quote_by_id(quote)
        if not quote:
            raise RateUnavailable("No active USD/SYP quote is available.")
        if quote.status != ExchangeRateQuote.STATUS_ACTIVE:
            raise QuoteInactive("The supplied quote is not active.")
        if (quote.base_currency, quote.quote_currency) != ("USD", "SYP"):
            raise RatePairMismatch("Quote pair must be USD/SYP.")
        if quote.platform_buy_base_rate <= 0 or quote.platform_sell_base_rate <= 0:
            raise ConversionError("Quote rates must be positive.")
        if quote.platform_sell_base_rate < quote.platform_buy_base_rate:
            raise ConversionError("Quote sell rate cannot be below buy rate.")
        return quote

    @classmethod
    def convert(
        cls, *, amount, source_currency, target_currency, rate_side,
        operation_type, quote=None,
    ) -> ConversionResult:
        source_currency = str(source_currency).upper()
        target_currency = str(target_currency).upper()
        if source_currency not in {"USD", "SYP"} or target_currency not in {"USD", "SYP"}:
            raise ConversionError("Unsupported currency.")
        amount = cls._amount(amount)
        try:
            side = RateSide(rate_side)
        except (TypeError, ValueError) as exc:
            raise RateSideInvalid("Invalid FX rate side.") from exc
        operation_type = str(operation_type or "").strip()
        if not operation_type:
            raise ConversionError("Operation type is required.")

        if source_currency == target_currency:
            if side is not RateSide.NONE:
                raise RateSideInvalid("Same-currency conversion requires NONE.")
            rounded = amount.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
            return ConversionResult(
                source_amount=rounded,
                source_currency=source_currency,
                target_amount=rounded,
                target_currency=target_currency,
                quote_id=None,
                rate_side=RateSide.NONE,
                rate_used=None,
                operation_type=operation_type,
                unrounded_amount=amount,
                rounded_amount=rounded,
                rounding_policy="MONEY_QUANTUM_8_HALF_UP",
                calculated_at=timezone.now(),
            )

        if (source_currency, target_currency) not in {("USD", "SYP"), ("SYP", "USD")}:
            raise RatePairMismatch("Only USD/SYP conversion is supported.")
        if side is RateSide.NONE:
            raise RateSideInvalid("Cross-currency conversion requires an explicit rate side.")
        quote = cls._quote(quote)

        if source_currency == "USD" and target_currency == "SYP":
            if side is RateSide.PLATFORM_BUYS_BASE:
                rate = quote.platform_buy_base_rate
            elif operation_type in cls.SELL_SIDE_OPERATIONS:
                rate = quote.platform_sell_base_rate
            else:
                raise RateSideInvalid("USD to SYP sell-side conversion requires a sell-value operation.")
            unrounded = amount * rate
        elif source_currency == "SYP" and target_currency == "USD":
            if side is RateSide.PLATFORM_SELLS_BASE:
                rate = quote.platform_sell_base_rate
            elif operation_type in cls.BUY_SIDE_OPERATIONS:
                rate = quote.platform_buy_base_rate
            else:
                raise RateSideInvalid("SYP to USD buy-side conversion requires a buy-value operation.")
            unrounded = amount / rate
        else:
            raise RatePairMismatch("Invalid USD/SYP direction.")

        rounded = unrounded.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
        return ConversionResult(
            source_amount=amount.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP),
            source_currency=source_currency,
            target_amount=rounded,
            target_currency=target_currency,
            quote_id=quote.id,
            rate_side=side,
            rate_used=Decimal(str(rate)).quantize(RATE_QUANTUM, rounding=ROUND_HALF_UP),
            operation_type=operation_type,
            unrounded_amount=unrounded,
            rounded_amount=rounded,
            rounding_policy="MONEY_QUANTUM_8_HALF_UP",
            calculated_at=timezone.now(),
        )
