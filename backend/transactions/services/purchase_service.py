# transactions/services/purchase_service.py
import logging
from django.db import transaction as db_transaction
from django.utils import timezone
from ..models import Transaction
from wallets.models import Wallet
from typing import Dict, Any
from third_party_apis.services.api_service import APIService 

logger = logging.getLogger(__name__)

class PurchaseService:
    
    @staticmethod
    @db_transaction.atomic
    def process_purchase(store_product_id: int, user, user_inputs: Dict) -> Dict[str, Any]:
        """Atomic purchase flow with external API integration"""
        
        from store.models import StoreProduct  # Import here to avoid circular imports
        
        try:
            # 1. Get store product and validate
            store_product = StoreProduct.objects.select_related(
                'external_product', 
                'external_product__api_config'
            ).get(id=store_product_id, is_active=True)
            
            # FIX: Specify currency when getting wallet
            user_wallet = Wallet.objects.get(user=user, currency='syp')
            purchase_amount = store_product.price
            
            # 2. Check wallet balance BEFORE creating transaction
            if user_wallet.balance < purchase_amount:
                return {
                    'success': False,
                    'error': f'Insufficient balance. Need: {purchase_amount}, Have: {user_wallet.balance}'
                }
            
            # 3. Start atomic transaction - Create pending transaction
            internal_transaction = Transaction.objects.create(
                user=user,
                wallet=user_wallet,
                transaction_type="purchase",
                amount=purchase_amount,
                status="pending",
                note=f"Purchase: {store_product.name}"
            )
            
            # 4. Hold funds (debit wallet)
            user_wallet.balance -= purchase_amount
            user_wallet.save()
            
            # 5. Call external API via agent app
            api_config = store_product.external_product.api_config
            
            # FIX: Use user.name instead of user.username
            user_data = {
                'user_id': user.id,
                'name': user.name,  # FIXED: Use name instead of username
                'email': user.email
            }
            
            api_result = APIService.process_payment(
                api_id=api_config.id,
                store_product_id=store_product_id,
                user_data=user_data,
                internal_tx_id=internal_transaction.id,
                user_inputs=user_inputs
            )
            
            # 6. Handle API response with better error messages
            if api_result and api_result.get('success'):
                # API call successful - complete transaction
                internal_transaction.status = "approved"
                
                # Add external transaction ID if available
                if api_result.get('external_transaction_id'):
                    internal_transaction.note = f"{internal_transaction.note} - External ID: {api_result.get('external_transaction_id')}"
                elif api_result.get('order_id'):
                    internal_transaction.note = f"{internal_transaction.note} - Order ID: {api_result.get('order_id')}"
                    
                internal_transaction.save()
                
                return {
                    'success': True,
                    'transaction_id': internal_transaction.id,
                    'external_transaction_id': api_result.get('external_transaction_id'),
                    'order_id': api_result.get('order_id'),
                    'message': api_result.get('message', 'Purchase completed successfully'),
                    'new_balance': user_wallet.balance
                }
            else:
                # API call failed - rollback wallet debit
                user_wallet.balance += purchase_amount
                user_wallet.save()
                
                internal_transaction.status = "failed"
                
                # Better error message handling
                error_msg = api_result.get('error', 'External API call failed') if api_result else 'API returned no response'
                
                # Handle specific API errors
                if 'Product is not active' in error_msg:
                    error_msg = 'Product not available for purchase'
                elif 'Invalid fields' in error_msg:
                    error_msg = 'Invalid field values provided'
                elif 'Insufficient balance' in error_msg.lower():
                    error_msg = 'Insufficient API balance'
                
                internal_transaction.note = f"API Error: {error_msg}"
                internal_transaction.save()
                
                return {
                    'success': False,
                    'error': error_msg,
                    'details': api_result.get('details') if api_result else None,
                    'transaction_id': internal_transaction.id
                }
                
        except StoreProduct.DoesNotExist:
            return {
                'success': False,
                'error': 'Product not found or inactive'
            }
        except Wallet.DoesNotExist:
            return {
                'success': False,
                'error': 'User wallet not found. Please contact support.'
            }
        except Exception as e:
            logger.error(f"Purchase processing failed: {e}")
            # Any exception will trigger automatic rollback due to @db_transaction.atomic
            
            return {
                'success': False,
                'error': f'Purchase processing failed: {str(e)}'
            }