"""Typed purchase execution state shared by the purchase/payment adapters."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Mapping, Optional

from finance.conversion import ConversionResult
from store.services.pricing import PricingResult


@dataclass(frozen=True)
class PurchaseExecutionContext:
    """Immutable authoritative state for one purchase attempt.

    The context is created before the wallet reservation and is never rebuilt
    from display values or a later quote during provider callbacks/retries.
    """

    user_id: int
    store_product_id: int
    product_native_amount: Decimal
    product_native_currency: str
    wallet_id: int
    wallet_currency: str
    conversion: ConversionResult
    pricing_result: PricingResult
    customer_charge: Decimal
    provider_cost_amount: Optional[Decimal]
    provider_cost_currency: Optional[str]
    user_inputs: Mapping[str, Any]
    operation_key: str
    correlation_id: str
    provider_reference: Optional[str] = None

    @property
    def quote_id(self):
        return self.conversion.quote_id

    @property
    def rate_side(self):
        return self.conversion.rate_side.value

    @property
    def rate_used(self):
        return self.conversion.rate_used

    def operation_snapshot(self) -> dict:
        return {
            "snapshot_locked": True,
            "operation_key": self.operation_key,
            "correlation_id": self.correlation_id,
            "quote_id": self.quote_id,
            "rate_side": self.rate_side,
            "rate_used": None if self.rate_used is None else str(self.rate_used),
            "product_native_amount": str(self.product_native_amount),
            "product_native_currency": self.product_native_currency,
            "customer_charge": str(self.customer_charge),
            "customer_charge_currency": self.wallet_currency,
            "provider_cost_amount": None if self.provider_cost_amount is None else str(self.provider_cost_amount),
            "provider_cost_currency": self.provider_cost_currency,
            "pricing": self.pricing_result.to_snapshot(),
        }
