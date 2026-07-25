from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from system.models import Notification
from .models import UserQRCode
from .serializers import UserQRCodeSerializer, QRCodeGenerateSerializer
from .utils import generate_user_qr_code
from users.models import User
import os
from django.core.files import File

class GenerateUserQRCodeView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = QRCodeGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_id = serializer.validated_data.get('user_id')
        
        # If no user_id provided, use current user
        if user_id:
            user = get_object_or_404(User, id=user_id)
            # Check permission - only admin can generate QR for other users
            if user != request.user and request.user.role != 'admin':
                return Response(
                    {"error": "You don't have permission to generate QR code for other users"},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            user = request.user
        
        # Check if QR code already exists
        qr_code_obj, created = UserQRCode.objects.get_or_create(user=user)
        
        # Generate QR code
        buffer, qr_data = generate_user_qr_code(user)
        
        # Delete old QR code file if exists
        if qr_code_obj.qr_code:
            if os.path.isfile(qr_code_obj.qr_code.path):
                os.remove(qr_code_obj.qr_code.path)
        
        # Save new QR code
        filename = f"qr_code_{user.id}_{user.name}.png"
        qr_code_obj.qr_code.save(filename, File(buffer))
        qr_code_obj.qr_data = qr_data
        qr_code_obj.save()
        
        action = "created" if created else "regenerated"
        
        # ✅ إشعار للمستخدم
        Notification.objects.create(
            recipient=user,
            title="رمز QR",
            message=f"تم { 'إنشاء' if created else 'تجديد' } رمز QR الخاص بك بنجاح.",
            icon="",
        )

        # ✅ إشعار إضافي للأدمن إذا كان هو من أنشأ الكود لمستخدم آخر
        if request.user != user and request.user.role == 'admin':
            Notification.objects.create(
                recipient=request.user,
                title="تم إنشاء رمز QR لمستخدم آخر",
                message=f"تم توليد رمز QR للمستخدم {user.name}.",
                icon="",
            )

            return Response({
            "message": f"QR code {action} successfully",
            "qr_code": UserQRCodeSerializer(qr_code_obj).data
        }, status=status.HTTP_201_CREATED)

class GetUserQRCodeView(generics.RetrieveAPIView):
    serializer_class = UserQRCodeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        user_id = self.kwargs.get('user_id')
        
        if user_id:
            # Admin can get any user's QR code
            if self.request.user.role == 'admin':
                user = get_object_or_404(User, id=user_id)
            else:
                return Response(
                    {"error": "Only admin can view other users' QR codes"},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # User gets their own QR code
            user = self.request.user
        
        qr_code_obj = get_object_or_404(UserQRCode, user=user)
        return qr_code_obj

class GetMyQRCodeView(generics.RetrieveAPIView):
    serializer_class = UserQRCodeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        qr_code_obj, created = UserQRCode.objects.get_or_create(user=self.request.user)
        
        # If newly created or QR code doesn't exist, generate it
        if created or not qr_code_obj.qr_code:
            buffer, qr_data = generate_user_qr_code(self.request.user)
            filename = f"qr_code_{self.request.user.id}_{self.request.user.name}.png"
            qr_code_obj.qr_code.save(filename, File(buffer))
            qr_code_obj.qr_data = qr_data
            qr_code_obj.save()
        
        # ✅ إشعار للمستخدم عند توليد QR تلقائي
            Notification.objects.create(
                recipient=self.request.user,
                title="رمز QR",
                message="تم إنشاء رمز QR الخاص بك تلقائياً.",
                icon="",
            )

        return qr_code_obj