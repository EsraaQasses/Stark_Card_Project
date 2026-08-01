"""Canonical backend pricing policy for display, preview, and execution."""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_DOWN
from typing import Optional

from django.utils import timezone

from finance.conversion import CurrencyConversionService, ConversionResult, RateSide
from finance.precision import MONEY_QUANTUM
from wallets.rate_quotes import ExchangeRateQuoteService
from agents.services.commission_policy import CommissionPolicy, EffectiveCommissionRate


PRICING_POLICY_VERSION = "1.5"
ZERO = Decimal("0")
PERCENT = Decimal("100")
PRICE_QUANTUM = Decimal("0.00000001")


@dataclass(frozen=True)
class PricingResult:
    """Immutable Decimal-only result of one authoritative price calculation."""

    product_id: Optional[int]
    store_product_id: Optional[int]
    provider_product_id: Optional[int]
    provider_cost_amount: Optional[Decimal]
    provider_cost_currency: Optional[str]
    native_base_amount: Decimal
    native_base_currency: str
    category_profit_percentage: Decimal
    category_profit_amount: Decimal
    product_profit_percentage: Decimal
    product_profit_amount: Decimal
    combined_profit_percentage: Decimal
    price_after_profit: Decimal
    agent_adjustment_percentage: Decimal
    agent_adjustment_amount: Decimal
    agent_commission_rate: Decimal
    agent_commission_source: str
    agent_id: Optional[int]
    agent_assignment_id: Optional[int]
    customer_price_before_agent_commission: Decimal
    agent_customer_adjustment_amount: Decimal
    customer_price_after_agent_commission: Decimal
    expected_agent_commission_amount: Decimal
    native_final_amount: Decimal
    wallet_charge_amount: Decimal
    wallet_charge_currency: str
    conversion: ConversionResult
    quote_version: Optional[int]
    policy_version: str
    calculated_at: datetime

    def __post_init__(self):
        for name in (
            "provider_cost_amount", "native_base_amount", "category_profit_percentage",
            "category_profit_amount", "product_profit_percentage", "product_profit_amount",
            "agent_adjustment_percentage", "agent_adjustment_amount", "native_final_amount",
            "wallet_charge_amount", "agent_commission_rate", "customer_price_before_agent_commission",
            "agent_customer_adjustment_amount", "customer_price_after_agent_commission",
            "expected_agent_commission_amount", "price_after_profit", "combined_profit_percentage",
        ):
            value = getattr(self, name)
            if value is not None and not isinstance(value, Decimal):
                object.__setattr__(self, name, Decimal(str(value)))
        for name in ("native_base_currency", "wallet_charge_currency", "provider_cost_currency"):
            value = getattr(self, name)
            if value is not None:
                object.__setattr__(self, name, str(value).upper())

    @property
    def quote_id(self):
        return self.conversion.quote_id

    @property
    def rate_side(self):
        return self.conversion.rate_side.value

    @property
    def rate_used(self):
        return self.conversion.rate_used

    def to_snapshot(self):
        """Serialize the complete execution result using strings for money."""
        return {
            "pricing_policy_version": self.policy_version,
            "calculated_at": self.calculated_at.isoformat() if self.calculated_at else None,
            "product_id": self.product_id,
            "store_product_id": self.store_product_id,
            "provider_product_id": self.provider_product_id,
            "provider_cost_amount": None if self.provider_cost_amount is None else str(self.provider_cost_amount),
            "provider_cost_currency": self.provider_cost_currency,
            "native_base_amount": str(self.native_base_amount),
            "native_base_currency": self.native_base_currency,
            "native_product_amount": str(self.native_base_amount),
            "native_product_currency": self.native_base_currency,
            "category_profit_percentage": str(self.category_profit_percentage),
            "category_profit_amount": str(self.category_profit_amount),
            "product_profit_percentage": str(self.product_profit_percentage),
            "product_profit_amount": str(self.product_profit_amount),
            "combined_profit_percentage": str(self.combined_profit_percentage),
            "price_after_profit": str(self.price_after_profit),
            "agent_adjustment_percentage": str(self.agent_adjustment_percentage),
            "agent_adjustment_amount": str(self.agent_adjustment_amount),
            "agent_commission_rate": str(self.agent_commission_rate),
            "agent_commission_source": self.agent_commission_source,
            "agent_id": self.agent_id,
            "agent_assignment_id": self.agent_assignment_id,
            "customer_price_before_agent_commission": str(self.customer_price_before_agent_commission),
            "agent_customer_adjustment_amount": str(self.agent_customer_adjustment_amount),
            "customer_price_after_agent_commission": str(self.customer_price_after_agent_commission),
            "expected_agent_commission_amount": str(self.expected_agent_commission_amount),
            "native_final_amount": str(self.native_final_amount),
            "wallet_charge_amount": str(self.wallet_charge_amount),
            "wallet_charge_currency": self.wallet_charge_currency,
            "final_customer_charge": str(self.wallet_charge_amount),
            "customer_currency": self.wallet_charge_currency,
            "quote_id": self.conversion.quote_id,
            "quote_version": self.quote_version,
            "rate_side": self.rate_side,
            "rate_used": None if self.rate_used is None else str(self.rate_used),
            "source_amount": str(self.conversion.source_amount),
            "source_currency": self.conversion.source_currency,
            "target_amount": str(self.conversion.target_amount),
            "target_currency": self.conversion.target_currency,
            "unrounded_amount": str(self.conversion.unrounded_amount),
            "rounded_amount": str(self.conversion.rounded_amount),
            "rounding_policy": self.conversion.rounding_policy,
        }

    def to_customer_dict(self):
        data = self.to_snapshot()
        for field in ("provider_cost_amount", "provider_cost_currency", "provider_product_id"):
            data.pop(field, None)
        data["rate_available"] = self.conversion.quote_id is not None or self.rate_side == RateSide.NONE.value
        data["price_status"] = "available" if data["rate_available"] else "unavailable"
        return data


class PricingPolicy:
    """One non-mutating pricing source of truth."""

    @staticmethod
    def category_profit_percentage(user) -> Decimal:
        try:
            if (getattr(user, "role", None) == "admin" or getattr(user, "is_staff", False)
                    or getattr(user, "is_superuser", False)):
                return ZERO
            value = getattr(user, "effective_profit_percentage", ZERO)
            return ZERO if value is None else Decimal(str(value))
        except Exception:
            return ZERO

    @classmethod
    def agent_commission_policy(cls, user, product=None):
        if not user or getattr(user, "role", None) != "user":
            return EffectiveCommissionRate(
                agent_id=None, product_id=getattr(product, "id", None), effective_rate=ZERO,
                source="none", assignment_id=None, calculated_at=timezone.now(),
            )
        return CommissionPolicy.resolve(customer=user, product=product)

    @classmethod
    def agent_adjustment_percentage(cls, user, product=None) -> Decimal:
        return cls.agent_commission_policy(user, product).effective_rate

    @classmethod
    def native_final_amount(cls, native_base_amount, user, include_agent_adjustment=True,
                            product_profit_percentage=ZERO, product=None,
                            agent_commission_rate=None):
        base = Decimal(str(native_base_amount))
        category_pct = cls.category_profit_percentage(user)
        product_pct = Decimal(str(product_profit_percentage or ZERO))
        agent_pct = (
            Decimal(str(agent_commission_rate)) if agent_commission_rate is not None
            else cls.agent_adjustment_percentage(user, product) if include_agent_adjustment else ZERO
        )
        category_amount = (base * category_pct) / PERCENT
        product_amount = (base * product_pct) / PERCENT
        price_after_profit = base + category_amount + product_amount
        if agent_pct > ZERO and agent_pct < PERCENT:
            final = price_after_profit / (Decimal("1") - (agent_pct / PERCENT))
        else:
            final = price_after_profit
        return (
            base, category_pct, category_amount, product_pct, product_amount,
            agent_pct, price_after_profit.quantize(PRICE_QUANTUM),
            (final - price_after_profit).quantize(PRICE_QUANTUM), final.quantize(PRICE_QUANTUM),
        )

    @staticmethod
    def rate_side(source_currency, target_currency):
        source_currency, target_currency = str(source_currency).upper(), str(target_currency).upper()
        if source_currency == target_currency:
            return RateSide.NONE
        if (source_currency, target_currency) == ("USD", "SYP"):
            return RateSide.PLATFORM_SELLS_BASE
        if (source_currency, target_currency) == ("SYP", "USD"):
            return RateSide.PLATFORM_BUYS_BASE
        raise ValueError("Only USD/SYP pricing conversion is supported.")

    @classmethod
    def calculate(cls, *, native_base_amount, native_currency, wallet_currency,
                  user=None, product_id=None, store_product_id=None,
                  provider_product_id=None, provider_cost_amount=None,
                  provider_cost_currency=None, quote=None, operation_type="product_pricing",
                  include_agent_adjustment=True, product_profit_percentage=ZERO, product=None):
        native_currency = str(native_currency).upper()
        wallet_currency = str(wallet_currency or native_currency).upper()
        commission_policy = cls.agent_commission_policy(user, product) if include_agent_adjustment else EffectiveCommissionRate(
            agent_id=None, product_id=getattr(product, "id", None), effective_rate=ZERO,
            source="none", assignment_id=None, calculated_at=timezone.now(),
        )
        (base, category_pct, category_amount, product_pct, product_amount, agent_pct,
         price_after_profit, agent_amount, native_final) = cls.native_final_amount(
            native_base_amount, user, include_agent_adjustment=include_agent_adjustment,
            product_profit_percentage=product_profit_percentage,
            product=product, agent_commission_rate=commission_policy.effective_rate,
        )
        if operation_type == "product_pricing":
            operation_type = (
                "product_price_display_sell" if cls.rate_side(native_currency, wallet_currency) is RateSide.PLATFORM_SELLS_BASE
                else "product_price_display_buy" if cls.rate_side(native_currency, wallet_currency) is RateSide.PLATFORM_BUYS_BASE
                else "product_price_display_same"
            )
        conversion = CurrencyConversionService.convert(
            amount=native_final,
            source_currency=native_currency,
            target_currency=wallet_currency,
            rate_side=cls.rate_side(native_currency, wallet_currency),
            operation_type=operation_type,
            quote=quote,
        )
        return PricingResult(
            product_id=product_id,
            store_product_id=store_product_id,
            provider_product_id=provider_product_id,
            provider_cost_amount=None if provider_cost_amount is None else Decimal(str(provider_cost_amount)),
            provider_cost_currency=provider_cost_currency,
            native_base_amount=base,
            native_base_currency=native_currency,
            category_profit_percentage=category_pct,
            category_profit_amount=category_amount,
            product_profit_percentage=product_pct,
            product_profit_amount=product_amount,
            combined_profit_percentage=category_pct + product_pct,
            price_after_profit=price_after_profit,
            agent_adjustment_percentage=agent_pct,
            agent_adjustment_amount=agent_amount,
            agent_commission_rate=commission_policy.effective_rate,
            agent_commission_source=commission_policy.source,
            agent_id=commission_policy.agent_id,
            agent_assignment_id=commission_policy.assignment_id,
            customer_price_before_agent_commission=price_after_profit,
            agent_customer_adjustment_amount=agent_amount,
            customer_price_after_agent_commission=native_final,
            expected_agent_commission_amount=(conversion.target_amount * commission_policy.rate_fraction).quantize(Decimal("0.0001"), rounding=ROUND_DOWN),
            native_final_amount=native_final,
            wallet_charge_amount=conversion.target_amount,
            wallet_charge_currency=wallet_currency,
            conversion=conversion,
            quote_version=getattr(quote, "version", None) if quote is not False else None,
            policy_version=PRICING_POLICY_VERSION,
            calculated_at=timezone.now(),
        )

    @classmethod
    def for_product(cls, *, product, user=None, wallet_currency=None, amount=None,
                    selected_option=None, quote=None, store_product=None,
            operation_type="product_pricing"):
        native_amount = product.calculate_price(amount=amount) if product.product_type == "amount_based" and amount is not None else (
            product.calculate_price(selected_option=selected_option)
            if product.product_type == "customization_based" and selected_option is not None
            else Decimal(str(product.base_price))
        )
        external = getattr(product, "external_product", None)
        provider_cost = getattr(external, "base_price", None)
        return cls.calculate(
            native_base_amount=native_amount,
            native_currency=product.currency,
            wallet_currency=wallet_currency or product.currency,
            user=user,
            product_id=product.id,
            store_product_id=getattr(store_product, "id", None),
            provider_product_id=getattr(external, "id", None),
            provider_cost_amount=provider_cost,
            provider_cost_currency="USD" if provider_cost is not None else None,
            product_profit_percentage=getattr(product, "product_profit_percentage", ZERO),
            product=product,
            quote=quote,
            operation_type=operation_type,
        )
