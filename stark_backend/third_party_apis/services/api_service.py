import logging
from typing import List, Dict, Any, Optional
from django.db import transaction as db_transaction
from django.utils import timezone
from decimal import Decimal
from ..models import ThirdPartyAPI, APITransaction
from ..utils.connectors import ConnectorFactory
from transactions.models import Transaction
from django.apps import apps
from finance.services import FinanceService
from django.core.cache import cache

logger = logging.getLogger(__name__)

class APIService:
    @staticmethod
    def _normalize_balance(balance_result: Dict[str, Any]) -> Dict[str, Any]:
        data = balance_result.get("data")
        balance = None
        currency = None

        if isinstance(data, dict):
            if "balance" in data:
                balance = data.get("balance")
                currency = data.get("currency")
            elif isinstance(data.get("data"), dict):
                inner = data.get("data", {})
                if "balance" in inner:
                    balance = inner.get("balance")
                    currency = inner.get("currency")
                elif isinstance(inner.get("wallets"), list) and inner.get("wallets"):
                    primary = next((w for w in inner["wallets"] if w.get("is_primary")), inner["wallets"][0])
                    balance = primary.get("balance")
                    currency = primary.get("currency")

            if balance is None and isinstance(data.get("wallet"), dict):
                balance = data["wallet"].get("balance")
                currency = data["wallet"].get("currency")

            if balance is None and isinstance(data.get("wallets"), list) and data.get("wallets"):
                primary = data["wallets"][0]
                balance = primary.get("balance")
                currency = primary.get("currency")

            if balance is None and isinstance(data.get("account"), dict):
                balance = data["account"].get("balance") or data["account"].get("available_balance")
                currency = data["account"].get("currency")

            if balance is None:
                for key in ("available_balance", "credit", "amount"):
                    if key in data:
                        balance = data.get(key)
                        break
        else:
            if isinstance(data, (int, float, str)):
                balance = data

        if balance is None:
            for key in ("balance", "available_balance", "credit"):
                if key in balance_result:
                    balance = balance_result.get(key)
                    break

        try:
            if balance is not None:
                balance = Decimal(str(balance))
        except Exception:
            balance = None

        return {
            "balance": balance,
            "currency": currency,
        }

    @staticmethod
    def _normalize_active_status(status_value: Any) -> bool:
        if status_value is None:
            return True
        text = str(status_value).strip().lower()
        if text in {"inactive", "disabled", "unavailable", "off", "0", "false", "no"}:
            return False
        if text in {"active", "enabled", "available", "on", "1", "true", "yes"}:
            return True
        return bool(status_value)

    @staticmethod
    def _normalize_order_status(raw_status: Any) -> str:
        """Normalize provider status (Arabic/English) to approved/pending/rejected/unknown."""
        if raw_status is None:
            return "unknown"
        text = str(raw_status).strip().lower()

        # Arabic tokens
        arabic_pending = (
            "قيد", "قيد المعالجة", "قيد التنفيذ", "قيد الانتظار", "جار", "جاري", "معلق"
        )
        arabic_approved = (
            "تمت", "تم", "مقبول", "ناجح", "مكتمل", "تم التنفيذ", "نجاح"
        )
        arabic_rejected = (
            "مرفوض", "رفض", "فشل", "ملغي", "إلغاء", "غير متاح", "غير مقبول", "غير ناجح"
        )

        approved_statuses = {'approved', 'accept', 'accepted', 'success', 'completed', 'done', 'ok'}
        pending_statuses = {'pending', 'processing', 'in_progress', 'inprogress', 'wait', 'waiting'}
        rejected_tokens = ('reject', 'rejected', 'failed', 'failure', 'cancel', 'canceled',
                           'not_accepted', 'not_acceptable', 'not_available')

        if text in approved_statuses or any(tok in text for tok in arabic_approved):
            return "approved"
        if text in pending_statuses or any(tok in text for tok in arabic_pending):
            return "pending"
        if any(token in text for token in rejected_tokens) or any(tok in text for tok in arabic_rejected):
            return "rejected"
        return "unknown"
    
    @staticmethod
    def _execute_api_call_and_log(api_config: ThirdPartyAPI, endpoint: str, 
                                 method: str, payload: Dict, internal_transaction=None) -> Dict[str, Any]:
        """Execute API call with comprehensive logging"""
        
        # Create APITransaction record before the call
        api_transaction = APITransaction.objects.create(
            api_config=api_config,
            internal_transaction=internal_transaction,
            request_payload=payload,
            endpoint_used=endpoint,
            request_timestamp=timezone.now(),
            success=False
        )
        
        try:
            connector = ConnectorFactory.get_connector(api_config)
            
            # Execute the appropriate method based on endpoint
            if endpoint == '/api/products':
                result = connector.get_products()
                # Transform result for consistency
                result_data = {
                    'success': True,
                    'products': result,
                    'status_code': 200
                }
            elif endpoint == '/api/purchase':
                result = connector.execute_purchase(
                    payload.get('product_data', {}),
                    payload.get('user_data', {}),
                    payload.get('transaction_data', {})
                )
                result_data = result
            else:
                result_data = {'success': False, 'error': f'Unknown endpoint: {endpoint}'}
            
            # Update APITransaction with response
            api_transaction.response_payload = result_data
            api_transaction.response_timestamp = timezone.now()
            api_transaction.http_status_code = result_data.get('status_code', 200)
            api_transaction.success = result_data.get('success', False)
            api_transaction.error_message = result_data.get('error', '')
            api_transaction.external_transaction_id = result_data.get('order_id', '')
            api_transaction.save()
            
            return result_data
            
        except Exception as e:
            logger.error(f"API call failed: {e}")
            # Update APITransaction with error
            api_transaction.response_payload = {'error': str(e)}
            api_transaction.response_timestamp = timezone.now()
            api_transaction.success = False
            api_transaction.error_message = str(e)
            api_transaction.save()
            
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def perform_external_purchase(api_id: int, external_product_id: str, quantity: int, user_inputs: Dict, wallet_user_id: int) -> Dict[str, Any]:
        """Compatibility entry point routed through canonical execution."""
        from store.models import StoreProduct
        from users.models import User

        store_product = StoreProduct.objects.filter(
            external_product__external_id=external_product_id,
            external_product__api_config_id=api_id,
            is_active=True,
        ).first()
        user = User.objects.filter(pk=wallet_user_id).first()
        if not store_product or not user:
            return {
                "success": False,
                "error_code": "PURCHASE_OPERATION_REQUIRED",
                "error": "A canonical active store product and user are required",
            }
        from transactions.services.purchase_service import PurchaseService
        payload = dict(user_inputs or {})
        payload["quantity"] = quantity
        return PurchaseService.process_purchase(
            store_product_id=store_product.id,
            user=user,
            user_inputs=payload,
            wallet_currency=store_product.currency,
            idempotency_key=payload.get("idempotency_key"),
        )
    
    @staticmethod
    def get_active_apis(provider: str = None) -> List[ThirdPartyAPI]:
        """Get active APIs, optionally filtered by provider"""
        queryset = ThirdPartyAPI.objects.filter(is_active=True)
        if provider:
            queryset = queryset.filter(provider=provider)
        return queryset.order_by('priority')
    
    @staticmethod
    def sync_products_from_api(api_id: int) -> Dict[str, Any]:
        """Sync products from external API to ExternalProduct model"""
        from .product_sync_service import ProductSynchronizationService
        return ProductSynchronizationService.synchronize(api_id)
        from store.models import ExternalProduct  # Import here to avoid circular imports
        
        try:
            api_config = ThirdPartyAPI.objects.get(id=api_id)
            
            # Use connector directly to avoid response format issues
            connector = ConnectorFactory.get_connector(api_config)
            products_data = connector.get_products()
            
            if not products_data:
                return {
                    'success': False,
                    'error': 'No products returned from API',
                    'details': 'Empty product list from connector'
                }
            
            # Filter only active products (price > 0 and has fields)
            valid_products = [
                product for product in products_data 
                if product.get('external_id') and product.get('name')
            ]
            
            synced_count = 0
            updated_count = 0
            activated_external_ids = []
            deactivated_external_ids = []
            
            for product_data in valid_products:
                # Handle null descriptions
                description = product_data.get('description') or ''
                original_data = product_data.get('original_data')
                normalized_external_data = dict(product_data)
                if original_data is not None:
                    normalized_external_data['original_data'] = original_data
                is_active = APIService._normalize_active_status(product_data.get('status'))
                
                # Create or update ExternalProduct
                external_product, created = ExternalProduct.objects.update_or_create(
                    external_id=product_data['external_id'],
                    api_config=api_config,
                    defaults={
                        'name': product_data['name'],
                        'description': description,
                        'base_price': product_data['base_price'],
                        'category': product_data.get('category', 'general'),
                        'required_fields_json': product_data.get('required_fields', []),
                        'external_data': product_data.get('external_data')
                        or normalized_external_data,
                        'is_active': is_active
                    }
                )
                
                if created:
                    synced_count += 1
                else:
                    updated_count += 1

                if is_active:
                    activated_external_ids.append(external_product.id)
                else:
                    deactivated_external_ids.append(external_product.id)

            # Update store products to reflect external active state
            if activated_external_ids or deactivated_external_ids:
                from store.models import StoreProduct
                if activated_external_ids:
                    StoreProduct.objects.filter(
                        external_product_id__in=activated_external_ids
                    ).update(is_active=True)
                if deactivated_external_ids:
                    StoreProduct.objects.filter(
                        external_product_id__in=deactivated_external_ids
                    ).update(is_active=False)
            
            return {
                'success': True,
                'synced_count': synced_count,
                'updated_count': updated_count,
                'total_products': len(products_data),
                'valid_products': len(valid_products)
            }
            
        except Exception as e:
            logger.error(f"Product sync failed for API {api_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def refresh_external_product_statuses(provider: str = None) -> Dict[str, Any]:
        """Fast status refresh for external products (active/inquiry_enabled)."""
        from .product_sync_service import ProductSynchronizationService
        results = []
        for api_config in APIService.get_active_apis(provider=provider):
            results.append(ProductSynchronizationService.synchronize(api_config.id))
        return {
            "success": all(result.get("success") for result in results) if results else True,
            "checked": sum(result.get("total_products", 0) for result in results),
            "updated": sum(result.get("updated_count", 0) for result in results),
            "runs": results,
        }
        from store.models import ExternalProduct, StoreProduct

        api_configs = ThirdPartyAPI.objects.filter(is_active=True)
        if provider:
            api_configs = api_configs.filter(provider=provider)

        total_checked = 0
        total_updated = 0
        activated_ids = set()
        deactivated_ids = set()

        for api_config in api_configs:
            connector = ConnectorFactory.get_connector(api_config)
            if hasattr(connector, "timeout"):
                try:
                    connector.timeout = min(int(getattr(connector, "timeout", 5)), 5)
                except Exception:
                    connector.timeout = 5
            connector.retries = 0
            products = connector.get_products() or []

            by_external_id = {str(p.get("external_id")): p for p in products if p.get("external_id")}
            if not by_external_id:
                continue

            external_products = ExternalProduct.objects.filter(
                api_config=api_config,
                external_id__in=by_external_id.keys()
            )

            updates = []
            for external_product in external_products:
                total_checked += 1
                pdata = by_external_id.get(str(external_product.external_id))
                if not pdata:
                    continue

                new_active = APIService._normalize_active_status(pdata.get("status"))
                new_inquiry = pdata.get("inquiry_enabled")
                new_inquiry = str(new_inquiry).lower() in {"1", "true", "yes"}

                changed = False
                if external_product.is_active != new_active:
                    external_product.is_active = new_active
                    changed = True

                external_data = external_product.external_data or {}
                current_inquiry = external_data.get("inquiry_enabled")
                current_inquiry = str(current_inquiry).lower() in {"1", "true", "yes"}
                if current_inquiry != new_inquiry:
                    external_data["inquiry_enabled"] = new_inquiry
                    external_product.external_data = external_data
                    changed = True

                if changed:
                    updates.append(external_product)
                    total_updated += 1
                    if new_active:
                        activated_ids.add(external_product.id)
                    else:
                        deactivated_ids.add(external_product.id)

            if updates:
                ExternalProduct.objects.bulk_update(
                    updates, ["is_active", "external_data"]
                )

        if activated_ids:
            StoreProduct.objects.filter(
                external_product_id__in=activated_ids
            ).update(is_active=True)
        if deactivated_ids:
            StoreProduct.objects.filter(
                external_product_id__in=deactivated_ids
            ).update(is_active=False)

        return {
            "success": True,
            "checked": total_checked,
            "updated": total_updated
        }
    
    @staticmethod
    def process_payment(api_id: int, store_product_id: int, user_data: Dict,
                    internal_tx_id: int, user_inputs: Dict) -> Dict[str, Any]:
        """Process payment through external API - FIXED CIRCULAR IMPORT"""
        try:
            api_config = ThirdPartyAPI.objects.get(id=api_id)
            
            # Avoid direct import - use apps.get_model
            StoreProduct = apps.get_model('store', 'StoreProduct')
            store_product = StoreProduct.objects.get(id=store_product_id)
            
            # Handle transaction lookup
            Transaction = apps.get_model('transactions', 'Transaction')
            try:
                internal_transaction = Transaction.objects.get(id=internal_tx_id)
            except Transaction.DoesNotExist:
                # Provider execution must be attached to a pre-authorized
                # canonical purchase. Never create a debit from client data.
                return {
                    'success': False,
                    'error_code': 'PURCHASE_OPERATION_REQUIRED',
                    'error': 'Provider execution requires a canonical purchase transaction',
                }
            
            # Check if external product exists
            if not store_product.external_product:
                return {
                    'success': False,
                    'error': 'Store product is not linked to an external product'
                }
            
            # Check if external product is active
            if not store_product.external_product.is_active:
                return {
                    'success': False, 
                    'error': 'External product is not active'
                }

            # Prepare product data for external API
            quantity_value = user_inputs.get('quantity')
            if quantity_value in (None, ''):
                quantity_value = user_inputs.get('amount', 1)

            cleaned_user_inputs = user_inputs
            if api_config.provider == 'alaaeddin':
                logger.warning(
                    "[Alaaeddin] raw user_inputs keys=%s",
                    list(user_inputs.keys()) if isinstance(user_inputs, dict) else type(user_inputs),
                )
                # For Alaaeddin V2, customization products often require quantity
                # to be an integer. Prefer selected_option_id if provided.
                selected_opt = user_inputs.get('selected_option') or user_inputs.get('option')
                selected_opt_id = user_inputs.get('selected_option_id') or user_inputs.get('option_id')
                if selected_opt_id not in (None, ""):
                    try:
                        quantity_value = int(float(str(selected_opt_id)))
                    except Exception:
                        quantity_value = 1
                elif selected_opt not in (None, ""):
                    try:
                        # If it's an integer-like string, use it; otherwise fallback to 1
                        as_float = float(str(selected_opt))
                        quantity_value = int(as_float) if as_float.is_integer() else 1
                    except Exception:
                        quantity_value = 1

                required_fields = store_product.external_product.required_fields_json or []
                allowed_params = []
                for field in required_fields:
                    if isinstance(field, dict):
                        name = (
                            field.get('field_name')
                            or field.get('name')
                            or field.get('field')
                            or field.get('key')
                            or field.get('label')
                        )
                        if name:
                            allowed_params.append(str(name))
                    elif field is not None:
                        allowed_params.append(str(field))

                meta_keys = {
                    'base_currency', 'client_ref', 'display_currency', 'fx_used', 'mode',
                    'original_amount', 'product_id', 'product_name', 'quantity',
                    'selected_option', 'selected_option_id', 'unit_price_base',
                    'unit_price_display', 'wallet_balance_before',
                    'payment_processed_at', 'final_amount_submitted', 'currency_submitted',
                    'wallet_balance_before_payment'
                }
                sanitized_inputs = {
                    key: value
                    for key, value in user_inputs.items()
                    if key not in meta_keys
                }
                cleaned_user_inputs = sanitized_inputs
                if allowed_params:
                    allowed_set = {str(p) for p in allowed_params if str(p).strip()}
                    filtered = {
                        key: value
                        for key, value in sanitized_inputs.items()
                        if str(key) in allowed_set
                    }
                    if filtered:
                        cleaned_user_inputs = filtered
                    else:
                        # Map inputs to required field names when keys don't match
                        mapped_inputs = {}
                        required_fields = store_product.external_product.required_fields_json or []
                        if isinstance(required_fields, list) and required_fields:
                            for field in required_fields:
                                if isinstance(field, dict):
                                    fname = field.get('field_name') or field.get('name') or field.get('field')
                                else:
                                    fname = str(field)
                                if not fname:
                                    continue
                                if fname in sanitized_inputs:
                                    mapped_inputs[fname] = sanitized_inputs[fname]
                                elif len(required_fields) == 1 and sanitized_inputs:
                                    # If single required field, map any provided value (e.g., phone)
                                    mapped_inputs[fname] = next(iter(sanitized_inputs.values()))
                        if mapped_inputs:
                            cleaned_user_inputs = mapped_inputs
                logger.warning(
                    "[Alaaeddin] inputs -> allowed=%s, cleaned_keys=%s, sanitized_keys=%s",
                    list(allowed_params),
                    list(cleaned_user_inputs.keys()),
                    list(sanitized_inputs.keys()),
                )
                print(
                    "Alaaeddin filtered inputs:",
                    {
                        "keys": list(cleaned_user_inputs.keys()),
                        "quantity": quantity_value,
                        "selected_opt": selected_opt,
                    },
                    flush=True,
                )
                logger.warning(
                    "[Alaaeddin] qty computed -> quantity=%s, selected_opt_id=%s, selected_opt=%s, fields=%s",
                    quantity_value,
                    selected_opt_id,
                    selected_opt,
                    list(cleaned_user_inputs.keys()),
                )

                # Enforce allowed quantity options if provided by Alaaeddin product
                ext_data = store_product.external_product.external_data or {}
                qty_options = ext_data.get("quantity_options")
                if qty_options is None and isinstance(ext_data.get("original_data"), dict):
                    qty_options = (ext_data["original_data"].get("quantity") or {}).get("options")
                if isinstance(qty_options, list) and qty_options:
                    allowed_raw = [str(v) for v in qty_options if v is not None]
                    if allowed_raw:
                        # Prefer selected_option string if it matches allowed values
                        if selected_opt not in (None, "") and str(selected_opt) in allowed_raw:
                            quantity_value = str(selected_opt)
                        else:
                            # Use selected_option_id as 1-based index into allowed list
                            sel_id = None
                            if selected_opt_id not in (None, ""):
                                try:
                                    sel_id = int(float(str(selected_opt_id)))
                                except Exception:
                                    sel_id = None
                            if sel_id and 1 <= sel_id <= len(allowed_raw):
                                quantity_value = allowed_raw[sel_id - 1]

                        if str(quantity_value) not in allowed_raw:
                            quantity_value = allowed_raw[0]

                        logger.warning(
                            "[Alaaeddin] qty normalized to allowed options -> quantity=%s, allowed=%s",
                            quantity_value,
                            allowed_raw,
                        )
            elif api_config.provider == 'stark-card':
                # Stark-Card uses integer qty with rules in external_data.quantity_rules
                external_data = store_product.external_product.external_data or {}
                quantity_rules = external_data.get('quantity_rules')
                if quantity_rules is None and isinstance(external_data.get('original_data'), dict):
                    quantity_rules = external_data['original_data'].get('quantity_rules') or external_data['original_data'].get('qty_values')

                selected_opt = user_inputs.get('selected_option') or user_inputs.get('amount') or user_inputs.get('quantity')

                try:
                    if isinstance(quantity_rules, dict):
                        rule_type = quantity_rules.get('type')
                        if rule_type == 'fixed':
                            quantity_value = int(quantity_rules.get('value', 1) or 1)
                        elif rule_type == 'specific':
                            values = quantity_rules.get('values') or []
                            values = [str(v) for v in values if v is not None]
                            if selected_opt is not None and str(selected_opt) in values:
                                quantity_value = int(float(str(selected_opt)))
                            elif str(quantity_value) in values:
                                quantity_value = int(float(str(quantity_value)))
                            elif values:
                                quantity_value = int(float(values[0]))
                        elif rule_type == 'range':
                            min_v = float(quantity_rules.get('min', 1) or 1)
                            max_v = float(quantity_rules.get('max', min_v) or min_v)
                            raw = float(selected_opt) if selected_opt is not None else float(quantity_value or min_v)
                            raw = max(min_v, min(max_v, raw))
                            quantity_value = int(raw)
                except Exception:
                    quantity_value = int(quantity_value) if quantity_value not in (None, '') else 1

                allowed_params = []
                required_fields = store_product.external_product.required_fields_json or []
                for field in required_fields:
                    if isinstance(field, dict):
                        name = (
                            field.get('field_name')
                            or field.get('name')
                            or field.get('field')
                            or field.get('key')
                        )
                        if name:
                            allowed_params.append(str(name))
                    elif field is not None:
                        allowed_params.append(str(field))

                external_data = store_product.external_product.external_data or {}
                params = external_data.get('params')
                if params is None and isinstance(external_data.get('original_data'), dict):
                    params = external_data['original_data'].get('params')
                if isinstance(params, list):
                    for item in params:
                        if item is not None:
                            allowed_params.append(str(item))

                if allowed_params:
                    allowed_set = {str(p) for p in allowed_params if str(p).strip()}
                    cleaned_user_inputs = {
                        key: value
                        for key, value in user_inputs.items()
                        if str(key) in allowed_set
                    }
                else:
                    cleaned_user_inputs = {}

            product_data = {
                'external_id': store_product.external_product.external_id,
                'quantity': quantity_value or 1,
                'user_inputs': cleaned_user_inputs,
                'final_price': float(internal_transaction.target_amount or abs(internal_transaction.amount))
            }

            logger.warning(
                "[Alaaeddin] process_payment -> store_product_id=%s, external_id=%s, quantity=%s",
                store_product_id,
                store_product.external_product.external_id,
                product_data.get("quantity"),
            )
            logger.warning(
                "[Purchase] product_data user_inputs keys=%s (provider=%s)",
                list(product_data.get("user_inputs", {}).keys()) if isinstance(product_data.get("user_inputs"), dict) else type(product_data.get("user_inputs")),
                api_config.provider,
            )
            
            transaction_data = {
                'internal_tx_id': internal_tx_id,
                'description': f"Purchase: {store_product.name}",
                'amount': float(internal_transaction.target_amount or abs(internal_transaction.amount))
            }
            
            # Make API call with proper error handling
            result = APIService._execute_api_call_and_log(
                api_config=api_config,
                endpoint='/api/purchase',
                method='POST',
                payload={
                    'product_data': product_data,
                    'user_data': user_data,
                    'transaction_data': transaction_data
                },
                internal_transaction=internal_transaction
            )
            
            return result
            
        except StoreProduct.DoesNotExist:
            error_msg = f"Store product not found with ID: {store_product_id}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
        except ThirdPartyAPI.DoesNotExist:
            error_msg = f"API configuration not found with ID: {api_id}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            logger.error(f"Payment processing failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def test_api_connection(api_id: int) -> Dict[str, Any]:
        """Test connection to a specific API with detailed info"""
        try:
            api_config = ThirdPartyAPI.objects.get(id=api_id)
            connector = ConnectorFactory.get_connector(api_config)
            
            # Test balance endpoint
            balance_result = connector.get_balance()
            balance_success = balance_result.get('success', False)
            balance_data = balance_result.get('data', {})
            
            # Test products endpoint
            products_result = connector.get_products()
            products_success = products_result is not None
            products_count = len(products_result) if products_result else 0
            
            is_connected = balance_success and products_success
            
            return {
                'success': True,
                'connected': is_connected,
                'api_name': api_config.name,
                'provider': api_config.provider,
                'balance_test': {
                    'success': balance_success,
                    'balance': balance_data.get('balance') if balance_success else None,
                    'error': balance_result.get('error') if not balance_success else None
                },
                'products_test': {
                    'success': products_success,
                    'products_count': products_count
                },
                'details': f"Balance: {'OK' if balance_success else 'FAIL'}, Products: {products_count} found"
            }
        except Exception as e:
            logger.error(f"Connection test failed for API {api_id}: {e}")
            return {
                'success': False,
                'connected': False,
                'error': str(e)
            }

    @staticmethod
    def get_active_api_balances() -> List[Dict[str, Any]]:
        """Fetch balances for all active third-party APIs."""
        cache_key = "third_party_api_balances"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        results: List[Dict[str, Any]] = []
        api_configs = ThirdPartyAPI.objects.filter(is_active=True).order_by('priority', 'id')
        for api_config in api_configs:
            try:
                connector = ConnectorFactory.get_connector(api_config)
                if hasattr(connector, "timeout"):
                    try:
                        connector.timeout = min(int(getattr(connector, "timeout", 5)), 5)
                    except Exception:
                        connector.timeout = 5
                connector.retries = 0
                balance_result = connector.get_balance()
                normalized = APIService._normalize_balance(balance_result)
                balance_value = normalized.get("balance")
                currency_value = normalized.get("currency")
                error_message = balance_result.get("error")
                error_code = None
                if balance_value is None and not error_message:
                    error_message = "Balance not found in response"
                    error_code = "BALANCE_NOT_FOUND"
                if error_message and not error_code:
                    error_code = "API_BALANCE_FAILED"
                results.append({
                    'id': api_config.id,
                    'name': api_config.name,
                    'provider': api_config.provider,
                    'success': bool(balance_result.get('success', False)) and balance_value is not None,
                    'balance': float(balance_value) if balance_value is not None else None,
                    'currency': currency_value,
                    'error': error_message,
                    'error_code': error_code,
                })
            except Exception as exc:
                logger.error(f"Failed to fetch balance for API {api_config.id}: {exc}")
                results.append({
                    'id': api_config.id,
                    'name': api_config.name,
                    'provider': api_config.provider,
                    'success': False,
                    'balance': None,
                    'error': str(exc),
                    'error_code': "API_BALANCE_EXCEPTION",
                })
        cache.set(cache_key, results, 60)
        return results

    @staticmethod
    def update_order_status(api_id: int, external_order_id: str) -> Dict[str, Any]:
        """Check external order status and refund if rejected after pending."""
        try:
            api_config = ThirdPartyAPI.objects.get(id=api_id)
        except ThirdPartyAPI.DoesNotExist:
            return {'success': False, 'error': f'API configuration not found: {api_id}'}

        try:
            from django.db import transaction as db_transaction
            api_transaction = APITransaction.objects.filter(
                api_config=api_config,
                external_transaction_id=str(external_order_id)
            ).order_by('-id').first()

            connector = ConnectorFactory.get_connector(api_config)
            if not hasattr(connector, "check_order_status"):
                return {'success': False, 'error': f'Provider {api_config.provider} does not support status checks'}

            local_id = None
            if api_transaction and isinstance(api_transaction.response_payload, dict):
                local_id = api_transaction.response_payload.get('local_id')

            status_result = connector.check_order_status(local_id or external_order_id)
            if not status_result.get('success'):
                return {
                    'success': False,
                    'error': status_result.get('error', 'Order status check failed'),
                    'status_code': status_result.get('status_code')
                }

            response_data = status_result.get('data') or {}
            if isinstance(response_data, dict) and response_data.get('success') is False:
                return {
                    'success': False,
                    'error': response_data.get('error', {}).get('message', 'Order status error'),
                    'status_code': status_result.get('status_code')
                }

            order_data = response_data.get('data', {})
            if isinstance(order_data, list) and order_data:
                order_data = order_data[0]
            if isinstance(order_data, dict) and 'order' in order_data:
                order_data = order_data.get('order') or {}

            raw_status = None
            if isinstance(order_data, dict):
                raw_status = order_data.get('status') or order_data.get('state')
            if raw_status is None and isinstance(response_data, dict):
                raw_status = response_data.get('status')

            normalized = APIService._normalize_order_status(raw_status or response_data.get('message') or response_data.get('msg'))

            # Update internal transaction and refund if needed
            internal_tx = api_transaction.internal_transaction if api_transaction else None
            if internal_tx:
                with db_transaction.atomic():
                    # Lock transaction and wallet to prevent duplicate refunds
                    from transactions.models import Transaction as TxModel
                    locked_tx = TxModel.objects.select_for_update().get(id=internal_tx.id)
                    wallet = locked_tx.wallet

                    if normalized == 'approved' and locked_tx.status == 'pending':
                        FinanceService.approve(locked_tx.id)
                        locked_tx.refresh_from_db()
                        locked_tx.note = (locked_tx.note or '') + f"; provider_status={raw_status}"
                        locked_tx.save(update_fields=["note", "updated_at"])
                        if locked_tx.payment:
                            locked_tx.payment.status = "success"
                            if not locked_tx.payment.external_transaction_id:
                                locked_tx.payment.external_transaction_id = str(external_order_id)
                            locked_tx.payment.save(update_fields=[
                                "status",
                                "external_transaction_id",
                                "updated_at",
                            ])
                    elif normalized == 'rejected' and locked_tx.status not in ('rejected', 'failed', 'cancelled'):
                        rejection_reason = f"Provider rejected order: {raw_status}"
                        if locked_tx.status == "approved":
                            # A provider can reject after an optimistic local
                            # approval. Compensate the original debit through
                            # FinanceService so its captured FX snapshot is
                            # reused and the operation is reversed once.
                            FinanceService.cancel(locked_tx.id, reason=rejection_reason)
                        else:
                            FinanceService.reject(locked_tx.id, reason=rejection_reason)
                        locked_tx.refresh_from_db()
                        locked_tx.note = (locked_tx.note or '') + f"; provider_reject={raw_status}"
                        locked_tx.save(update_fields=["note", "updated_at"])
                        if locked_tx.payment:
                            locked_tx.payment.status = "failed"
                            locked_tx.payment.error_message = f"Provider rejected order: {raw_status}"
                            if not locked_tx.payment.external_transaction_id:
                                locked_tx.payment.external_transaction_id = str(external_order_id)
                            locked_tx.payment.save(update_fields=[
                                "status",
                                "error_message",
                                "external_transaction_id",
                                "updated_at",
                            ])

            return {
                'success': True,
                'status': normalized,
                'raw_status': raw_status,
                'order': order_data
            }
        except Exception as e:
            logger.error(f"Order status update failed: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}


class MockAPIService:
    """Mock API service for testing without external API calls"""
    
    @staticmethod
    def process_payment(api_id: int, store_product_id: int, user_data: Dict,
                       internal_tx_id: int, user_inputs: Dict) -> Dict[str, Any]:
        """Mock payment processing that always succeeds"""
        try:
            from store.models import StoreProduct
            
            store_product = StoreProduct.objects.get(id=store_product_id)
            phone_number = user_inputs.get('phone_number', 'Unknown')
            amount = user_inputs.get('amount', '100')
            
            logger.info(f"🎭 MOCK: Processing payment for {store_product.name}")
            logger.info(f"🎭 MOCK: Transferring {amount} units to {phone_number}")
            
            # Simulate processing delay
            import time
            time.sleep(1)
            
            # Return mock success response
            return {
                'success': True,
                'external_transaction_id': f'mock_success_{internal_tx_id}',
                'order_id': f'order_{internal_tx_id}',
                'message': f'تم تحويل {amount} وحدة سيريتل بنجاح إلى الرقم {phone_number}',
                'status_code': 200
            }
            
        except Exception as e:
            logger.error(f"Mock payment failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def test_api_connection(api_id: int) -> Dict[str, Any]:
        """Mock connection test that always succeeds"""
        return {
            'success': True,
            'connected': True,
            'api_name': 'Mock API',
            'provider': 'mock',
            'balance_test': {
                'success': True,
                'balance': 10000.00,
                'error': None
            },
            'products_test': {
                'success': True,
                'products_count': 50
            },
            'details': 'Mock API connection successful'
        }
class APIRateLimitService:
    """Service to enforce API rate limits"""
    
    @staticmethod
    def check_rate_limit(api_id: int) -> tuple[bool, str]:
        """Check if API has exceeded daily limit"""
        try:
            api_config = ThirdPartyAPI.objects.get(id=api_id)
            
            if not api_config.max_daily_limit:
                return True, "No limit set"
            
            # Get today's transactions count and total amount
            today = timezone.now().date()
            today_txs = APITransaction.objects.filter(
                api_config=api_config,
                request_timestamp__date=today
            )
            
            # Count transactions
            tx_count = today_txs.count()
            
            # For some APIs, we might track amount instead of count
            # This depends on API provider pricing model
            
            if tx_count >= int(api_config.max_daily_limit):
                return False, f"Daily limit reached: {tx_count}/{api_config.max_daily_limit}"
            
            return True, f"Available: {api_config.max_daily_limit - tx_count} remaining"
            
        except ThirdPartyAPI.DoesNotExist:
            return False, "API not found"
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True, "Rate limit check failed, proceeding"
    
    @staticmethod
    def get_api_priority(provider: str) -> int:
        """Get API priority based on provider and success rate"""
        apis = ThirdPartyAPI.objects.filter(
            provider=provider,
            is_active=True
        ).order_by('priority')
        
        if not apis.exists():
            return None
        
        # Return the highest priority API that hasn't reached its limit
        for api in apis:
            is_available, _ = APIRateLimitService.check_rate_limit(api.id)
            if is_available:
                return api
        
        # If all APIs at limit, return the first one anyway
        return apis.first()
