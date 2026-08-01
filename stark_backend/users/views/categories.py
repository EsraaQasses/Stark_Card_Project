from django.db import transaction
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import logging

from ..models import CustomerCategory, User
from ..serializers import (
    CustomerCategorySerializer, CustomerCategoryCreateSerializer,
    AssignUserCategorySerializer, BulkAssignCategorySerializer,
    UserSerializer
)
from ..permissions import IsAdminUser
from ..utils.audit_logger import AuditLogger

logger = logging.getLogger(__name__)

# -------------------- Category Management Views --------------------

class CustomerCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        return CustomerCategory.objects.all().prefetch_related('users')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CustomerCategoryCreateSerializer
        return CustomerCategorySerializer

    @action(detail=False, methods=['get'])
    def active_categories(self, request):
        """Get active categories for dropdowns"""
        categories = CustomerCategory.objects.filter(is_active=True).order_by('name')
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def category_users(self, request, pk=None):
        """Get users in a specific category"""
        category = self.get_object()
        users = category.users.all()
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        category = serializer.save()
        
        # Audit log for category creation
        AuditLogger.log(
            request=self.request,
            action='USER_UPDATE',
            resource_type='category',
            resource_id=category.id,
            details={
                'action': 'category_created',
                'category_name': category.display_name,
                'profit_percentage': float(category.profit_percentage)
            }
        )

    def perform_update(self, serializer):
        old_category = self.get_object()
        category = serializer.save()
        
        # Audit log for category update
        AuditLogger.log(
            request=self.request,
            action='USER_UPDATE',
            resource_type='category',
            resource_id=category.id,
            details={
                'action': 'category_updated',
                'old_name': old_category.display_name,
                'new_name': category.display_name,
                'old_profit': float(old_category.profit_percentage),
                'new_profit': float(category.profit_percentage)
            }
        )

    def perform_destroy(self, instance):
        category_id = instance.id
        category_name = instance.display_name
        
        # Audit log before deletion
        AuditLogger.log(
            request=self.request,
            action='USER_UPDATE',
            resource_type='category',
            resource_id=category_id,
            details={
                'action': 'category_deleted',
                'category_name': category_name,
                'profit_percentage': float(instance.profit_percentage)
            }
        )
        
        super().perform_destroy(instance)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def assign_user_category(request):
    """Assign category to a user"""
    serializer = AssignUserCategorySerializer(data=request.data)
    
    if not serializer.is_valid():
        payload = {
            "success": False,
            "error": "Validation failed",
            "error_code": "VALIDATION_ERROR",
            "errors": serializer.errors,
        }
        if isinstance(serializer.errors, dict):
            payload.update(serializer.errors)
        return Response(payload, status=status.HTTP_400_BAD_REQUEST)
    
    user_id = serializer.validated_data['user_id']
    category_id = serializer.validated_data.get('category_id')
    notes = serializer.validated_data.get('notes', '')
    
    try:
        with transaction.atomic():
            user = User.objects.get(id=user_id)
            
            if category_id is None:
                # Remove category assignment - user will use default category
                user.remove_category()
                message = "Category removed from user. User will use default category."
                
                # Audit log
                AuditLogger.log(
                    request=request,
                    action='CATEGORY_ASSIGN',
                    resource_type='user',
                    resource_id=user_id,
                    details={
                        'action': 'remove',
                        'category_id': None,
                        'notes': notes,
                        'effective_profit_percentage': float(user.effective_profit_percentage)
                    }
                )
            else:
                category = CustomerCategory.objects.get(id=category_id)
                
                # Assign category to user
                user.assign_category(category, request.user, notes)
                message = "Category assigned to user"
                
                # Audit log
                AuditLogger.log(
                    request=request,
                    action='CATEGORY_ASSIGN',
                    resource_type='user',
                    resource_id=user_id,
                    details={
                        'action': 'assign',
                        'category_id': category_id,
                        'category_name': category.display_name,
                        'profit_percentage': float(category.profit_percentage),
                        'notes': notes
                    }
                )
            
            # Reload user from DB to ensure we return persisted values
            fresh_user = User.objects.get(id=user.id)
            user_serializer = UserSerializer(fresh_user, context={'request': request})
            return Response({
                'success': True,
                'message': message,
                'user_id': user_id,
                'category_id': category_id,
                'effective_profit_percentage': float(fresh_user.effective_profit_percentage),
                'user': user_serializer.data
            })
            
    except User.DoesNotExist:
        return Response({
            'error': 'User not found',
            'error_code': 'USER_NOT_FOUND'
        }, status=status.HTTP_404_NOT_FOUND)
    except CustomerCategory.DoesNotExist:
        return Response({
            'error': 'Category not found',
            'error_code': 'CATEGORY_NOT_FOUND'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error assigning category: {str(e)}")
        return Response({
            'error': 'Failed to assign category',
            'error_code': 'CATEGORY_ASSIGN_FAILED',
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def bulk_assign_category(request):
    """Bulk assign category to multiple users"""
    serializer = BulkAssignCategorySerializer(data=request.data)
    
    if not serializer.is_valid():
        payload = {
            "success": False,
            "error": "Validation failed",
            "error_code": "VALIDATION_ERROR",
            "errors": serializer.errors,
        }
        if isinstance(serializer.errors, dict):
            payload.update(serializer.errors)
        return Response(payload, status=status.HTTP_400_BAD_REQUEST)
    
    user_ids = serializer.validated_data['user_ids']
    category_id = serializer.validated_data.get('category_id')
    notes = serializer.validated_data.get('notes', '')
    
    try:
        with transaction.atomic():
            # Validate all users exist before processing
            existing_users = User.objects.filter(id__in=user_ids)
            existing_user_ids = set(existing_users.values_list('id', flat=True))
            requested_user_ids = set(user_ids)
            
            if requested_user_ids != existing_user_ids:
                missing_ids = requested_user_ids - existing_user_ids
                return Response({
                    'error': f'Some users not found: {list(missing_ids)}',
                    'error_code': 'USER_NOT_FOUND'
                }, status=status.HTTP_404_NOT_FOUND)
            
            category = None
            if category_id is not None:
                category = CustomerCategory.objects.get(id=category_id)
            
            assigned_count = 0
            for user in existing_users:
                if category_id is None:
                    # Remove category
                    user.remove_category()
                else:
                    user.assign_category(category, request.user, notes)
                assigned_count += 1
            
            # Audit log for bulk action
            AuditLogger.log(
                request=request,
                action='CATEGORY_ASSIGN',
                resource_type='user',
                resource_id=None,
                details={
                    'action': 'bulk_assign' if category_id else 'bulk_remove',
                    'category_id': category_id,
                    'user_count': assigned_count,
                    'user_ids': user_ids,
                    'notes': notes
                }
            )
            
            action = "assigned" if category_id else "removed"
            return Response({
                'success': True,
                'message': f'Category {action} for {assigned_count} users',
                'assigned_count': assigned_count,
                'total_users': len(user_ids)
            })
            
    except CustomerCategory.DoesNotExist:
        return Response({
            'error': 'Category not found',
            'error_code': 'CATEGORY_NOT_FOUND'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in bulk assign: {str(e)}")
        return Response({
            'error': 'Bulk assignment failed',
            'error_code': 'CATEGORY_BULK_ASSIGN_FAILED',
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_categories_report(request):
    """Get report of users by category"""
    categories = CustomerCategory.objects.filter(is_active=True)
    
    report_data = []
    for category in categories:
        users_count = category.users.count()
        report_data.append({
            'category_id': category.id,
            'category_name': category.display_name,
            'profit_percentage': float(category.profit_percentage),
            'users_count': users_count,
            'total_profit_potential': float(category.profit_percentage * users_count) if users_count > 0 else 0
        })
    
    # Add uncategorized users
    uncategorized_count = User.objects.filter(
        category__isnull=True
    ).count()
    default_category = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
    default_profit = float(default_category.profit_percentage) if default_category else 15.0
    report_data.append({
        'category_id': None,
        'category_name': 'Uncategorized',
        'profit_percentage': default_profit,
        'users_count': uncategorized_count,
        'total_profit_potential': float(default_profit * uncategorized_count) if uncategorized_count > 0 else 0.0
    })
    
    # Calculate totals
    total_users = sum(item['users_count'] for item in report_data)
    total_profit_potential = sum(item['total_profit_potential'] for item in report_data)
    users_with_categories = total_users - uncategorized_count
    
    return Response({
        'categories': report_data,
        'users_with_categories': users_with_categories,
        'users_without_categories': uncategorized_count,
        'summary': {
            'total_users': total_users,
            'total_categories': len(categories),
            'total_profit_potential': total_profit_potential,
            'average_profit_percentage': total_profit_potential / total_users if total_users > 0 else 0
        }
    })
