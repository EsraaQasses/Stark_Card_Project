# users/views/check_password.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import logging

from ..models import AdminLoginSession, AdminSecurity
from ..serializers import AdminStep1LoginSerializer

logger = logging.getLogger(__name__)

class CheckSecondPasswordSetupView(generics.GenericAPIView):
    """Check if second password is set up for admin"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AdminStep1LoginSerializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data['user']
            
            has_second_password = hasattr(user, 'admin_security') and user.admin_security.is_second_password_set
            
            return Response({
                'success': True,
                'has_second_password': has_second_password,
                'user_id': user.id,
                'user_name': user.name
            })
            
        except Exception as e:
            logger.error(f"Error checking second password: {str(e)}")
            return Response({
                'success': False,
                'error': 'Invalid credentials'
            }, status=status.HTTP_400_BAD_REQUEST)


class FirstTimeSetupSecondPasswordView(generics.GenericAPIView):
    """First-time second password setup (after admin creation)"""
    permission_classes = [AllowAny]

    def post(self, request):
        from ..serializers import SetupSecondPasswordSerializer
        
        # Get user from admin creation context
        user_id = request.data.get('user_id')
        session_token = request.data.get('session_token')
        
        if not user_id:
            return Response({
                'error': 'User ID required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            from ..models import User
            user = User.objects.get(id=user_id, role='admin')
            
            # Create admin security if not exists
            admin_security, created = AdminSecurity.objects.get_or_create(user=user)
            
            if admin_security.is_second_password_set:
                return Response({
                    'success': True,
                    'message': 'Second password already set',
                    'requires_setup': False
                })
            
            # Validate password setup
            serializer = SetupSecondPasswordSerializer(data=request.data)
            if serializer.is_valid():
                admin_security.set_second_password(serializer.validated_data['second_password'])
                
                return Response({
                    'success': True,
                    'message': 'Second password set successfully',
                    'requires_setup': False
                })
            else:
                return Response({
                    'success': False,
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({
                'error': 'User not found or not an admin'
            }, status=status.HTTP_404_NOT_FOUND)