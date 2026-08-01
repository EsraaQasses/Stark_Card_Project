"""Compatibility facade for older callers of the unified payment service."""

from transactions.services.purchase_service import PurchaseService
from wallets.services import WalletService
from store.services.price_service import PriceService


class UnifiedPaymentService:
    calculate_final_price = staticmethod(PriceService.calculate_final_price)

    @staticmethod
    def get_user_wallet(user, currency="USD"):
        return WalletService.get_or_create_wallet(user, currency)

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
