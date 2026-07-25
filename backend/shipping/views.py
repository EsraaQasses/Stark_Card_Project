# shipping/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import F
from django.core.exceptions import ObjectDoesNotExist

from system.models import Notification
from .models import Shipping
from .serializers import ShippingSerializer, ShippingStatusUpdateSerializer
from users.permissions import IsAdminUser, IsRegularUser
from wallets.models import Wallet
from transactions.models import Transaction
import logging

logger = logging.getLogger(__name__)

class ShippingViewSet(viewsets.ModelViewSet):
    serializer_class = ShippingSerializer
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        """Get total count of shipping requests"""
        try:
            pending_count = Shipping.objects.filter(status='pending').count()
            total_count = Shipping.objects.count()
            
            return Response({
                'total_count': total_count,
                'pending_count': pending_count,
                'approved_count': Shipping.objects.filter(status='approved').count(),
                'rejected_count': Shipping.objects.filter(status='rejected').count()
            })
        except Exception as e:
            logger.error(f"Error getting shipping counts: {str(e)}")
            return Response({
                'error': 'Database error',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Shipping.objects.all().select_related('user', 'request')
        return Shipping.objects.filter(user=user).select_related('user', 'request')
    
    def get_serializer_class(self):
        if self.action in ['update_status', 'partial_update']:
            return ShippingStatusUpdateSerializer
        return ShippingSerializer
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_status(self, request, pk=None):
        """Update shipping status with proper transaction handling"""
        try:
            shipping = self.get_object()
            new_status = request.data.get('status')
            old_status = shipping.status
            
            # Validate status
            if new_status not in ['pending', 'approved', 'rejected', 'processing']:
                return Response({
                    "error": "Invalid status. Must be one of: pending, approved, rejected, processing"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            with transaction.atomic():
                # Update shipping status
                serializer = ShippingStatusUpdateSerializer(shipping, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                updated_shipping = serializer.save()
                
                # Update the original request status
                if new_status == 'approved':
                    shipping.request.status = 'completed'
                    shipping.request.admin_notes = request.data.get('admin_notes', 'Approved by admin')
                elif new_status == 'rejected':
                    shipping.request.status = 'rejected'
                    shipping.request.rejection_reason = request.data.get('admin_notes', 'Rejected by admin')
                
                shipping.request.save()
                
                # ✅ FIX: Process payment INSIDE transaction for data consistency
                if new_status == 'approved' and old_status != 'approved':
                    payment_success = self._process_payment(shipping)
                    if not payment_success:
                        # This will rollback the entire transaction if payment fails
                        raise Exception("Payment processing failed - transaction rolled back")
            
            # ✅ Send notifications only after successful transaction
            if new_status == 'approved':
                Notification.objects.create(
                    recipient=shipping.user,
                    title="تمت الموافقة على طلب الشحن",
                    message=f"تمت الموافقة على شحنتك رقم {shipping.id} بقيمة {shipping.amount} {shipping.currency.upper()}",
                    icon="check-circle"
                )
                
            elif new_status == 'rejected':
                reason = request.data.get('admin_notes', 'لم يتم تحديد السبب')
                Notification.objects.create(
                    recipient=shipping.user,
                    title="تم رفض طلب الشحن",
                    message=f"تم رفض شحنتك رقم {shipping.id}. السبب: {reason}",
                    icon="alert-circle"
                )
            
            return Response({
                "message": f"Shipping status updated to {new_status}",
                "shipping": ShippingSerializer(updated_shipping).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error updating shipping status: {str(e)}")
            return Response({
                "error": f"Failed to update shipping status: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _process_payment(self, shipping):
        """Add funds to user's wallet and create transaction - FIXED VERSION"""
        try:
            logger.info(f"💰 Processing payment: {shipping.amount} {shipping.currency} for {shipping.user.name}")
            
            # ✅ FIX: Standardize currency to uppercase to prevent duplicate wallets
            currency = shipping.currency.upper()
            
            # Get or create wallet with standardized currency
            wallet, created = Wallet.objects.get_or_create(
                user=shipping.user,
                currency=currency,
                defaults={
                    'available_balance': 0,
                    'pending_balance': 0
                }
            )
            
            if created:
                logger.info(f"✅ Created new wallet: {currency} for user {shipping.user.name}")
            else:
                logger.info(f"✅ Using existing wallet: {currency} for user {shipping.user.name}")
            
            # ✅ FIX: Use F() expression for atomic update to prevent race conditions
            Wallet.objects.filter(id=wallet.id).update(
                available_balance=F('available_balance') + shipping.amount
            )
            
            # Refresh wallet to get updated balance
            wallet.refresh_from_db()
            logger.info(f"✅ Wallet updated: {shipping.user.name} now has {wallet.available_balance} {wallet.currency}")
            
            # ✅ FIX: Create transaction with correct field names
            transaction_obj = Transaction.objects.create(
                user=shipping.user,
                wallet=wallet,
                amount=shipping.amount,
                transaction_type="deposit",
                status="approved"
            )
            
            # Update shipping with transaction reference
            shipping.transaction_ref = f"TXN_{transaction_obj.id}"
            shipping.processed_at = transaction_obj.created_at
            shipping.save()

            # Send success notification
            Notification.objects.create(
                recipient=shipping.user,
                title="تمت إضافة الأموال إلى محفظتك",
                message=f"تمت إضافة مبلغ {shipping.amount} {currency} إلى محفظتك بنجاح. الرصيد الحالي: {wallet.available_balance} {currency}",
                icon="dollar-sign"
            )
            
            logger.info(f"✅ PAYMENT SUCCESS: Added {shipping.amount} {currency} to {shipping.user.name}'s wallet")
            logger.info(f"✅ Transaction created: {shipping.transaction_ref}")
            return True
            
        except Exception as e:
            logger.error(f"❌ PAYMENT FAILED: Error processing payment for shipping #{shipping.id}: {str(e)}")
            
            # Send failure notification to admin
            try:
                admin_users = shipping.user.__class__.objects.filter(role='admin')
                for admin in admin_users:
                    Notification.objects.create(
                        recipient=admin,
                        title="فشل في معالجة الدفع",
                        message=f"فشل معالجة الدفع للشحنة #{shipping.id}. الرجاء المراجعة يدوياً. الخطأ: {str(e)}",
                        icon="alert-triangle",
                        priority="high"
                    )
            except Exception as notify_error:
                logger.error(f"❌ Failed to send admin notification: {notify_error}")
            
            return False

    # ✅ ADDITIONAL SAFETY CHECKS
    def _validate_shipping_approval(self, shipping):
        """Validate if shipping can be approved"""
        if shipping.status == 'approved':
            return False, "Shipping is already approved"
        
        if shipping.amount <= 0:
            return False, "Shipping amount must be greater than zero"
        
        if not shipping.user.is_active:
            return False, "User account is not active"
        
        return True, "Valid for approval"

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def payment_status(self, request, pk=None):
        """Get detailed payment status for a shipping"""
        try:
            shipping = self.get_object()
            
            payment_data = {
                "shipping_id": shipping.id,
                "status": shipping.status,
                "amount": float(shipping.amount),
                "currency": shipping.currency,
                "transaction_ref": shipping.transaction_ref,
                "processed_at": shipping.processed_at,
                "user": {
                    "id": shipping.user.id,
                    "name": shipping.user.name,
                    "email": shipping.user.email
                }
            }
            
            # Add wallet information if payment was processed
            if shipping.transaction_ref:
                try:
                    transaction_id = shipping.transaction_ref.replace("TXN_", "")
                    transaction = Transaction.objects.get(id=transaction_id)
                    wallet = transaction.wallet
                    
                    payment_data.update({
                        "wallet": {
                            "id": wallet.id,
                            "currency": wallet.currency,
                            "available_balance": float(wallet.available_balance),
                            "pending_balance": float(wallet.pending_balance),
                            "total_balance": float(wallet.total_balance)
                        },
                        "transaction": {
                            "id": transaction.id,
                            "amount": float(transaction.amount),
                            "status": transaction.status,
                            "created_at": transaction.created_at
                        }
                    })
                except ObjectDoesNotExist:
                    payment_data["wallet_info"] = "Transaction not found"
            
            return Response(payment_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting payment status: {str(e)}")
            return Response({
                "error": "Failed to get payment status"
            }, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        """Override list to include payment statistics for admins"""
        try:
            response = super().list(request, *args, **kwargs)
            
            # Add payment statistics for admin users
            if request.user.role == 'admin':
                total_amount = sum(float(shipping.amount) for shipping in Shipping.objects.filter(status='approved'))
                pending_amount = sum(float(shipping.amount) for shipping in Shipping.objects.filter(status='pending'))
                
                response.data['payment_statistics'] = {
                    'total_approved_amount': total_amount,
                    'total_pending_amount': pending_amount,
                    'approved_shippings_count': Shipping.objects.filter(status='approved').count(),
                    'pending_shippings_count': Shipping.objects.filter(status='pending').count()
                }
            
            return response
            
        except Exception as e:
            logger.error(f"Error in shipping list: {str(e)}")
            return super().list(request, *args, **kwargs)
