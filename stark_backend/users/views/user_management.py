from django.db.models import Prefetch
from rest_framework import generics, status
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from ..authentication import VersionedJWTAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
import logging

from ..models import User, UserIdentity
from ..serializers import UserProfileSerializer, UserSerializer, UserListSerializer
from ..permissions import IsAdminUser
from ..utils.audit_logger import AuditLogger

logger = logging.getLogger(__name__)

# -------------------- User Profile --------------------
class UserProfileView(generics.RetrieveUpdateAPIView):
    authentication_classes = [VersionedJWTAuthentication, TokenAuthentication, SessionAuthentication]
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        if 'avatar' in request.FILES and instance.avatar:
            instance.avatar.delete(save=False)
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Audit log for profile update
        AuditLogger.log(
            request=request,
            action='USER_UPDATE',
            resource_type='user',
            resource_id=instance.id,
            details={'update_type': 'profile', 'fields_updated': list(request.data.keys())}
        )
        
        return Response(serializer.data)



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_my_account(request):
    user = request.user
    if getattr(user, 'role', None) == 'admin':
        return Response({'error': 'Admins cannot delete their own account via this endpoint.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        user.delete()
        return Response({'message': 'Account deleted successfully.'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Failed to delete account for user {user.id}: {str(e)}")
        return Response({'error': 'Failed to delete account.'}, status=status.HTTP_400_BAD_REQUEST)


# -------------------- List All Users (Optimized) --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_list(request):
    try:
        users = User.objects.select_related(
            'category', 
            'category_assigned_by'
        ).prefetch_related(
            Prefetch(
                'identities',
                queryset=UserIdentity.objects.filter(is_verified=True),
                to_attr='prefetched_identities'
            )
        ).order_by('-date_joined')
        
        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error in user_list: {str(e)}")
        return Response({
            "error": "Failed to load users"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# -------------------- Simple User List --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def simple_user_list(request):
    """Simple user list without complex serialization"""
    try:
        users = User.objects.all().order_by('-date_joined').values(
            'id', 'name', 'full_name', 'email', 'phone', 'role', 
            'country', 'is_banned', 'last_login', 'is_active', 'date_joined'
        )
        users_list = list(users)
        
        for user in users_list:
            user['balances'] = {"USD": 0.0, "SYP": 0.0}
            user['is_verified'] = True
            user['connected_agent'] = None
            user['agent_code'] = None
            user['optional_phone'] = user.get('optional_phone', '')
            user['agent'] = None
        
        return Response(users_list)
    except Exception as e:
        logger.error(f"Error in simple_user_list: {str(e)}")
        return Response({"error": "Failed to load users"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
