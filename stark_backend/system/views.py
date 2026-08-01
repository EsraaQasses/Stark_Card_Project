from rest_framework import viewsets, permissions, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from .models import Ad, LastAction, Notification, SystemLog
from .serializers import AdSerializer, LastActionSerializer, NotificationSerializer, SystemLogSerializer
from users.permissions import IsAdminUser
from system.models import log_admin_action

# الإشعارات
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread": count})


# تحكم بالإعلانات (للأدمن فقط)
class AdViewSet(viewsets.ModelViewSet):
    serializer_class = AdSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        # Return active ads by default, admin can see all
        if getattr(self.request.user, 'role', None) == 'admin':
            return Ad.objects.all().order_by('-created_at')
        return Ad.objects.filter(is_active=True).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        log_admin_action(
            admin=request.user,
            action_type='create_ad',
            description=f'Created ad: {request.data.get("title", "New Ad")}'
        )
        return Response({
            "message": "تمت إضافة إعلان بنجاح ✅",
            "data": response.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        log_admin_action(
            admin=request.user,
            action_type='update_ad',
            description=f'Updated ad ID: {kwargs.get("pk")}'
        )
        return Response({
            "message": "تم تعديل الإعلان بنجاح ✅",
            "data": response.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        ad_title = instance.title
        self.perform_destroy(instance)
        log_admin_action(
            admin=request.user,
            action_type='delete_ad',
            description=f'Deleted ad: {ad_title}'
        )
        return Response({
            "message": "تم حذف الإعلان بنجاح ❌"
        }, status=status.HTTP_200_OK)


# عرض الإعلانات للمستخدمين (فقط الإعلانات النشطة)
class AdListView(generics.ListAPIView):
    serializer_class = AdSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Ad.objects.filter(is_active=True).order_by('-created_at')


class SystemLogListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        user = request.user
        if getattr(user, "role", None) != "admin":
            return Response({"detail": "غير مصرح لك."}, status=403)

        logs = SystemLog.objects.all().order_by('-created_at')
        serializer = SystemLogSerializer(logs, many=True)
        return Response(serializer.data)


class LastActionListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        actions = LastAction.objects.all().order_by('-created_at')
        serializer = LastActionSerializer(actions, many=True)
        return Response(serializer.data)
