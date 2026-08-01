import json
from django.utils import timezone
from django.core.cache import cache
from ..models import AuditLog
import logging

logger = logging.getLogger(__name__)

class AuditLogger:
    @staticmethod
    def log(request, action, resource_type, resource_id=None, details=None):
        """Create audit log entry"""
        try:
            user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
            ip = AuditLogger._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
            
            AuditLog.objects.create(
                user=user,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details or {},
                ip_address=ip,
                user_agent=user_agent
            )
            
            # Invalidate cache for user's audit logs if needed
            if user:
                cache_key = f"user_audit_logs_{user.id}"
                cache.delete(cache_key)
                
        except Exception as e:
            logger.error(f"Failed to create audit log: {str(e)}")
    
    @staticmethod
    def _get_client_ip(request):
        """Get client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip