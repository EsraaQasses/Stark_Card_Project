from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from users.models import AuditLog

from .models import ExchangeRateQuote


PAIR_BASE = "USD"
PAIR_QUOTE = "SYP"
ACTIVE_QUOTE_CACHE_KEY = "exchange_quote:{base}:{quote}:active:{version}"


class ExchangeRateQuoteError(ValueError):
    code = "FX_RATE_INVALID"


class QuoteConflict(ExchangeRateQuoteError):
    code = "FX_RATE_STALE_CURRENT_QUOTE"


class SpreadNotEnabled(ExchangeRateQuoteError):
    code = "FX_RATE_SPREAD_NOT_ENABLED"


class QuoteUnavailable(ExchangeRateQuoteError):
    code = "FX_RATE_UNAVAILABLE"


class ExchangeRateQuoteService:
    """Lifecycle boundary for immutable USD/SYP quotes."""

    @staticmethod
    def _rate(value) -> Decimal:
        try:
            value = Decimal(str(value)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        except Exception as exc:
            raise ExchangeRateQuoteError("Rate must be a valid decimal.") from exc
        if value <= 0:
            raise ExchangeRateQuoteError("Both quote rates must be positive.")
        return value

    @classmethod
    def _validate_pair(cls, base_currency, quote_currency):
        base_currency = str(base_currency).upper()
        quote_currency = str(quote_currency).upper()
        if (base_currency, quote_currency) != (PAIR_BASE, PAIR_QUOTE):
            raise ExchangeRateQuoteError("Only the global USD/SYP pair is supported.")
        return base_currency, quote_currency

    @classmethod
    def _validate_actor(cls, actor):
        if not actor or not getattr(actor, "is_authenticated", False) or getattr(actor, "role", None) != "admin":
            raise ExchangeRateQuoteError("An authorized admin is required.")

    @classmethod
    def get_active_quote(cls, base_currency=PAIR_BASE, quote_currency=PAIR_QUOTE):
        base_currency, quote_currency = cls._validate_pair(base_currency, quote_currency)
        return ExchangeRateQuote.objects.filter(
            base_currency=base_currency,
            quote_currency=quote_currency,
            status=ExchangeRateQuote.STATUS_ACTIVE,
        ).order_by("-version").first()

    @classmethod
    def get_quote_by_id(cls, quote_id):
        return ExchangeRateQuote.objects.get(pk=quote_id)

    @classmethod
    @transaction.atomic
    def create_draft(cls, *, buy_rate, sell_rate, actor, activation_note=""):
        cls._validate_actor(actor)
        buy_rate = cls._rate(buy_rate)
        sell_rate = cls._rate(sell_rate)
        if sell_rate < buy_rate:
            raise ExchangeRateQuoteError("Sell rate cannot be below buy rate.")
        active = cls.get_active_quote()
        version = (ExchangeRateQuote.objects.filter(
            base_currency=PAIR_BASE, quote_currency=PAIR_QUOTE
        ).order_by("-version").values_list("version", flat=True).first() or 0) + 1
        return ExchangeRateQuote.objects.create(
            base_currency=PAIR_BASE,
            quote_currency=PAIR_QUOTE,
            platform_buy_base_rate=buy_rate,
            platform_sell_base_rate=sell_rate,
            status=ExchangeRateQuote.STATUS_DRAFT,
            source="manual",
            created_by=actor,
            activation_note=activation_note or "Draft quote",
            version=version,
            effective_at=None,
        )

    @classmethod
    @transaction.atomic
    def activate_quote(
        cls, *, buy_rate, sell_rate, actor, activation_note,
        expected_current_quote_id=None, source="manual",
    ):
        cls._validate_actor(actor)
        if not activation_note or not str(activation_note).strip():
            raise ExchangeRateQuoteError("Activation note is required.")
        buy_rate = cls._rate(buy_rate)
        sell_rate = cls._rate(sell_rate)
        if sell_rate < buy_rate:
            raise ExchangeRateQuoteError("Sell rate cannot be below buy rate.")
        current = ExchangeRateQuote.objects.select_for_update().filter(
            base_currency=PAIR_BASE,
            quote_currency=PAIR_QUOTE,
            status=ExchangeRateQuote.STATUS_ACTIVE,
        ).order_by("-version").first()
        current_id = current.id if current else None
        if expected_current_quote_id is not None and int(expected_current_quote_id) != current_id:
            raise QuoteConflict("The active quote changed; refresh and retry.")

        next_version = (ExchangeRateQuote.objects.filter(
            base_currency=PAIR_BASE, quote_currency=PAIR_QUOTE
        ).order_by("-version").values_list("version", flat=True).first() or 0) + 1
        now = timezone.now()
        if current:
            current.status = ExchangeRateQuote.STATUS_SUPERSEDED
            current.superseded_at = now
            current._lifecycle_update = True
            current.save(update_fields=["status", "superseded_at", "updated_at"] if hasattr(current, "updated_at") else ["status", "superseded_at"])
            del current._lifecycle_update

        try:
            quote = ExchangeRateQuote.objects.create(
                base_currency=PAIR_BASE,
                quote_currency=PAIR_QUOTE,
                platform_buy_base_rate=buy_rate,
                platform_sell_base_rate=sell_rate,
                status=ExchangeRateQuote.STATUS_ACTIVE,
                source=source,
                effective_at=now,
                created_by=actor,
                activation_note=str(activation_note).strip(),
                version=next_version,
            )
        except IntegrityError as exc:
            raise QuoteConflict("Another administrator activated a quote concurrently.") from exc

        AuditLog.objects.create(
            user=actor,
            action="RATE_ACTIVATED",
            resource_type="ExchangeRateQuote",
            resource_id=quote.id,
            details={
                "quote_id": quote.id,
                "base_currency": quote.base_currency,
                "quote_currency": quote.quote_currency,
                "platform_buy_usd_rate_syp": str(quote.platform_buy_base_rate),
                "platform_sell_usd_rate_syp": str(quote.platform_sell_base_rate),
                "version": quote.version,
                "activation_note": quote.activation_note,
            },
        )
        previous_quote_id = current.id if current else None
        previous_version = current.version if current else None
        transaction.on_commit(lambda: cls.invalidate_cache(quote, previous_quote_id, previous_version))
        return quote

    @classmethod
    @transaction.atomic
    def supersede_current_quote(cls, *, actor, expected_current_quote_id=None):
        current = cls.get_active_quote()
        if not current:
            return None
        return cls.activate_quote(
            buy_rate=current.platform_buy_base_rate,
            sell_rate=current.platform_sell_base_rate,
            actor=actor,
            activation_note="Superseded by replacement quote",
            expected_current_quote_id=expected_current_quote_id,
        )

    @staticmethod
    def cache_key(quote):
        return ACTIVE_QUOTE_CACHE_KEY.format(
            base=quote.base_currency, quote=quote.quote_currency, version=quote.version
        )

    @classmethod
    def invalidate_cache(cls, quote=None, previous_quote_id=None, previous_version=None):
        if quote:
            cache.delete(cls.cache_key(quote))
        if previous_quote_id and previous_version:
            cache.delete(ACTIVE_QUOTE_CACHE_KEY.format(
                base=PAIR_BASE, quote=PAIR_QUOTE, version=previous_version
            ))
        cache.delete("exchange_rates")
        cache.delete("exchange_rates:active")
        cache.delete("admin_wallet_data")
        if hasattr(cache, "delete_pattern"):
            cache.delete_pattern("wallet_data_*")

    @classmethod
    def serialize(cls, quote):
        return {
            "quote_id": quote.id,
            "base_currency": quote.base_currency,
            "quote_currency": quote.quote_currency,
            "platform_buy_usd_rate_syp": str(quote.platform_buy_base_rate),
            "platform_sell_usd_rate_syp": str(quote.platform_sell_base_rate),
            "effective_at": quote.effective_at,
            "superseded_at": quote.superseded_at,
            "status": quote.status,
            "source": quote.source,
            "version": quote.version,
            "activation_note": quote.activation_note,
            "created_by": quote.created_by_id,
            "spread_amount": str(quote.platform_sell_base_rate - quote.platform_buy_base_rate),
            "spread_percentage": str(((quote.platform_sell_base_rate - quote.platform_buy_base_rate) / quote.platform_buy_base_rate * 100).quantize(Decimal("0.000001"))),
        }
