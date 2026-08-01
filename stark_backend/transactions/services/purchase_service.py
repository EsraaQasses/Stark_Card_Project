"""Canonical backend-controlled purchase execution orchestration."""

import hashlib
import json
import logging
import os
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional

from django.db import transaction as db_transaction

from agents.services.commission_service import credit_agent_commission
from finance.conversion import RateUnavailable
from finance.services import FinanceService, InsufficientFunds
from store.models import Product, StoreProduct
from store.services.price_service import PriceService
from store.services.pricing import PricingPolicy
from store.services.image_resolver import ProductImageResolver
from third_party_apis.services.api_service import APIService, MockAPIService
from transactions.models import Transaction
from wallets.models import Wallet

from .purchase_execution import PurchaseExecutionContext

logger = logging.getLogger(__name__)

try:
    from payment.models import Payment
except ImportError:  # pragma: no cover - only for partial app imports
    Payment = None


class PurchaseService:
    """Single active purchase flow for store and payment adapters."""

    @staticmethod
    def _fingerprint(*, user_id, store_product_id, wallet_currency, native_amount, native_currency, user_inputs):
        payload = {
            "user_id": user_id,
            "store_product_id": store_product_id,
            "wallet_currency": wallet_currency,
            "native_amount": str(native_amount),
            "native_currency": native_currency,
            "user_inputs": user_inputs or {},
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()

    @classmethod
    def _native_price(cls, *, store_product, user, product_id=None, amount=None, selected_option=None):
        product = None
        if product_id:
            product = Product.objects.filter(id=product_id, is_active=True).first()
        if not product and store_product.external_product:
            product = Product.objects.filter(
                external_product=store_product.external_product, is_active=True
            ).first()

        native_amount = Decimal(str(store_product.price))
        native_currency = str(store_product.currency).upper()
        if product:
            native_currency = str(product.currency).upper()
            if product.product_type == "amount_based" and amount is not None:
                native_amount = product.calculate_price(amount=amount)
            elif product.product_type == "customization_based" and selected_option is not None:
                native_amount = product.calculate_price(selected_option=selected_option)
        return product, Decimal(str(native_amount)), native_currency

    @classmethod
    def _context(cls, *, store_product, user, user_inputs, wallet_currency, product_id=None,
                 amount=None, selected_option=None, idempotency_key=None):
        product, base_native, native_currency = cls._native_price(
            store_product=store_product, user=user, product_id=product_id,
            amount=amount, selected_option=selected_option,
        )
        wallet_currency = str(wallet_currency or native_currency).upper()
        if wallet_currency not in {"USD", "SYP"}:
            raise ValueError("Unsupported wallet currency.")
        wallet = Wallet.objects.get(user=user, currency=wallet_currency)
        operation_key = idempotency_key or (user_inputs or {}).get("idempotency_key") or f"purchase:{uuid.uuid4()}"
        from wallets.rate_quotes import ExchangeRateQuoteService
        quote = ExchangeRateQuoteService.get_active_quote() if native_currency != wallet_currency else None
        pricing = PricingPolicy.calculate(
            native_base_amount=base_native,
            native_currency=native_currency,
            wallet_currency=wallet_currency,
            user=user,
            product_id=getattr(product, "id", None),
            store_product_id=store_product.id,
            provider_product_id=getattr(store_product.external_product, "id", None),
            provider_cost_amount=getattr(store_product.external_product, "base_price", None),
            provider_cost_currency="USD" if getattr(store_product.external_product, "base_price", None) is not None else None,
            quote=quote,
            operation_type=("purchase_native_to_syp" if native_currency == "USD" and wallet_currency == "SYP"
                            else "purchase_native_to_usd" if native_currency == "SYP" and wallet_currency == "USD"
                            else "purchase_same_currency"),
            product_profit_percentage=getattr(product, "product_profit_percentage", Decimal("0")),
            product=product,
        )
        fingerprint = cls._fingerprint(
            user_id=user.id, store_product_id=store_product.id,
            wallet_currency=wallet_currency, native_amount=pricing.native_final_amount,
            native_currency=native_currency, user_inputs=user_inputs,
        )
        provider_cost = getattr(store_product.external_product, "base_price", None)
        provider_currency = "USD" if provider_cost is not None else None
        return PurchaseExecutionContext(
            user_id=user.id,
            store_product_id=store_product.id,
            product_native_amount=pricing.native_final_amount,
            product_native_currency=native_currency,
            wallet_id=wallet.id,
            wallet_currency=wallet_currency,
            conversion=pricing.conversion,
            pricing_result=pricing,
            customer_charge=pricing.wallet_charge_amount,
            provider_cost_amount=None if provider_cost is None else Decimal(str(provider_cost)),
            provider_cost_currency=provider_currency,
            user_inputs=dict(user_inputs or {}),
            operation_key=operation_key,
            correlation_id=str(uuid.uuid4()),
        ), product, base_native, fingerprint

    @staticmethod
    def _existing_result(tx):
        payment = getattr(tx, "payment", None)
        return {
            "success": tx.status in {"pending", "approved"},
            "transaction_id": tx.id,
            "payment_id": getattr(payment, "id", None),
            "status": "approved" if tx.status == "approved" else "pending",
            "processing": tx.status == "pending",
            "idempotency_replayed": True,
            "quote_id": tx.exchange_rate_quote_id,
            "rate_side": tx.exchange_rate_side,
            "rate_used": None if tx.exchange_rate_used is None else str(tx.exchange_rate_used),
            "charged_amount": None if tx.target_amount is None else str(tx.target_amount),
            "charged_currency": tx.target_currency,
        }

    @classmethod
    @db_transaction.atomic
    def process_purchase(cls, store_product_id: int, user, user_inputs: Dict[str, Any],
                         wallet_currency: Optional[str] = None, product_id: Optional[int] = None,
                         amount: Optional[Decimal] = None, selected_option: Optional[str] = None,
                         idempotency_key: Optional[str] = None, transaction_type: str = "purchase") -> Dict[str, Any]:
        try:
            store_product = StoreProduct.objects.select_related(
                "external_product", "external_product__api_config"
            ).get(id=store_product_id, is_active=True)
            if not store_product.is_available_for_purchase:
                return {
                    "success": False,
                    "error": "Product is not currently available for purchase.",
                    "error_code": "PRODUCT_UNAVAILABLE",
                }
            requested_key = idempotency_key or (user_inputs or {}).get("idempotency_key")
            if requested_key:
                early_product, early_base, early_currency = cls._native_price(
                    store_product=store_product, user=user, product_id=product_id,
                    amount=amount, selected_option=selected_option,
                )
                early_final = PricingPolicy.native_final_amount(
                    early_base, user,
                    product_profit_percentage=getattr(early_product, "product_profit_percentage", Decimal("0")),
                    product=early_product,
                )[-1]
                early_wallet_currency = str(wallet_currency or early_currency).upper()
                existing = Transaction.objects.select_related("payment").filter(
                    idempotency_key=requested_key
                ).first()
                if existing:
                    fingerprint = cls._fingerprint(
                        user_id=user.id, store_product_id=store_product.id,
                        wallet_currency=early_wallet_currency, native_amount=early_final,
                        native_currency=early_currency, user_inputs=user_inputs,
                    )
                    if (existing.operation_context or {}).get("request_fingerprint") != fingerprint:
                        return {"success": False, "error": "Idempotency key conflicts with a different purchase.",
                                "error_code": "IDEMPOTENCY_CONFLICT"}
                    return cls._existing_result(existing)
            context, product, base_native, fingerprint = cls._context(
                store_product=store_product, user=user, user_inputs=user_inputs,
                wallet_currency=wallet_currency, product_id=product_id, amount=amount,
                selected_option=selected_option, idempotency_key=idempotency_key,
            )
            existing = Transaction.objects.select_related("payment").filter(
                idempotency_key=context.operation_key
            ).first()
            if existing:
                if (existing.operation_context or {}).get("request_fingerprint") != fingerprint:
                    return {"success": False, "error": "Idempotency key conflicts with a different purchase.",
                            "error_code": "IDEMPOTENCY_CONFLICT"}
                return cls._existing_result(existing)

            wallet = Wallet.objects.select_for_update().get(pk=context.wallet_id)
            if wallet.available_balance < context.customer_charge:
                return {
                    "success": False,
                    "error": f"Insufficient balance. Need: {context.customer_charge}, Have: {wallet.available_balance}",
                    "error_code": "INSUFFICIENT_BALANCE",
                }

            operation_context = {
                **context.operation_snapshot(),
                "request_fingerprint": fingerprint,
                "base_native_amount": str(base_native),
                "transaction_type": transaction_type,
                "image": ProductImageResolver.resolve(store_product),
            }
            image_snapshot = operation_context["image"]
            tx = FinanceService.withdraw(
                wallet_id=wallet.id,
                amount=context.customer_charge,
                transaction_type=transaction_type,
                note=f"Purchase: {store_product.name}",
                idempotency_key=context.operation_key,
                conversion_result=context.conversion,
                operation_context=operation_context,
                image_url=image_snapshot["image_url"],
                image_source=image_snapshot["image_source"],
                image_available=image_snapshot["image_available"],
                image_is_fallback=image_snapshot["image_is_fallback"],
            )
            if tx.status != "pending" or tx.operation_context.get("request_fingerprint") != fingerprint:
                return cls._existing_result(tx)

            payment = Payment.objects.create(
                user=user,
                wallet=wallet,
                store_product=store_product,
                base_price=base_native,
                profit_percentage=PriceService.calculate_user_profit_percentage(user),
                final_price=context.customer_charge,
                currency=context.wallet_currency,
                amount_usd=None if tx.amount_usd is None else abs(tx.amount_usd),
                amount_syp=None if tx.amount_syp is None else abs(tx.amount_syp),
                exchange_rate_used=context.rate_used,
                exchange_rate_quote_id=context.quote_id,
                exchange_rate_side=context.rate_side,
                source_amount=context.conversion.source_amount,
                source_currency=context.conversion.source_currency,
                target_amount=context.conversion.target_amount,
                target_currency=context.conversion.target_currency,
                rounding_mode=context.conversion.rounding_policy,
                image_url=image_snapshot["image_url"],
                image_source=image_snapshot["image_source"],
                image_available=image_snapshot["image_available"],
                image_is_fallback=image_snapshot["image_is_fallback"],
                operation_context=operation_context,
                user_inputs=user_inputs or {},
                status="pending",
            )
            tx.payment = payment
            tx.save(update_fields=["payment", "updated_at"])

            external_product = store_product.external_product
            api_config = external_product.api_config
            user_data = {"user_id": user.id, "name": user.name, "email": user.email}
            use_mock_api = os.getenv("USE_MOCK_API", "").lower() in ("1", "true", "yes")
            api_service = MockAPIService if use_mock_api else APIService
            api_result = api_service.process_payment(
                api_id=api_config.id,
                store_product_id=store_product_id,
                user_data=user_data,
                internal_tx_id=tx.id,
                user_inputs=user_inputs or {},
            )
            raw_status = (api_result or {}).get("status") or (api_result or {}).get("message")
            normalized = APIService._normalize_order_status(raw_status) if api_result and api_result.get("success") else "rejected"
            external_id = (api_result or {}).get("external_transaction_id") or (api_result or {}).get("order_id")

            if normalized == "approved":
                tx = FinanceService.approve(tx.id)
                payment.status = "success"
                payment.external_transaction_id = external_id
                payment.processed_at = tx.processed_at
                payment.save(update_fields=["status", "external_transaction_id", "processed_at", "updated_at"])
                credit_agent_commission(
                    user=user,
                    amount=context.customer_charge,
                    currency=context.wallet_currency,
                    source_tx=tx,
                )
                return {
                    "success": True, "transaction_id": tx.id, "payment_id": payment.id,
                    "external_transaction_id": external_id, "order_id": (api_result or {}).get("order_id"),
                    "status": "approved", "idempotency_replayed": False,
                    "charged_amount": str(context.customer_charge), "charged_currency": context.wallet_currency,
                    "quote_id": context.quote_id, "rate_side": context.rate_side,
                    "rate_used": None if context.rate_used is None else str(context.rate_used),
                    "new_balance": str(wallet.available_balance),
                }

            error = str((api_result or {}).get("error") or (api_result or {}).get("message") or "Provider rejected purchase")
            if "timeout" in error.lower() or normalized == "unknown" or normalized == "pending":
                tx.note = f"{tx.note or ''}; PROVIDER_STATUS_UNKNOWN"
                tx.save(update_fields=["note", "updated_at"])
                payment.status = "processing"
                payment.error_message = error
                payment.external_transaction_id = external_id
                payment.save(update_fields=["status", "error_message", "external_transaction_id", "updated_at"])
                return {"success": True, "transaction_id": tx.id, "payment_id": payment.id,
                        "status": "pending", "processing": True, "error_code": "PROVIDER_STATUS_UNKNOWN",
                        "external_transaction_id": external_id,
                        "order_id": (api_result or {}).get("order_id"),
                        "quote_id": context.quote_id, "rate_side": context.rate_side}

            tx = FinanceService.reject(tx.id, reason=error)
            payment.status = "failed"
            payment.error_message = error
            payment.save(update_fields=["status", "error_message", "updated_at"])
            return {"success": False, "transaction_id": tx.id, "payment_id": payment.id,
                    "error": error, "error_code": "PROVIDER_REJECTED"}
        except RateUnavailable:
            return {"success": False, "error": "No active exchange-rate quote is available.",
                    "error_code": "FX_RATE_UNAVAILABLE"}
        except StoreProduct.DoesNotExist:
            return {"success": False, "error": "Product not found or inactive", "error_code": "PRODUCT_NOT_FOUND"}
        except Wallet.DoesNotExist:
            return {"success": False, "error": "User wallet not found.", "error_code": "WALLET_NOT_FOUND"}
        except InsufficientFunds as exc:
            return {"success": False, "error": str(exc), "error_code": "INSUFFICIENT_BALANCE"}
        except ValueError as exc:
            return {"success": False, "error": str(exc), "error_code": "INVALID_INPUT"}
        except Exception as exc:
            logger.exception("Purchase processing failed")
            return {"success": False, "error": str(exc), "error_code": "PURCHASE_FAILED"}
