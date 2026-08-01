# users/views/security.py - UPDATED AND FIXED VERSION
import secrets
import random
from datetime import timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, serializers
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
import logging

from ..serializers import (
    AdminStep1LoginSerializer, AdminStep2LoginSerializer, 
    AdminStep3LoginSerializer, SetupSecondPasswordSerializer,
    AdminProfileUpdateSerializer
)
from ..models import AdminLoginSession, User, AdminSecurity, OTPCode
from ..permissions import IsAdminUser
from ..utils.audit_logger import AuditLogger
from ..utils import SessionValidatorMixin
from ..throttles import AdminLoginThrottle
from ..utils.email_service import EmailService

logger = logging.getLogger(__name__)

# -------------------- Admin Step 1 Login --------------------
class AdminStep1LoginView(SessionValidatorMixin, generics.GenericAPIView):
    serializer_class = AdminStep1LoginSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AdminLoginThrottle]

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            user = serializer.validated_data["user"]
            admin_security = serializer.validated_data["admin_security"]

            # Create secure login session
            session_token = secrets.token_urlsafe(64)
            session = AdminLoginSession.objects.create(
                user=user,
                session_token=session_token,
                step_1_completed=True,
                expires_at=timezone.now() + timedelta(minutes=30)
            )

            response_data = {
                "success": True,
                "message": "Step 1 completed successfully",
                "session_token": session_token,
                "requires_second_password": admin_security.is_second_password_set,
                "requires_setup": False
            }

            if not admin_security.is_second_password_set:
                response_data["message"] = "Please set up your second password to continue"
                response_data["requires_setup"] = True

            # Audit log for login attempt
            AuditLogger.log(
                request=request,
                action='LOGIN',
                resource_type='user',
                resource_id=user.id,
                details={
                    'step': 1,
                    'success': True,
                    'session_token': session_token[:10] + '...'
                }
            )

            return Response(response_data, status=status.HTTP_200_OK)
            
        except serializers.ValidationError as e:
            # Audit log for failed login attempt
            if 'user' in locals():
                AuditLogger.log(
                    request=request,
                    action='LOGIN',
                    resource_type='user',
                    resource_id=user.id if 'user' in locals() else None,
                    details={
                        'step': 1,
                        'success': False,
                        'error': str(e.detail)
                    }
                )
            
            return Response({
                "success": False,
                "error": "Authentication failed"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Admin Step 1 login error: {str(e)}")
            return Response({
                "success": False,
                "error": "Authentication failed"
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Admin Step 2 Login --------------------
class AdminStep2LoginView(SessionValidatorMixin, generics.GenericAPIView):
    serializer_class = AdminStep2LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            session = serializer.validated_data["session"]
            user = serializer.validated_data["user"]

            # ✅ CRITICAL FIX: Check if second password is required
            admin_security = getattr(user, 'admin_security', None)
            if not admin_security:
                # Create admin security if it doesn't exist
                admin_security, created = AdminSecurity.objects.get_or_create(user=user)
            
            # ✅ FIX: Handle case where second password is not set
            if not admin_security.is_second_password_set:
                # Skip to OTP generation directly
                logger.info(f"Second password not set for admin {user.name}. Skipping to OTP.")
                session.step_2_completed = True
                session.save()
                
                # Generate and send OTP
                return self._send_otp_and_respond(request, session, user)

            # ✅ FIX: Get the actual second password from request data
            second_password = request.data.get('second_password')
            if not second_password:
                return Response({
                    "success": False,
                    "error": "Second password is required"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ✅ FIX: Validate second password
            if not admin_security.check_second_password(second_password):
                # Audit log for failed second password
                AuditLogger.log(
                    request=request,
                    action='LOGIN',
                    resource_type='user',
                    resource_id=user.id,
                    details={
                        'step': 2,
                        'success': False,
                        'error': 'Invalid second password',
                        'session_token': session.session_token[:10] + '...'
                    }
                )
                return Response({
                    "success": False,
                    "error": "Invalid second password"
                }, status=status.HTTP_400_BAD_REQUEST)

            # ✅ FIX: Now send OTP
            return self._send_otp_and_respond(request, session, user)
            
        except serializers.ValidationError as e:
            logger.error(f"Step 2 validation error: {str(e)}")
            return Response({
                "success": False,
                "error": str(e.detail)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Admin Step 2 login error: {str(e)}")
            return Response({
                "success": False,
                "error": "Second password verification failed"
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _send_otp_and_respond(self, request, session, user):
        """Helper method to send OTP and prepare response"""
        try:
            if not user.email:
                return Response({
                    "success": False,
                    "error": "Admin email is required to send OTP"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Generate OTP
            otp_code = str(random.randint(100000, 999999))
            
            # Clean old OTPs
            OTPCode.objects.filter(user=user, is_used=False).delete()
            
            # Create new OTP
            OTPCode.objects.create(user=user, code=otp_code)
            
            # ✅ FIX: Use proper email function
            try:
                # Get client info for audit
                ip_address = request.META.get('REMOTE_ADDR', 'Unknown')
                user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')[:200]
                
                # Send OTP email
                email_sent = EmailService.send_admin_login_otp(
                    user=user,
                    otp_code=otp_code,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                
                if not email_sent:
                    logger.error(f"Failed to send OTP email to {user.email}")
                    return Response({
                        "success": False,
                        "error": "Failed to send OTP. Please check email configuration."
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                    
            except AttributeError:
                # Fallback if send_admin_login_otp doesn't exist
                email_sent = EmailService.send_otp_email(
                    user=user, 
                    otp_code=otp_code, 
                    purpose='admin_login'
                )

            # Mark step 2 as completed
            session.step_2_completed = True
            session.save()

            response_data = {
                "success": True,
                "message": "Second password verified successfully. OTP sent to your email.",
                "session_token": session.session_token,
                "otp_sent": True,
                "email": user.email,
                "otp_expires_in": "5 minutes"
            }

            # Audit log for successful second password verification
            AuditLogger.log(
                request=request,
                action='LOGIN',
                resource_type='user',
                resource_id=user.id,
                details={
                    'step': 2,
                    'success': True,
                    'session_token': session.session_token[:10] + '...',
                    'otp_sent': True
                }
            )

            logger.info(f"OTP sent to {user.email} for admin {user.name}")
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to send OTP: {str(e)}")
            return Response({
                "success": False,
                "error": "Failed to send OTP. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- Admin Step 3 Login --------------------
class AdminStep3LoginView(SessionValidatorMixin, generics.GenericAPIView):
    serializer_class = AdminStep3LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            session = serializer.validated_data["session"]
            user = serializer.validated_data["user"]
            otp = serializer.validated_data["otp"]

            # Check OTP expiry
            if otp.is_expired():
                return Response({
                    "success": False,
                    "error": "OTP has expired"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Mark step 3 as completed
            session.step_3_completed = True
            session.save()
            otp.is_used = True
            otp.save(update_fields=["is_used"])

            # Generate JWT tokens
            from ..authentication import issue_tokens
            refresh, access_token = issue_tokens(user)
            
            # Set token expiration
            access_token.set_exp(lifetime=timedelta(hours=24))
            
            # Clean up session
            session.delete()

            # Clean up other expired sessions
            self.cleanup_expired_sessions(user=user)

            # ✅ FIX: Clean up used OTPs
            OTPCode.objects.filter(user=user, is_used=True).delete()
            OTPCode.objects.filter(
                user=user,
                created_at__lt=timezone.now() - timedelta(minutes=10)
            ).delete()

            # Audit log for successful login
            AuditLogger.log(
                request=request,
                action='LOGIN',
                resource_type='user',
                resource_id=user.id,
                details={
                    'step': 3,
                    'success': True,
                    'ip_address': AuditLogger._get_client_ip(request),
                    'login_time': timezone.now().isoformat()
                }
            )

            logger.info(f"Admin login successful for {user.name}")

            return Response({
                "success": True,
                "message": "Admin login successful",
                "refresh": str(refresh),
                "access": str(access_token),
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "role": user.role,
                    "full_name": user.full_name,
                    "email": user.email,
                    "is_superuser": user.is_superuser
                },
                "expires_in": 3600 * 24  # 24 hours in seconds
            }, status=status.HTTP_200_OK)
            
        except serializers.ValidationError as e:
            logger.error(f"Step 3 validation error: {str(e)}")
            return Response({
                "success": False,
                "error": str(e.detail)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Admin Step 3 login error: {str(e)}")
            return Response({
                "success": False,
                "error": "Authentication failed"
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- First Time Setup Second Password --------------------
class FirstTimeSetupSecondPasswordView(generics.GenericAPIView):
    serializer_class = SetupSecondPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            session_token = request.data.get('session_token')
            if not session_token:
                return Response({
                    "success": False,
                    "error": "Session token is required"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            second_password = serializer.validated_data['second_password']

            # Get session and verify
            session = AdminLoginSession.objects.get(
                session_token=session_token,
                step_1_completed=True,
                step_2_completed=False
            )
            
            if session.is_expired():
                session.delete()
                return Response({
                    "success": False,
                    "error": "Session expired. Please start the login process again."
                }, status=status.HTTP_400_BAD_REQUEST)

            user = session.user
            
            # ✅ FIX: Setup second password properly
            admin_security, created = AdminSecurity.objects.get_or_create(user=user)
            admin_security.set_second_password(second_password)
            
            # Mark step 2 as completed
            session.step_2_completed = True
            session.save()
            
            # ✅ FIX: Send OTP after setting password
            try:
                # Generate OTP
                otp_code = str(random.randint(100000, 999999))
                OTPCode.objects.filter(user=user, is_used=False).delete()
                OTPCode.objects.create(user=user, code=otp_code)
                
                # Send OTP email
                ip_address = request.META.get('REMOTE_ADDR', 'Unknown')
                user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')[:200]
                
                email_sent = EmailService.send_admin_login_otp(
                    user=user,
                    otp_code=otp_code,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                
                if not email_sent:
                    logger.error(f"Failed to send OTP after password setup for {user.email}")
            
            except Exception as e:
                logger.error(f"Failed to send OTP after password setup: {str(e)}")
            
            # Audit log
            AuditLogger.log(
                request=request,
                action='SECOND_PASSWORD_SET',
                resource_type='user',
                resource_id=user.id,
                details={
                    'session_token': session_token[:10] + '...',
                    'setup_type': 'first_time'
                }
            )
            
            response_data = {
                "success": True,
                "message": "Second password set up successfully. OTP sent to your email.",
                "session_token": session_token,
                "requires_otp": True
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except AdminLoginSession.DoesNotExist:
            return Response({
                "success": False,
                "error": "Invalid or expired session"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Failed to set up second password: {str(e)}")
            return Response({
                "success": False,
                "error": "Failed to set up second password"
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Setup Second Password --------------------
class SetupSecondPasswordView(generics.GenericAPIView):
    serializer_class = SetupSecondPasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Only admin users can set up second password"}, 
                          status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        second_password = serializer.validated_data['second_password']
        
        try:
            # ✅ FIX: Use proper method
            admin_security, created = AdminSecurity.objects.get_or_create(user=request.user)
            admin_security.set_second_password(second_password)
            
            # Audit log
            AuditLogger.log(
                request=request,
                action='SECOND_PASSWORD_SET',
                resource_type='user',
                resource_id=request.user.id,
                details={'setup_type': 'update'}
            )
            
            return Response({
                "success": True,
                "message": "Second password set up successfully"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to set up second password: {str(e)}")
            return Response({
                "success": False,
                "error": "Failed to set up second password"
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Check Second Password Setup --------------------
class CheckSecondPasswordSetupView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Only admin users can check second password setup"}, 
                          status=status.HTTP_403_FORBIDDEN)

        is_setup = hasattr(request.user, 'admin_security') and request.user.admin_security.is_second_password_set
        
        return Response({
            "success": True,
            "is_second_password_set": is_setup
        }, status=status.HTTP_200_OK)


# -------------------- Set Admin Second Password --------------------
class SetAdminSecondPasswordView(generics.GenericAPIView):
    serializer_class = SetupSecondPasswordSerializer
    permission_classes = [IsAdminUser]

    def post(self, request, user_id):
        """Set second password for another admin user"""
        try:
            target_user = get_object_or_404(User, id=user_id)
            
            # Check if target user is admin
            if target_user.role != "admin":
                return Response({
                    "success": False,
                    "error": "Target user is not an admin"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if current user has permission (super admin can set for others)
            if not request.user.is_superuser and request.user.id != target_user.id:
                return Response({
                    "success": False,
                    "error": "You can only set your own second password"
                }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            second_password = serializer.validated_data['second_password']
            
            # ✅ FIX: Set up second password properly
            admin_security, created = AdminSecurity.objects.get_or_create(user=target_user)
            admin_security.set_second_password(second_password)
            
            # Audit log for setting second password for another admin
            AuditLogger.log(
                request=request,
                action='SECOND_PASSWORD_SET',
                resource_type='user',
                resource_id=user_id,
                details={
                    'set_by': request.user.id,
                    'set_for': target_user.id,
                    'setup_type': 'by_another_admin'
                }
            )
            
            return Response({
                "success": True,
                "message": "Second password set up successfully",
                "user": {
                    "id": target_user.id,
                    "name": target_user.name,
                    "full_name": target_user.full_name
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Failed to set second password: {str(e)}")
            return Response({
                "success": False,
                "error": "Failed to set second password"
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Admin Profile Update --------------------
class AdminProfileUpdateView(generics.UpdateAPIView):
    serializer_class = AdminProfileUpdateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(
            instance, 
            data=request.data, 
            partial=partial,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        self.perform_update(serializer)

        # Audit log for profile update
        changed_fields = []
        for field in ['full_name', 'name', 'email']:
            if field in request.data and getattr(instance, field) != request.data[field]:
                changed_fields.append(field)
        
        if changed_fields:
            AuditLogger.log(
                request=request,
                action='USER_UPDATE',
                resource_type='user',
                resource_id=instance.id,
                details={'changed_fields': changed_fields}
            )

        # Return updated user data
        from ..serializers import UserProfileSerializer
        user_serializer = UserProfileSerializer(instance, context={'request': request})
        
        response_data = {
            "success": True,
            "message": "Profile updated successfully",
            "user": user_serializer.data
        }
        
        # Add specific success messages based on what was updated
        if 'new_password' in request.data:
            response_data["password_message"] = "Password updated successfully"
            AuditLogger.log(
                request=request,
                action='PASSWORD_CHANGE',
                resource_type='user',
                resource_id=instance.id,
                details={'change_type': 'main_password'}
            )
        
        if 'new_second_password' in request.data:
            response_data["second_password_message"] = "Second password updated successfully"
            AuditLogger.log(
                request=request,
                action='SECOND_PASSWORD_CHANGE',
                resource_type='user',
                resource_id=instance.id,
                details={'change_type': 'second_password'}
            )

        return Response(response_data, status=status.HTTP_200_OK)


# -------------------- Debug Session --------------------
@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
def debug_session(request):
    """Debug endpoint to check session state"""
    if request.method == 'POST':
        session_token = request.data.get('session_token')
    else:
        session_token = request.GET.get('session_token')
    
    if not session_token:
        return Response({
            'success': False,
            'error': 'session_token is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        session = AdminLoginSession.objects.get(session_token=session_token)
        
        # Check second password status
        admin_security = getattr(session.user, 'admin_security', None)
        has_second_password = admin_security.is_second_password_set if admin_security else False
        
        return Response({
            'success': True,
            'session_exists': True,
            'user': session.user.name,
            'user_email': session.user.email,
            'has_second_password': has_second_password,
            'step_1_completed': session.step_1_completed,
            'step_2_completed': session.step_2_completed, 
            'step_3_completed': session.step_3_completed,
            'is_expired': session.is_expired(),
            'created_at': session.created_at,
            'expires_at': session.expires_at,
            'current_time': timezone.now()
        })
    except AdminLoginSession.DoesNotExist:
        return Response({
            'success': False,
            'session_exists': False,
            'error': 'Session not found'
        })
    except Exception as e:
        logger.error(f"Debug session error: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        })
