# users/views/admin.py - UPDATED WITH PROPER IMPORTS
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import logging

# Import ValidationError
from django.core.exceptions import ValidationError

from ..models import User, AdminSecurity, AuditLog
from ..serializers import UserSerializer, AdminUserDeleteSerializer
from ..permissions import IsAdminUser
from ..utils.audit_logger import AuditLogger
from ..models import AuditLog

# Import RoleService
from ..services.role_service import RoleService

logger = logging.getLogger(__name__)

# -------------------- Ban User --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def ban_user(request, user_id):
    user = get_object_or_404(User, id=user_id)

    if user == request.user:
        return Response({'error': "You can't ban yourself."}, status=status.HTTP_400_BAD_REQUEST)

    if user.is_banned:
        return Response({'status': f'{user.name} is already banned.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_banned = True
    user.save()
    
    # Audit log for ban action
    AuditLogger.log(
        request=request,
        action='USER_BAN',
        resource_type='user',
        resource_id=user_id,
        details={
            'banned_by': request.user.id,
            'banned_user_name': user.name,
            'reason': request.data.get('reason', 'No reason provided')
        }
    )
    
    return Response({'status': f'{user.name} has been banned.'}, status=status.HTTP_200_OK)


# -------------------- Unban User --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def unban_user(request, user_id):
    user = get_object_or_404(User, id=user_id)

    if not user.is_banned:
        return Response({'status': f'{user.name} is not banned.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_banned = False
    user.save()
    
    # Audit log for unban action
    AuditLogger.log(
        request=request,
        action='USER_UNBAN',
        resource_type='user',
        resource_id=user_id,
        details={
            'unbanned_by': request.user.id,
            'unbanned_user_name': user.name
        }
    )
    
    return Response({'status': f'{user.name} has been unbanned.'}, status=status.HTTP_200_OK)


# -------------------- Make User Agent --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def make_user_agent(request, user_id):
    """Make a regular user an agent"""
    try:
        user = get_object_or_404(User, id=user_id)
        
        promoted_user, changed = RoleService.promote_to_agent(user, request.user)
        
        if not changed:
            return Response({
                'message': f'{user.name} is already an agent.',
                'agent_code': user.agent_code
            }, status=status.HTTP_200_OK)
        
        return Response({
            'message': f'{user.name} has been promoted to agent.',
            'agent_code': user.agent_code,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
        
    except ValidationError as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error making user agent: {str(e)}")
        return Response({
            'error': 'Failed to make user agent'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- Make User Admin --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def make_user_admin(request, user_id):
    """Make a regular user or agent an admin"""
    try:
        user = get_object_or_404(User, id=user_id)
        
        make_superuser = request.data.get('make_superuser', True)
        promoted_user, changed = RoleService.promote_to_admin(user, request.user, make_superuser)
        
        # Get admin security status
        admin_security, created = AdminSecurity.objects.get_or_create(user=user)
        generated_second_password = None
        if not admin_security.is_second_password_set:
            import secrets
            import string
            charset = string.ascii_letters + string.digits
            generated_second_password = ''.join(secrets.choice(charset) for _ in range(12))
            admin_security.set_second_password(generated_second_password)
        
        response_data = {
            'success': True,
            'message': f'{user.name} has been promoted to admin.' if changed else f'{user.name} is already an admin.',
            'user': UserSerializer(user).data,
            'requires_second_password_setup': False,
            'already_admin': not changed,
            'role_changed': changed
        }
        if generated_second_password:
            response_data['generated_second_password'] = generated_second_password
        
        if changed:
            response_data['original_role'] = promoted_user.role
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except ValidationError as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error making user admin: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to make user admin'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# -------------------- List Admin Users --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_admin_users(request):
    """Get all admin users"""
    try:
        admin_users = User.objects.filter(role='admin').order_by('-date_joined')
        
        admin_data = []
        for user in admin_users:
            admin_security = getattr(user, 'admin_security', None)
            admin_data.append({
                'id': user.id,
                'name': user.name,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'is_active': user.is_active,
                'is_superuser': user.is_superuser,
                'date_joined': user.date_joined,
                'last_login': user.last_login,
                'has_second_password': admin_security.is_second_password_set if admin_security else False,
                'second_password_set_at': admin_security.updated_at if admin_security and admin_security.is_second_password_set else None,
                'category': user.customer_category_display if user.category else 'Default'
            })
        
        return Response(admin_data)
        
    except Exception as e:
        logger.error(f"Error fetching admin users: {str(e)}")
        return Response({
            'error': 'Failed to fetch admin users'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- Admin User Details --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_user_detail(request, user_id):
    """Get detailed information about an admin user"""
    try:
        user = get_object_or_404(User, id=user_id, role='admin')
        admin_security = getattr(user, 'admin_security', None)
        
        user_data = {
            'id': user.id,
            'name': user.name,
            'full_name': user.full_name,
            'email': user.email,
            'phone': user.phone,
            'is_active': user.is_active,
            'is_superuser': user.is_superuser,
            'is_staff': user.is_staff,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
            'category': {
                'id': user.category.id if user.category else None,
                'name': user.category.name if user.category else None,
                'display_name': user.category.display_name if user.category else 'Default',
                'profit_percentage': float(user.category.profit_percentage) if user.category else 0.0,
                'assigned_at': user.category_assigned_at,
                'assigned_by': user.category_assigned_by.name if user.category_assigned_by else None,
                'notes': user.category_notes
            },
            'security': {
                'has_second_password': admin_security.is_second_password_set if admin_security else False,
                'second_password_set_at': admin_security.updated_at if admin_security else None,
                'security_created_at': admin_security.created_at if admin_security else None,
            },
            'permissions': {
                'groups': list(user.groups.values_list('name', flat=True)),
                'user_permissions': list(user.user_permissions.values_list('codename', flat=True))
            }
        }
        
        return Response(user_data)
        
    except Exception as e:
        logger.error(f"Error fetching admin user details: {str(e)}")
        return Response({
            'error': 'Failed to fetch admin user details'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- Remove Admin Role --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def remove_admin_role(request, user_id):
    """Remove admin role from user (demote to regular user)"""
    try:
        # Prevent self-demotion
        if request.user.id == int(user_id):
            return Response({
                'error': 'You cannot remove your own admin role'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = get_object_or_404(User, id=user_id)
        
        if user.role != "admin":
            return Response({
                'message': f'{user.name} is not an admin.',
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Store original role
        original_role = user.role
        
        # Change to regular user
        user.role = "user"
        user.is_staff = False
        user.is_superuser = False
        user.save()
        
        # Audit log for role removal
        AuditLogger.log(
            request=request,
            action='ROLE_CHANGE',
            resource_type='user',
            resource_id=user_id,
            details={
                'from_role': 'admin',
                'to_role': 'user',
                'changed_by': request.user.id,
                'is_staff': False,
                'is_superuser': False
            }
        )
        
        return Response({
            'message': f'{user.name} has been demoted to regular user.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error removing admin role: {str(e)}")
        return Response({
            'error': 'Failed to remove admin role'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- Promote to Sub-Admin --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def promote_to_sub_admin(request, user_id):
    user = get_object_or_404(User, id=user_id)

    if user.role == "admin":
        return Response({'message': f'{user.name} is already an admin.'}, status=status.HTTP_400_BAD_REQUEST)

    original_role = user.role
    user.role = "admin"
    user.save()

    # Audit log for promotion
    AuditLogger.log(
        request=request,
        action='ROLE_CHANGE',
        resource_type='user',
        resource_id=user_id,
        details={
            'from_role': original_role,
            'to_role': 'admin',
            'changed_by': request.user.id,
            'promotion_type': 'sub_admin'
        }
    )

    return Response({
        'message': f'{user.name} has been promoted to sub-admin.',
    }, status=status.HTTP_200_OK)


# -------------------- Delete User (Admin Only) --------------------
@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def delete_user(request, user_id):
    """Delete any user by admin only (all roles)."""
    try:
        serializer = AdminUserDeleteSerializer(data={"user_id": user_id})
        serializer.is_valid(raise_exception=True)

        if request.user.id == int(user_id):
            return Response(
                {'error': 'You cannot delete your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = get_object_or_404(User, id=user_id)
        user_name = user.name
        user_role = user.role
        user.delete()

        return Response({
            'success': True,
            'message': f'User {user_name} ({user_role}) deleted successfully'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to delete user'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- List Banned Users --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def list_users(request):
    """List banned users only"""
    try:
        banned_users = User.objects.filter(is_banned=True)
        serializer = UserSerializer(banned_users, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error listing banned users: {str(e)}")
        return Response({"error": "Failed to load banned users"}, status=500)


# -------------------- User Statistics --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_stats(request):
    """Get user statistics for dashboard"""
    try:
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        banned_users = User.objects.filter(is_banned=True).count()
        admin_users = User.objects.filter(role='admin').count()
        agent_users = User.objects.filter(role='agent').count()
        regular_users = User.objects.filter(role='user').count()
        
        # Category statistics
        categorized_users = User.objects.filter(category__isnull=False).count()
        uncategorized_users = User.objects.filter(category__isnull=True).count()
        
        from django.utils import timezone
        from datetime import timedelta
        week_ago = timezone.now() - timedelta(days=7)
        new_users_week = User.objects.filter(date_joined__gte=week_ago).count()
        
        return Response({
            'total_users': total_users,
            'active_users': active_users,
            'banned_users': banned_users,
            'admin_users': admin_users,
            'agent_users': agent_users,
            'regular_users': regular_users,
            'new_users_week': new_users_week,
            'categorized_users': categorized_users,
            'uncategorized_users': uncategorized_users,
            'categorization_rate': (categorized_users / total_users * 100) if total_users > 0 else 0
        })
    except Exception as e:
        logger.error(f"Error fetching user stats: {str(e)}")
        return Response({
            'error': 'Failed to fetch statistics'
        }, status=500)
