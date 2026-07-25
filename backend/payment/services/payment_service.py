# payments/services/payment_service.py
import logging
from django.db import transaction as db_transaction
from django.utils import timezone
from ..models import Payment, PaymentConfig
from wallets.models import Wallet
from store.models import StoreProduct
from transactions.models import Transaction
from third_party_apis.services.api_service import APIService

logger = logging.getLogger(__name__)

class PaymentService:
    
    @staticmethod
    @db_transaction.atomic
    def process_payment(store_product_id, user, user_inputs):
        try:
            # ✅ FIX THIS LINE - Change 'product' to 'external_product'
            store_product = StoreProduct.objects.select_related(
                'section', 
                'external_product',  # ✅ CORRECT FIELD NAME
                'external_product__api_config'
            ).get(id=store_product_id, is_active=True)        
            # 2. Check if product has external product connection
            if not store_product.product.external_product:
                return {
                    'success': False,
                    'error': 'Product is not connected to an external service'
                }
            
            # 3. Get payment configuration
            payment_config = PaymentConfig.get_config()
            
            # 4. Get user wallet (use appropriate currency)
            user_wallet = Wallet.objects.get(user=user, currency='USD')  # Adjust as needed
            
            # 5. Calculate prices
            base_price = store_product.price
            final_price = base_price + (base_price * payment_config.profit_percentage / 100)
            
            # 6. Check wallet balance
            if user_wallet.available_balance < final_price:
                return {
                    'success': False,
                    'error': f'Insufficient balance. Need: {final_price}, Have: {user_wallet.available_balance}'
                }
            
            # 7. Create payment record
            payment = Payment.objects.create(
                user=user,
                store_product=store_product,
                wallet=user_wallet,
                base_price=base_price,
                profit_percentage=payment_config.profit_percentage,
                final_price=final_price,
                user_inputs=user_inputs,
                status='processing'
            )
            
            # 8. Hold funds in wallet (create pending transaction)
            from transactions.models import Transaction
            hold_transaction = Transaction.objects.create(
                user=user,
                wallet=user_wallet,
                amount=-final_price,  # Negative for deduction
                transaction_type='purchase_hold',
                status='pending',
                note=f"Hold for payment #{payment.id} - {store_product.name}"
            )
            
            # Update wallet balances
            user_wallet.pending_balance += final_price
            user_wallet.available_balance -= final_price
            user_wallet.save()
            
            # 9. Get external product and API config
            external_product = store_product.product.external_product
            api_config = external_product.api_config
            
            # 10. Prepare data for external API
            user_data = {
                'user_id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone
            }
            
            # Prepare product data with EXTERNAL PRODUCT ID
            product_data = {
                'external_id': external_product.external_id,  # This is the key connection!
                'quantity': user_inputs.get('quantity', 1),
                'user_inputs': user_inputs,
                'final_price': float(final_price)
            }
            
            transaction_data = {
                'internal_tx_id': payment.id,
                'description': f"Payment: {store_product.name}",
                'amount': float(final_price)
            }
            
            # 11. Call external API with the external product ID
            api_result = APIService.process_payment(
                api_id=api_config.id,
                store_product_id=store_product_id,
                user_data=user_data,
                internal_tx_id=payment.id,
                user_inputs=user_inputs
            )
            
            # 12. Handle API response
            if api_result and api_result.get('success'):
                # API call successful - complete the payment
                payment.status = 'success'
                payment.external_transaction_id = api_result.get('external_transaction_id') or api_result.get('order_id')
                payment.processed_at = timezone.now()
                payment.save()
                
                # Update transaction status
                hold_transaction.status = 'approved'
                hold_transaction.note = f"Completed payment #{payment.id} - External ID: {payment.external_transaction_id}"
                hold_transaction.save()
                
                # Finalize wallet balances
                user_wallet.pending_balance -= final_price
                user_wallet.save()
                
                return {
                    'success': True,
                    'payment_id': payment.id,
                    'external_transaction_id': payment.external_transaction_id,
                    'order_id': api_result.get('order_id'),
                    'message': api_result.get('message', 'Payment completed successfully'),
                    'final_price': float(final_price),
                    'new_balance': float(user_wallet.available_balance)
                }
            else:
                # API call failed - refund wallet
                user_wallet.available_balance += final_price
                user_wallet.pending_balance -= final_price
                user_wallet.save()
                
                payment.status = 'failed'
                error_msg = api_result.get('error', 'External API call failed') if api_result else 'API returned no response'
                payment.error_message = error_msg
                payment.save()
                
                # Update hold transaction
                hold_transaction.status = 'rejected'
                hold_transaction.note = f"Failed payment #{payment.id} - {error_msg}"
                hold_transaction.save()
                
                return {
                    'success': False,
                    'error': error_msg,
                    'payment_id': payment.id
                }
                
        except Exception as e:
            logger.error(f"Payment processing failed: {e}")
            
            # Refund wallet if payment was created
            if 'payment' in locals() and 'user_wallet' in locals():
                user_wallet.available_balance += final_price
                user_wallet.pending_balance -= final_price
                user_wallet.save()
                
                payment.status = 'failed'
                payment.error_message = str(e)
                payment.save()
            
            return {
                'success': False,
                'error': f'Payment processing failed: {str(e)}'
            }