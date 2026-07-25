# payments/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from rest_framework.decorators import action
from .models import Payment, PaymentConfig
from .serializers import PaymentSerializer, PaymentCreateSerializer, PaymentConfigSerializer
from .services.payment_service import PaymentService
from users.permissions import IsAdminUser
from system.models import Notification
from .services.payment_service_fixed import FixedPaymentService
class PaymentConfigView(APIView):
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Get payment configuration"""
        config = PaymentConfig.get_config()
        serializer = PaymentConfigSerializer(config)
        return Response(serializer.data)
    
    def put(self, request):
        """Update payment configuration"""
        config = PaymentConfig.get_config()
        serializer = PaymentConfigSerializer(config, data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PurchaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        store_product_id = serializer.validated_data['store_product_id']
        user_inputs = serializer.validated_data['user_inputs']
        
        # ✅ USE THE FIXED SERVICE
        result = FixedPaymentService.process_payment(
            store_product_id=store_product_id,
            user=request.user,
            user_inputs=user_inputs
        )
        
        #  إضافة الإشعار بعد الدفع الناجح فقط
        if result['success']:
            Notification.objects.create(
                recipient=request.user,
                title="تمت عملية الدفع بنجاح",
                message=f"لقد تمت عملية الدفع للمنتج رقم {store_product_id} بنجاح.",
                icon="", 
                priority="normal"
            )
            return Response(result, status=status.HTTP_200_OK)
        else:
            Notification.objects.create(
                recipient=request.user,
                title="فشل في عملية الدفع",
                message=f"لم تتم عملية الدفع للمنتج رقم {store_product_id}. يرجى المحاولة لاحقاً.",
                icon="",
            )
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """View payment history"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer
    
    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user).select_related(
            'store_product', 'wallet'
        ).order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get payment status summary"""
        payments = self.get_queryset()
        
        status_summary = {
            'total': payments.count(),
            'success': payments.filter(status='success').count(),
            'pending': payments.filter(status='pending').count(),
            'failed': payments.filter(status='failed').count(),
            'total_spent': sum(p.final_price for p in payments.filter(status='success'))
        }
        
        return Response(status_summary)