from rest_framework import viewsets, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.core.files.images import get_image_dimensions

from system.models import Notification
from .models import PaymentMethod, PaymentMethodImage
from .media_service import media_transaction, retire_file, save_upload
from .serializers import PaymentMethodSerializer, PaymentMethodCreateSerializer, PaymentMethodFieldSerializer
from users.permissions import IsAdminUser, IsRegularUser
from users.models import User
from system.services.push_notifications import send_push_to_user

class PaymentMethodAdminViewSet(viewsets.ModelViewSet):
    queryset = PaymentMethod.objects.prefetch_related('fields', 'additional_images').order_by('id')
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
        if len(images) > 10:
            return Response({'detail': 'Max 10 images per upload, 20 per payment method.'}, status=400)
        for file in images:
            error = self._check_gallery_image(file)
            if error:
                return Response({'detail': error}, status=400)
        added = []
        with media_transaction() as uploaded:
            method = PaymentMethod.objects.select_for_update().get(pk=method.pk)
            if method.additional_images.count() + len(images) > 20:
                return Response({'detail': 'Max 20 images per payment method.'}, status=400)
            start = (method.additional_images.order_by('-sort_order').values_list('sort_order', flat=True).first() or 0) + 1
            for index, file in enumerate(images):
                entry = PaymentMethodImage(payment_method=method, sort_order=start + index)
                save_upload(entry, 'image', file, uploaded)
                entry.save()
                added.append({'id': entry.id, 'image': request.build_absolute_uri(entry.image.url), 'sort_order': entry.sort_order})
        return Response({'additional_images': added}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete', 'patch'], url_path=r'gallery/(?P<image_id>[0-9]+)')
    def remove_gallery_image(self, request, pk=None, image_id=None):
        method = self.get_object()
        with media_transaction() as uploaded:
            method = PaymentMethod.objects.select_for_update().get(pk=method.pk)
            try:
                entry = method.additional_images.get(pk=image_id)
            except PaymentMethodImage.DoesNotExist:
                return Response({'detail': 'Image not found.'}, status=404)
            if request.method == 'PATCH':
                image = request.FILES.get('image')
                error = self._check_gallery_image(image)
                if error:
                    return Response({'detail': error}, status=400)
                retire_file(entry.image)
                save_upload(entry, 'image', image, uploaded)
                entry.save(update_fields=['image'])
                return Response({'id': entry.id, 'image': request.build_absolute_uri(entry.image.url), 'sort_order': entry.sort_order})
            retire_file(entry.image)
            entry.delete()
            return Response(status=204)

    @action(detail=True, methods=['post'], url_path='gallery-order')
    def reorder_gallery(self, request, pk=None):
        method = self.get_object()
        ids = request.data.get('ids', [])
        if not isinstance(ids, list):
            return Response({'detail': 'Provide all gallery image IDs.'}, status=400)
        try:
            if any(isinstance(v, bool) or not isinstance(v, (int, str)) or not str(v).isdigit() for v in ids):
                raise ValueError
            parsed = [int(v) for v in ids]
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid IDs.'}, status=400)
        with transaction.atomic():
            method = PaymentMethod.objects.select_for_update().get(pk=method.pk)
            if len(set(parsed)) != len(parsed) or set(parsed) != set(method.additional_images.values_list('id', flat=True)):
                return Response({'detail': 'Image IDs do not match this payment method.'}, status=400)
            for order, image_id in enumerate(parsed):
                PaymentMethodImage.objects.filter(id=image_id, payment_method=method).update(sort_order=order)
        return Response({'success': True})

    # ✅ إضافة إشعار بعد إنشاء وسيلة دفع جديدة
    def perform_create(self, serializer):
        instance = serializer.save()
        transaction.on_commit(lambda: self._notify_created(instance), robust=True)

    def _notify_created(self, instance):
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
        with transaction.atomic():
            instance = PaymentMethod.objects.select_for_update().get(pk=instance.pk)
            retire_file(instance.icon_url)
            retire_file(instance.qr_image)
            retire_file(instance.instruction_image)
            for image in instance.additional_images.all():
                retire_file(image.image)
            instance.delete()

class PaymentMethodListView(generics.ListAPIView):
    queryset = PaymentMethod.objects.filter(is_active=True).prefetch_related('fields', 'additional_images').order_by('id')
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
            "qr_image": None,
            "instruction_image": None,
            "currency": None,
            "description": "",
            "additional_images": [],
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
