# requests/views.py
from rest_framework import viewsets, generics, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import Request, RequestComment
from .serializers import (
    RequestSerializer, CreatePaymentRequestSerializer, 
    RequestStatusUpdateSerializer, RequestCommentSerializer
)
from users.permissions import IsAdminUser, IsRegularUser

class RequestViewSet(viewsets.ModelViewSet):
    serializer_class = RequestSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'request_type']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Request.objects.all()
        return Request.objects.filter(user=user)
    
    def get_serializer_class(self):
        if self.action == 'create' and self.request.data.get('request_type') == 'payment':
            return CreatePaymentRequestSerializer
        elif self.action in ['update_status', 'partial_update']:
            return RequestStatusUpdateSerializer
        return RequestSerializer
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_status(self, request, pk=None):
        request_obj = self.get_object()
        serializer = RequestStatusUpdateSerializer(request_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            "message": f"Request status updated to {serializer.validated_data.get('status')}",
            "request": RequestSerializer(request_obj).data
        })
    
    @action(detail=True, methods=['post'], permission_classes=[IsRegularUser | IsAdminUser])
    def add_comment(self, request, pk=None):
        request_obj = self.get_object()
        serializer = RequestCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(request=request_obj, user=request.user)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class AdminRequestViewSet(viewsets.ModelViewSet):
    queryset = Request.objects.all()
    serializer_class = RequestSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'request_type', 'user']
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        stats = {
            'total': Request.objects.count(),
            'pending': Request.objects.filter(status='pending').count(),
            'shipping': Request.objects.filter(status='shipping').count(),
            'in_progress': Request.objects.filter(status='in_progress').count(),
            'objection': Request.objects.filter(status='objection').count(),
            'completed': Request.objects.filter(status='completed').count(),
            'rejected': Request.objects.filter(status='rejected').count(),
        }
        return Response(stats)