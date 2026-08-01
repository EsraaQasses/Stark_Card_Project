# users/views/role_management.py - COMPLETE FILE
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
import logging

# Import ValidationError
from django.core.exceptions import ValidationError

from ..models import User
from ..permissions import IsAdminUser
from ..services.role_service import RoleService
from ..serializers import UserSerializer

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def change_user_role(request, user_id):
    """Unified endpoint for role changes"""
    role = request.data.get('role')
    make_superuser = request.data.get('make_superuser', True)
    
    if role not in ['user', 'agent', 'admin']:
        return Response({'error': 'Invalid role. Must be user, agent, or admin'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = get_object_or_404(User, id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Prevent self-modification
    if user.id == request.user.id:
        return Response({'error': 'Cannot change your own role'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    try:
        if role == 'agent':
            changed_user, changed = RoleService.promote_to_agent(user, request.user)
        elif role == 'admin':
            changed_user, changed = RoleService.promote_to_admin(user, request.user, make_superuser)
        else:  # 'user'
            changed_user, changed = RoleService.demote_to_user(user, request.user)
        
        # Get appropriate message
        if changed:
            if role == 'agent':
                message = f'User {user.name} promoted to agent with code {user.agent_code}'
            elif role == 'admin':
                message = f'User {user.name} promoted to admin'
            else:
                message = f'User {user.name} demoted to regular user'
        else:
            message = f'User {user.name} is already {role}'
        
        return Response({
            'success': True,
            'message': message,
            'user': UserSerializer(changed_user).data,
            'role_changed': changed
        })
        
    except ValidationError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Role change error: {str(e)}")
        return Response({'error': 'Failed to change role'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)