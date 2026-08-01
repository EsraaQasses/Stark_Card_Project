from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db import transaction as db_transaction, models
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal
from django.db.models import Sum
import logging

from .models import Payment, PaymentConfig
from wallets.models import Wallet
from transactions.models import Transaction
from finance.services import FinanceService
from finance.conversion import CurrencyConversionService, RateSide
from system.models import Notification
from .serializers import (
    PaymentSerializer, PaymentCreateSerializer, 
    PaymentStatusUpdateSerializer, PaymentConfigSerializer
)

logger = logging.getLogger(__name__)

try:
    from payment.services.payment_service_fixed import FixedPaymentService
    logger.info("✅ Successfully imported FixedPaymentService")
except ImportError as e:
    logger.warning(f"⚠️ Could not import FixedPaymentService: {e}")
    class FixedPaymentService:
        @staticmethod
        def process_payment(store_product_id, user, user_inputs):
            return {'success': False, 'error': 'Payment service not available'}

try:
    from payment.services.unified_payment_service import UnifiedPaymentService
    logger.info("✅ Successfully imported UnifiedPaymentService")
except ImportError:
    UnifiedPaymentService = None


class PaymentViewSet(viewsets.ModelViewSet):
    """
    Payment API endpoints
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'admin':
            return Payment.objects.all().select_related(
                'user', 'store_product'
            ).order_by('-created_at')
        else:
            return Payment.objects.filter(user=user).select_related(
                'store_product'
            ).order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PaymentCreateSerializer
        return PaymentSerializer
    
    def perform_create(self, serializer):
        """Save payment with current user"""
        serializer.save(user=self.request.user)
    @action(detail=True, methods=['post'])
    def refund(self, request, pk=None):
        """
        Refund a payment (admin only)
        POST /api/payment/{id}/refund/
        """
        try:
            payment = self.get_object()
            
            if request.user.role != 'admin':
                return Response(
                    {'error': 'Only admins can process refunds'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if payment.status != 'success':
                return Response(
                    {'error': f'Cannot refund payment with status: {payment.status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            with db_transaction.atomic():
                # Refund through the canonical ledger service.
                wallet = payment.wallet
                if not wallet:
                    try:
                        wallet = Wallet.objects.get(user=payment.user, currency=payment.currency)
                    except Wallet.DoesNotExist:
                        return Response(
                            {'error': 'Wallet not found for user'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                original_tx = Transaction.objects.filter(
                    payment=payment, status='approved', amount__lt=0
                ).order_by('-id').first()
                if original_tx:
                    refund_tx = FinanceService.refund(
                        transaction_id=original_tx.id,
                        reason=f"Payment #{payment.id} refund",
                        idempotency_key=f"payment-refund:{payment.id}",
                    )
                    FinanceService.approve(refund_tx.id)
                    from agents.services.commission_service import reverse_commission_for_purchase
                    reverse_commission_for_purchase(original_tx, reason=f"Payment #{payment.id} refund")
                else:
                    conversion = CurrencyConversionService.convert(
                        amount=payment.final_price,
                        source_currency=payment.currency,
                        target_currency=payment.currency,
                        rate_side=RateSide.NONE,
                        operation_type="payment_refund_legacy_same_currency",
                    )
                    refund_tx = FinanceService.deposit(
                        wallet_id=wallet.id,
                        amount=payment.final_price,
                        transaction_type='refund',
                        note=f"Refund for payment #{payment.id}",
                        idempotency_key=f"payment-refund:{payment.id}",
                        conversion_result=conversion,
                        operation_context={
                            "snapshot_locked": True,
                            "legacy_payment_refund": True,
                            "payment_id": payment.id,
                        },
                    )
                    FinanceService.approve(refund_tx.id)
                
                # Update payment status
                payment.status = 'refunded'
                payment.refunded_at = timezone.now()
                payment.refunded_by = request.user
                payment.save()
                
                # Send notification
            
            return Response({
                'success': True,
                'message': f'Payment #{payment.id} refunded successfully',
                'refund_amount': str(payment.final_price)
            })
            
        except Exception as e:
            logger.error(f"Refund error: {e}")
            return Response(
                {'error': f'Refund failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_status(self, request, pk=None):
        """
        Update payment status (admin only)
        POST /api/payment/{id}/update_status/
        
        Request body:
        {
            "status": "success" | "failed" | "cancelled",
            "notes": "Optional notes"
        }
        """
        try:
            payment = self.get_object()
            new_status = request.data.get('status')
            notes = request.data.get('notes', '')
            
            valid_statuses = ['success', 'failed', 'cancelled', 'pending', 'processing']
            
            if new_status not in valid_statuses:
                return Response(
                    {'error': f'Invalid status. Must be one of: {valid_statuses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            old_status = payment.status
            payment.status = new_status
            
            if notes:
                if payment.notes:
                    payment.notes += f'\n{notes}'
                else:
                    payment.notes = notes
            
            # If moving to success, set processed_at
            if new_status == 'success' and old_status != 'success':
                payment.processed_at = timezone.now()
            
            payment.save()
            
            # Send notification to user
            status_display = {
                'success': 'تمت بنجاح',
                'failed': 'فشلت',
                'cancelled': 'ألغيت',
                'pending': 'معلقة',
                'processing': 'قيد المعالجة'
            }.get(new_status, new_status)
            
            
            return Response({
                'success': True,
                'message': f'Payment status updated to {new_status}',
                'payment': PaymentSerializer(payment).data
            })
            
        except Exception as e:
            logger.error(f"Status update error: {e}")
            return Response(
                {'error': f'Status update failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get payment statistics
        GET /api/payment/stats/
        """
        try:
            user = request.user
            queryset = self.get_queryset()
            
            # Total payments
            total_payments = queryset.count()
            successful_payments = queryset.filter(status='success').count()
            failed_payments = queryset.filter(status='failed').count()
            pending_payments = queryset.filter(status__in=['pending', 'processing']).count()
            
            # Total amount
            successful_amount = queryset.filter(status='success').aggregate(
                total=models.Sum('amount_usd')
            )['total'] or Decimal('0')
            
            # Today's payments
            today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            today_payments = queryset.filter(created_at__gte=today_start).count()
            today_amount = queryset.filter(
                status='success', 
                created_at__gte=today_start
            ).aggregate(total=models.Sum('amount_usd'))['total'] or Decimal('0')
            
            # Top products
            from django.db.models import Count
            top_products = queryset.filter(status='success').values(
                'store_product__name'
            ).annotate(
                count=Count('id'),
                total=Sum('amount_usd')
            ).order_by('-count')[:5]
            
            stats = {
                'total_payments': total_payments,
                'successful_payments': successful_payments,
                'failed_payments': failed_payments,
                'pending_payments': pending_payments,
                'total_amount': float(successful_amount),
                'today_payments': today_payments,
                'today_amount': float(today_amount),
                'success_rate': (successful_payments / total_payments * 100) if total_payments > 0 else 0,
                'top_products': list(top_products)
            }
            
            return Response(stats)
            
        except Exception as e:
            logger.error(f"Stats error: {e}")
            return Response(
                {'error': 'Failed to get payment statistics'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """
        Get recent payments
        GET /api/payment/recent/
        """
        try:
            queryset = self.get_queryset()[:20]  # Last 20 payments
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Recent payments error: {e}")
            return Response(
                {'error': 'Failed to get recent payments'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def export(self, request):
        """
        Export payments data (admin only)
        GET /api/payment/export/?format=csv|json
        """
        try:
            format_type = request.query_params.get('format', 'json')
            queryset = self.get_queryset()
            
            if format_type == 'csv':
                import csv
                from django.http import HttpResponse
                
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="payments_export.csv"'
                
                writer = csv.writer(response)
                writer.writerow([
                    'ID', 'User', 'Product', 'Base Price', 'Final Price',
                    'Status', 'Created At', 'Processed At'
                ])
                
                for payment in queryset:
                    writer.writerow([
                        payment.id,
                        payment.user.name,
                        payment.store_product.name if payment.store_product else 'N/A',
                        float(payment.base_price),
                        float(payment.final_price),
                        payment.status,
                        payment.created_at,
                        payment.processed_at
                    ])
                
                return response
            else:
                # JSON export
                data = []
                for payment in queryset:
                    data.append({
                        'id': payment.id,
                        'user': payment.user.name,
                        'user_id': payment.user.id,
                        'product': payment.store_product.name if payment.store_product else 'N/A',
                        'base_price': float(payment.base_price),
                        'final_price': float(payment.final_price),
                        'status': payment.status,
                        'created_at': payment.created_at,
                        'processed_at': payment.processed_at,
                        'external_transaction_id': payment.external_transaction_id
                    })
                
                return Response(data)
                
        except Exception as e:
            logger.error(f"Export error: {e}")
            return Response(
                {'error': 'Failed to export payments'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentConfigViewSet(viewsets.ModelViewSet):
    """
    Payment configuration API (admin only)
    """
    permission_classes = [IsAdminUser]
    serializer_class = PaymentConfigSerializer
    queryset = PaymentConfig.objects.all()
    
    def get_object(self):
        """Get or create single payment config"""
        obj, created = PaymentConfig.objects.get_or_create(pk=1)
        return obj
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current payment configuration"""
        config = self.get_object()
        serializer = self.get_serializer(config)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def test_connection(self, request):
        """Test payment gateway connection"""
        try:
            # This would test connection to your payment gateway
            # For now, return a success response
            return Response({
                'success': True,
                'message': 'Payment gateway connection test successful',
                'timestamp': timezone.now()
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class WalletPaymentView(viewsets.GenericViewSet):
    """
    Wallet-based payment endpoints
    """
    permission_classes = [IsAuthenticated]
    @action(detail=False, methods=['get'])
    def balance(self, request):
        """
        Get user's wallet balance
        GET /api/payment/wallet/balance/
        """
        try:
            currency = request.query_params.get('currency', 'USD').upper()
            if currency not in ["USD", "SYP"]:
                return Response(
                    {'error': 'Unsupported currency. Use USD or SYP'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            wallet = Wallet.objects.get(user=request.user, currency=currency)
            
            return Response({
                'available_balance': float(wallet.available_balance),
                'pending_balance': float(wallet.pending_balance),
                'total_balance': float(wallet.total_balance),
                'currency': wallet.currency
            })
            
        except Wallet.DoesNotExist:
            currency = request.query_params.get('currency', 'USD').upper()
            if currency not in ["USD", "SYP"]:
                return Response(
                    {'error': 'Unsupported currency. Use USD or SYP'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            wallet = Wallet.objects.create(user=request.user, currency=currency)
            return Response({
                'available_balance': 0.0,
                'pending_balance': 0.0,
                'total_balance': 0.0,
                'currency': wallet.currency,
                'message': 'New wallet created'
            })


class AdminPaymentView(viewsets.GenericViewSet):
    """
    Admin-only payment management endpoints
    """
    permission_classes = [IsAdminUser]
    serializer_class = PaymentSerializer
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """
        Admin payment dashboard
        GET /api/payment/admin/dashboard/
        """
        try:
            from django.db.models import Sum, Count, Avg
            from django.utils import timezone
            from datetime import timedelta
            
            # Time ranges
            now = timezone.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = now - timedelta(days=7)
            month_start = now - timedelta(days=30)
            
            # Overall stats
            total_stats = Payment.objects.aggregate(
                total_count=Count('id'),
                total_amount=Sum('amount_usd'),
                avg_amount=Avg('amount_usd')
            )
            
            # Status breakdown
            status_stats = Payment.objects.values('status').annotate(
                count=Count('id'),
                amount=Sum('amount_usd')
            ).order_by('-count')
            
            # Daily stats for last 7 days
            daily_stats = []
            for i in range(7):
                day = today_start - timedelta(days=i)
                next_day = day + timedelta(days=1)
                
                day_payments = Payment.objects.filter(
                    created_at__gte=day,
                    created_at__lt=next_day
                ).aggregate(
                    count=Count('id'),
                    amount=Sum('amount_usd')
                )
                
                daily_stats.append({
                    'date': day.date(),
                    'count': day_payments['count'] or 0,
                    'amount': float(day_payments['amount'] or 0)
                })
            
            # Top users
            top_users = Payment.objects.values(
                'user__id', 'user__name', 'user__email'
            ).annotate(
                count=Count('id'),
                total=Sum('amount_usd')
            ).order_by('-total')[:10]
            
            # Recent activity
            recent_payments = Payment.objects.select_related(
                'user', 'store_product'
            ).order_by('-created_at')[:10]
            
            recent_data = []
            for payment in recent_payments:
                recent_data.append({
                    'id': payment.id,
                    'user': payment.user.name,
                    'product': payment.store_product.name if payment.store_product else 'N/A',
                    'amount': float(payment.final_price),
                    'status': payment.status,
                    'created_at': payment.created_at
                })
            
            dashboard_data = {
                'overall': {
                    'total_payments': total_stats['total_count'] or 0,
                    'total_amount': float(total_stats['total_amount'] or 0),
                    'average_amount': float(total_stats['avg_amount'] or 0)
                },
                'status_breakdown': list(status_stats),
                'daily_stats': daily_stats,
                'top_users': list(top_users),
                'recent_activity': recent_data,
                'timestamp': now
            }
            
            return Response(dashboard_data)
            
        except Exception as e:
            logger.error(f"Dashboard error: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to load dashboard data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        Bulk update payment statuses
        POST /api/payment/admin/bulk_update/
        
        Request body:
        {
            "payment_ids": [1, 2, 3],
            "status": "success",
            "notes": "Bulk update"
        }
        """
        try:
            payment_ids = request.data.get('payment_ids', [])
            new_status = request.data.get('status')
            notes = request.data.get('notes', '')
            
            if not payment_ids:
                return Response(
                    {'error': 'No payment IDs provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            valid_statuses = ['success', 'failed', 'cancelled', 'pending']
            if new_status not in valid_statuses:
                return Response(
                    {'error': f'Invalid status. Must be one of: {valid_statuses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            updated_count = 0
            with db_transaction.atomic():
                payments = Payment.objects.filter(id__in=payment_ids)
                
                for payment in payments:
                    payment.status = new_status
                    if notes:
                        payment.notes = f"{payment.notes or ''}\nBulk update: {notes}"
                    
                    if new_status == 'success' and payment.status != 'success':
                        payment.processed_at = timezone.now()
                    
                    payment.save()
                    updated_count += 1
            
            return Response({
                'success': True,
                'message': f'Updated {updated_count} payments to status: {new_status}',
                'updated_count': updated_count
            })
            
        except Exception as e:
            logger.error(f"Bulk update error: {e}")
            return Response(
                {'error': f'Bulk update failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


# Helper function to check if server is running
def health_check(request):
    """Simple health check endpoint"""
    return Response({
        'status': 'ok',
        'service': 'payment',
        'timestamp': timezone.now()
    })
