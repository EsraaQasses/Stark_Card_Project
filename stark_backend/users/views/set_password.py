# users/views/set_password.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
import logging

from ..models import User, AdminSecurity
from ..utils.audit_logger import AuditLogger

logger = logging.getLogger(__name__)

class SetAdminSecondPasswordView(generics.GenericAPIView):
    """Set second password for another admin (super admin only)"""
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id, role='admin')
            
            # Check if current user is super admin
            if not request.user.is_superuser:
                return Response({
                    'error': 'Only super admins can set passwords for other admins'
                }, status=status.HTTP_403_FORBIDDEN)
            
            second_password = request.data.get('second_password')
            confirm_password = request.data.get('confirm_password')
            
            if not second_password or not confirm_password:
                return Response({
                    'error': 'Both password fields are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if second_password != confirm_password:
                return Response({
                    'error': 'Passwords do not match'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if len(second_password) < 8:
                return Response({
                    'error': 'Password must be at least 8 characters'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Set second password
            admin_security, created = AdminSecurity.objects.get_or_create(user=target_user)
            admin_security.set_second_password(second_password)
            
            # Audit log
            AuditLogger.log(
                request=request,
                action='SECOND_PASSWORD_SET',
                resource_type='user',
                resource_id=target_user.id,
                details={'set_by_admin': request.user.id}
            )
            
            return Response({
                'success': True,
                'message': f'Second password set for {target_user.name}',
                'user': {
                    'id': target_user.id,
                    'name': target_user.name,
                    'has_second_password': True
                }
            })
            
        except User.DoesNotExist:
            return Response({
                'error': 'Admin user not found'
            }, status=status.HTTP_404_NOT_FOUND)