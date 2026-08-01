"""Compatibility adapter for the historical wallet-payment entry point."""

from store.services.price_service import PriceService
from transactions.services.purchase_service import PurchaseService


def calculate_final_price(base_price, user):
    return PriceService.calculate_final_price(base_price, user)


class FixedPaymentService:
    """Preserve the old method signature while using canonical D3 execution."""

    @staticmethod
    def process_payment(store_product_id, user, user_inputs, wallet_currency=None, idempotency_key=None):
        return PurchaseService.process_purchase(
            store_product_id=store_product_id,
            user=user,
            user_inputs=user_inputs or {},
            wallet_currency=wallet_currency,
            idempotency_key=idempotency_key or (user_inputs or {}).get("idempotency_key"),
            transaction_type="purchase_hold",
        )
