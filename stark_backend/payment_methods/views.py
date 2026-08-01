from rest_framework import viewsets, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from system.models import Notification
from .models import PaymentMethod
from .serializers import PaymentMethodSerializer, PaymentMethodCreateSerializer, PaymentMethodFieldSerializer
from users.permissions import IsAdminUser, IsRegularUser
from users.models import User

class PaymentMethodAdminViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.all()
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentMethodCreateSerializer
        return PaymentMethodSerializer

    # ✅ إضافة إشعار بعد إنشاء وسيلة دفع جديدة
    def perform_create(self, serializer):
        instance = serializer.save()
        # Notify all regular users about the new payment method
        users = User.objects.filter(is_active=True)
        notifications = [
            Notification(
                recipient=u,
                title="New payment method",
                message=f"We have a new payment method: {instance.name}",
                icon=""
            )
            for u in users
        ]
        Notification.objects.bulk_create(notifications, ignore_conflicts=True)
        # ✅ إضافة إشعار بعد تعديل وسيلة دفع
    def perform_update(self, serializer):
        serializer.save()

    # ✅ إضافة إشعار بعد حذف وسيلة دفع
    def perform_destroy(self, instance):
        instance.delete()

class PaymentMethodListView(generics.ListAPIView):
    queryset = PaymentMethod.objects.filter(is_active=True)
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsRegularUser]

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Add static "Ship via Agent" method from backend (regular users only)
        static_method = {
            "id": "agent-shipping",
            "title": "شحن عبر الوكيل",
            "name": "agent_shipping",
            "icon_url": None,
            "account_details": "",
            "instructions": "تواصل مع وكيلك لإتمام الشحن.",
            "note": "بدون إيصال. الوكيل يؤكد الطلب ويعالج الشحن.",
            "requires_receipt": False,
            "is_active": True,
            "fields": [],
            "is_agent_shipping": True,
        }

        should_add_agent_shipping = request.user.role != "agent"

        data = response.data
        if should_add_agent_shipping:
            if isinstance(data, dict) and "results" in data:
                data["results"] = [static_method] + list(data["results"] or [])
            elif isinstance(data, list):
                data = [static_method] + data
                response.data = data
        return response
