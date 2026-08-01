"""Compatibility adapter for the obsolete product-object payment caller."""

from transactions.services.purchase_service import PurchaseService as CanonicalPurchaseService


class PurchaseService:
    @staticmethod
    def make_purchase(user, product, amount, currency, extra_payload=None):
        store_product_id = getattr(product, "id", None)
        if not store_product_id or not hasattr(product, "external_product"):
            return {
                "success": False,
                "error": "A canonical active store product is required",
                "error_code": "PURCHASE_OPERATION_REQUIRED",
            }
        payload = dict(extra_payload or {})
        payload.setdefault("requested_amount", str(amount))
        return CanonicalPurchaseService.process_purchase(
            store_product_id=store_product_id,
            user=user,
            user_inputs=payload,
            wallet_currency=currency,
            idempotency_key=payload.get("idempotency_key"),
            transaction_type="purchase",
        )
