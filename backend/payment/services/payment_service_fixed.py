from decimal import Decimal
from django.db import transaction as db_transaction
from django.utils import timezone
from ..models import Payment, PaymentConfig
from wallets.models import Wallet
from store.models import StoreProduct
from transactions.models import Transaction
from third_party_apis.services.api_service import APIService
import logging

logger = logging.getLogger(__name__)

class FixedPaymentService:
    
    @staticmethod
    @db_transaction.atomic
    def process_payment(store_product_id, user, user_inputs):
        """FIXED VERSION: Process payment with proper field names and decimal handling"""
        try:
            # 1. Get store product with CORRECT relationships
            store_product = StoreProduct.objects.select_related(
                'section',
                'external_product',  # ✅ FIXED FIELD NAME
                'external_product__api_config'
            ).get(id=store_product_id, is_active=True)
            
            logger.info(f"Processing payment for: {store_product.name}")
            logger.info(f"External product: {store_product.external_product.name}")
            logger.info(f"External ID: {store_product.external_product.external_id}")

            # 2. Get payment configuration
            payment_config = PaymentConfig.get_config()

            # 3. Get user wallet (use appropriate currency)
            # For Syrian products, use SYP wallet
            user_wallet = Wallet.objects.get(user=user, currency='SYP')
            original_balance = user_wallet.available_balance

            logger.info(f"Wallet balance: {original_balance} SYP")

            # 4. Calculate prices with PROPER decimal handling
            base_price = Decimal(str(store_product.price))
            profit_percentage = Decimal(str(payment_config.profit_percentage))
            final_price = base_price + (base_price * profit_percentage / Decimal('100'))

            logger.info(f"Base price: {base_price} SYP")
            logger.info(f"Profit %: {profit_percentage}%")
            logger.info(f"Final price: {final_price} SYP")

            # 5. Check wallet balance
            if user_wallet.available_balance < final_price:
                error_msg = f'Insufficient balance. Need: {final_price}, Have: {user_wallet.available_balance}'
                logger.warning(error_msg)
                return {
                    'success': False,
                    'error': error_msg
                }

            # 6. Create payment record
            payment = Payment.objects.create(
                user=user,
                store_product=store_product,
                wallet=user_wallet,
                base_price=base_price,
                profit_percentage=profit_percentage,
                final_price=final_price,
                user_inputs=user_inputs,
                status='processing'
            )
            logger.info(f"Payment record created: #{payment.id}")

            # 7. Hold funds in wallet (create pending transaction)
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

            logger.info(f"Funds held - Available: {user_wallet.available_balance}, Pending: {user_wallet.pending_balance}")

            # 8. Get external product and API config
            external_product = store_product.external_product
            api_config = external_product.api_config

            # 9. Prepare data for external API with CORRECT field mapping
            user_data = {
                'user_id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone
            }

            # Prepare product data with EXTERNAL PRODUCT ID and proper field mapping
            product_data = {
                'external_id': external_product.external_id,
                'quantity': user_inputs.get('quantity', 1),
                'user_inputs': user_inputs,
                'final_price': float(final_price)
            }

            transaction_data = {
                'internal_tx_id': hold_transaction.id,  # ✅ Use transaction ID, not payment ID
                'description': f"Payment: {store_product.name}",
                'amount': float(final_price)
            }

            logger.info(f"Calling external API: {api_config.provider}")
            logger.info(f"External ID: {external_product.external_id}")
            logger.info(f"User Inputs: {user_inputs}")

            # 10. Call external API with PROPER transaction ID
            api_result = APIService.process_payment(
                api_id=api_config.id,
                store_product_id=store_product_id,
                user_data=user_data,
                internal_tx_id=hold_transaction.id,  # ✅ Use transaction ID
                user_inputs=user_inputs
            )

            logger.info(f"API Response: {api_result}")

            # 11. Handle API response
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

                logger.info(f"Payment completed successfully!")
                logger.info(f"External Transaction ID: {payment.external_transaction_id}")
                logger.info(f"New Balance: {user_wallet.available_balance} SYP")

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

                logger.warning(f"Payment failed: {error_msg}")
                logger.info(f"Balance restored: {user_wallet.available_balance} SYP")

                return {
                    'success': False,
                    'error': error_msg,
                    'payment_id': payment.id
                }
                
        except StoreProduct.DoesNotExist:
            error_msg = f"Store product not found with ID: {store_product_id}"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
            
        except Wallet.DoesNotExist:
            error_msg = "User wallet not found for SYP currency"
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
                
        except Exception as e:
            logger.error(f"Payment processing failed: {e}")
            
            # Refund wallet if payment was created
            if 'payment' in locals() and 'user_wallet' in locals():
                try:
                    user_wallet.available_balance += final_price
                    user_wallet.pending_balance -= final_price
                    user_wallet.save()
                    
                    payment.status = 'failed'
                    payment.error_message = str(e)
                    payment.save()
                except Exception as refund_error:
                    logger.error(f"Failed to refund wallet: {refund_error}")
            
            return {
                'success': False,
                'error': f'Payment processing failed: {str(e)}'
            }


class MockPaymentService:
    """Mock service for testing without external API calls"""
    
    @staticmethod
    @db_transaction.atomic
    def process_payment(store_product_id, user, user_inputs):
        """Mock version that simulates successful payment"""
        try:
            # Get store product
            store_product = StoreProduct.objects.select_related(
                'section',
                'external_product',
                'external_product__api_config'
            ).get(id=store_product_id, is_active=True)

            # Get wallet
            user_wallet = Wallet.objects.get(user=user, currency='SYP')
            final_price = Decimal(str(store_product.price))

            # Check balance
            if user_wallet.available_balance < final_price:
                return {'success': False, 'error': 'رصيد غير كافي'}

            # Create payment record
            payment = Payment.objects.create(
                user=user,
                store_product=store_product,
                wallet=user_wallet,
                base_price=final_price,
                profit_percentage=Decimal('0'),
                final_price=final_price,
                user_inputs=user_inputs,
                status='processing'
            )

            # Create transaction record
            transaction = Transaction.objects.create(
                user=user,
                wallet=user_wallet,
                amount=-final_price,
                transaction_type='purchase',
                status='pending',
                note=f"Test transfer to {user_inputs.get('رقم الهاتف', 'N/A')}"
            )

            # Hold funds
            user_wallet.available_balance -= final_price
            user_wallet.save()

            # Simulate API processing
            import time
            time.sleep(1)

            # Mark as successful
            payment.status = 'success'
            payment.external_transaction_id = f'syriatel_mock_{payment.id}'
            payment.processed_at = timezone.now()
            payment.save()

            transaction.status = 'approved'
            transaction.note = f"Completed - Mock transfer successful"
            transaction.save()

            return {
                'success': True,
                'payment_id': payment.id,
                'external_transaction_id': payment.external_transaction_id,
                'message': 'تم تحويل وحدات سيريتل بنجاح!',
                'new_balance': float(user_wallet.available_balance)
            }

        except Exception as e:
            logger.error(f"Mock payment failed: {e}")
            return {'success': False, 'error': str(e)}