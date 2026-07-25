from rest_framework import viewsets, generics

from system.models import Notification
from .models import PaymentMethod
from .serializers import PaymentMethodSerializer, PaymentMethodCreateSerializer, PaymentMethodFieldSerializer
from users.permissions import IsAdminUser, IsRegularUser

class PaymentMethodAdminViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.all()
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentMethodCreateSerializer
        return PaymentMethodSerializer

    # ✅ إضافة إشعار بعد إنشاء وسيلة دفع جديدة
    def perform_create(self, serializer):
        instance = serializer.save()
        Notification.objects.create(
            recipient=self.request.user,
            title="تمت إضافة وسيلة دفع جديدة",
            message=f"تمت إضافة الوسيلة: {instance.name}",
            icon="",
)
        # ✅ إضافة إشعار بعد تعديل وسيلة دفع
    def perform_update(self, serializer):
        instance = serializer.save()
        Notification.objects.create(
            recipient=self.request.user,
            title="تم تعديل وسيلة دفع",
            message=f"تم تعديل الوسيلة: {instance.name}",
            icon="",
        )

    # ✅ إضافة إشعار بعد حذف وسيلة دفع
    def perform_destroy(self, instance):
        Notification.objects.create(
            recipient=self.request.user,
            title="تم حذف وسيلة دفع",
            message=f"تم حذف الوسيلة: {instance.name}",
            icon="trash",
            priority="high"
        )
        instance.delete()

class PaymentMethodListView(generics.ListAPIView):
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsRegularUser]