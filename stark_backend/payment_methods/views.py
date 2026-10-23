from rest_framework import viewsets, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.core.files.images import get_image_dimensions

from system.models import Notification
from .models import PaymentMethod, PaymentMethodImage
from .serializers import PaymentMethodSerializer, PaymentMethodCreateSerializer, PaymentMethodFieldSerializer
from users.permissions import IsAdminUser, IsRegularUser
from users.models import User
from system.services.push_notifications import send_push_to_user

class PaymentMethodAdminViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.all()
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PaymentMethodCreateSerializer
        return PaymentMethodSerializer

    # stark-payment-gallery-v1
    @staticmethod
    def _check_gallery_image(file):
        if not file or getattr(file, 'size', 0) > 5 * 1024 * 1024:
            return 'Each image must be at most 5 MB.'
        if getattr(file, 'content_type', '').lower() not in {'image/png', 'image/jpeg', 'image/webp'}:
            return 'Only PNG, JPEG and WEBP images are allowed.'
        try:
            width, height = get_image_dimensions(file)
            file.seek(0)
            if not width or not height:
                return 'Invalid image.'
        except Exception:
            return 'Invalid image.'
        return None

    @action(detail=True, methods=['post'], url_path='gallery')
    def add_gallery_images(self, request, pk=None):
        method = self.get_object()
        images = request.FILES.getlist('images')
        if not images:
            return Response({'detail': 'Select at least one image.'}, status=400)
        if len(images) > 10 or method.additional_images.count() + len(images) > 20:
            return Response({'detail': 'Max 10 images per upload, 20 per payment method.'}, status=400)
        for file in images:
            error = self._check_gallery_image(file)
            if error:
                return Response({'detail': error}, status=400)
        start = (method.additional_images.order_by('-sort_order').values_list('sort_order', flat=True).first() or 0) + 1
        added = []
        for index, file in enumerate(images):
            entry = PaymentMethodImage.objects.create(payment_method=method, image=file, sort_order=start + index)
            added.append({'id': entry.id, 'image': request.build_absolute_uri(entry.image.url), 'sort_order': entry.sort_order})
        return Response({'additional_images': added}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'gallery/(?P<image_id>[0-9]+)')
    def remove_gallery_image(self, request, pk=None, image_id=None):
        method = self.get_object()
        try:
            entry = method.additional_images.get(pk=image_id)
        except PaymentMethodImage.DoesNotExist:
            return Response({'detail': 'Image not found.'}, status=404)
        entry.delete()
        return Response(status=204)

    @action(detail=True, methods=['post'], url_path='gallery-order')
    def reorder_gallery(self, request, pk=None):
        method = self.get_object()
        ids = request.data.get('ids', [])
        if not isinstance(ids, list) or len(ids) != method.additional_images.count():
            return Response({'detail': 'Provide all gallery image IDs.'}, status=400)
        try:
            parsed = [int(v) for v in ids]
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid IDs.'}, status=400)
        if len(set(parsed)) != len(parsed) or set(parsed) != set(method.additional_images.values_list('id', flat=True)):
            return Response({'detail': 'Image IDs do not match this payment method.'}, status=400)
        with transaction.atomic():
            for order, image_id in enumerate(parsed):
                PaymentMethodImage.objects.filter(id=image_id, payment_method=method).update(sort_order=order)
        return Response({'success': True})

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
        # bulk_create does not emit post_save signals, so dispatch these pushes explicitly.
        for notification in notifications:
            transaction.on_commit(
                lambda notification=notification: send_push_to_user(
                    user_id=notification.recipient_id,
                    title=notification.title,
                    body=notification.message,
                    data={"notification_id": notification.id, "type": notification.type},
                    notification_id=notification.id,
                )
            )
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
