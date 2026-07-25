from rest_framework import viewsets, permissions, generics
from .models import Ad, LastAction, Notification, SystemLog
from .serializers import AdSerializer, LastActionSerializer, NotificationSerializer, SystemLogSerializer
from users.permissions import IsAdminUser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import viewsets, status


#  الإشعارات
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.is_read:
            instance.delete()

#  تحكم بالإعلانات (للأدمن فقط)
class AdViewSet(viewsets.ModelViewSet):
    queryset = Ad.objects.all()
    serializer_class = AdSerializer
    permission_classes = [IsAdminUser]

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response({
            "message": "تمت إضافة إعلان بنجاح ✅",
            "data": response.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return Response({
            "message": "تم تعديل الإعلان بنجاح ✅",
            "data": response.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({
            "message": "تم حذف الإعلان بنجاح ❌"
        }, status=status.HTTP_200_OK)


#  عرض الإعلانات للمستخدمين
class AdListView(generics.ListAPIView):
    queryset = Ad.objects.all().order_by('-created_at')
    serializer_class = AdSerializer
    permission_classes = [IsAuthenticated]


class SystemLogListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]  

    def get(self, request):
        user = request.user
        # تحقق من أن المستخدم أدمن
        if getattr(user, "role", None) != "admin":
            return Response({"detail": "غير مصرح لك."}, status=403)

        # جلب كل اللوج
        logs = SystemLog.objects.all().order_by('-created_at')
        serializer = SystemLogSerializer(logs, many=True)
        return Response(serializer.data)
    

class LastActionListAPIView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        actions = LastAction.objects.all().order_by('-created_at')
        serializer = LastActionSerializer(actions, many=True)
        return Response(serializer.data)