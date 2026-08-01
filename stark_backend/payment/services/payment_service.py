"""Legacy payment adapter backed by the canonical purchase executor."""

from transactions.services.purchase_service import PurchaseService


class PaymentService:
    @staticmethod
    def process_payment(store_product_id, user, user_inputs):
        payload = user_inputs or {}
        return PurchaseService.process_purchase(
            store_product_id=store_product_id,
            user=user,
            user_inputs=payload,
            wallet_currency=payload.get("wallet_currency"),
            idempotency_key=payload.get("idempotency_key"),
            transaction_type="purchase_hold",
        )
