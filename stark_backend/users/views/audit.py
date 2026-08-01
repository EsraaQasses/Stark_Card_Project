from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import AuditLog
from ..serializers import AuditLogSerializer
from ..permissions import IsAdminUser

# -------------------- Audit Log ViewSet --------------------
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = AuditLog.objects.all().select_related('user').order_by('-created_at')
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by resource type
        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            queryset = queryset.filter(resource_type=resource_type)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get audit log summary statistics"""
        # Total logs
        total_logs = AuditLog.objects.count()
        
        # Logs by action
        logs_by_action = AuditLog.objects.values('action').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Recent activities
        recent_activities = AuditLog.objects.select_related('user').order_by('-created_at')[:10]
        recent_serializer = self.get_serializer(recent_activities, many=True)
        
        # Daily counts for last 7 days
        seven_days_ago = timezone.now() - timedelta(days=7)
        daily_counts = AuditLog.objects.filter(
            created_at__gte=seven_days_ago
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')
        
        return Response({
            'summary': {
                'total_logs': total_logs,
                'logs_by_action': list(logs_by_action),
                'daily_counts': list(daily_counts),
            },
            'recent_activities': recent_serializer.data
        })