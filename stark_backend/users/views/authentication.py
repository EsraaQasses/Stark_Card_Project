import random
import secrets
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework import generics, status, serializers
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db import transaction
import logging
from rest_framework.decorators import api_view, permission_classes, throttle_classes 
from ..serializers import (
    UserProfileSerializer, UserSerializer, RegisterSerializer,
    VerifyOTPSerializer, UserLoginSerializer, AdminLoginSerializer,
    AdminStep1LoginSerializer, AdminStep2LoginSerializer, AdminStep3LoginSerializer,
    UserLoginOTPSerializer
)
from ..models import OTPCode, User, UserLoginSession
from ..permissions import IsAdminUser
from ..utils.audit_logger import AuditLogger
from ..utils.email_service import EmailService
from ..authentication import issue_tokens
from ..throttles import AdminLoginThrottle, OTPRequestThrottle

logger = logging.getLogger(__name__)

# -------------------- User Registration --------------------
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        connected_agent_name = user.agent.full_name if user.agent else None

        # Audit log for user registration
        AuditLogger.log(
            request=request,
            action='USER_CREATE',
            resource_type='user',
            resource_id=user.id,
            details={
                'provider': request.data.get('provider'),
                'agent_connected': user.agent is not None,
                'agent_name': connected_agent_name
            }
        )

        return Response({
            "message": "User registered successfully. Please verify OTP sent to your provider.",
            "user": UserSerializer(user).data,
            "connected_agent": connected_agent_name
        }, status=status.HTTP_201_CREATED)


# -------------------- OTP Verification --------------------
class VerifyOTPView(generics.GenericAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [AllowAny]
    throttle_classes = [OTPRequestThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # Audit log for OTP verification
        AuditLogger.log(
            request=request,
            action='USER_UPDATE',
            resource_type='user',
            resource_id=user.id,
            details={'action': 'otp_verification', 'status': 'verified'}
        )

        return Response({
            "message": "OTP verified successfully. Account activated.",
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)


# -------------------- User Login -------------------- (OTP SKIPPED)
class UserLoginView(generics.GenericAPIView):
    serializer_class = UserLoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # Create JWT tokens directly (skip OTP)
        refresh, access = issue_tokens(user)

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Audit log for login (direct, no OTP)
        AuditLogger.log(
            request=request,
            action='LOGIN',
            resource_type='user',
            resource_id=user.id,
            details={
                'step': 1,
                'success': True,
                'otp_skipped': True,
                'direct_login': True
            }
        )

        return Response({
            "refresh": str(refresh),
            "access": str(access),
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role
            }
        }, status=status.HTTP_200_OK)




# -------------------- User Login OTP Verification --------------------
class UserLoginOTPView(generics.GenericAPIView):
    serializer_class = UserLoginOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        session = serializer.validated_data["session"]
        user = serializer.validated_data["user"]
        otp = serializer.validated_data["otp"]

        # Mark OTP as used
        otp.is_used = True
        otp.save()

        # Mark session as verified
        session.otp_verified = True
        session.save()

        # Create JWT tokens
        refresh, access = issue_tokens(user)

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Audit log for successful login
        AuditLogger.log(
            request=request,
            action='LOGIN',
            resource_type='user',
            resource_id=user.id,
            details={
                'step': 2,
                'success': True,
                'otp_verified': True
            }
        )

        # Clean up session
        session.delete()

        return Response({
            "refresh": str(refresh),
            "access": str(access),
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role
            }
        }, status=status.HTTP_200_OK)


# -------------------- Admin Login (Legacy) --------------------
class AdminLoginView(generics.GenericAPIView):
    serializer_class = AdminLoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        refresh, access = issue_tokens(user)
        
        # Audit log for legacy admin login
        AuditLogger.log(
            request=request,
            action='LOGIN',
            resource_type='user',
            resource_id=user.id,
            details={'login_type': 'legacy', 'success': True}
        )
        
        return Response({
            "refresh": str(refresh),
            "access": str(access),
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role
            }
        }, status=status.HTTP_200_OK)


# -------------------- Logout --------------------
class LogoutView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        refresh_token = request.data.get("refresh")
        access_token = request.data.get("access")

        try:
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                
                # Audit log for logout
                AuditLogger.log(
                    request=request,
                    action='LOGOUT',
                    resource_type='user',
                    resource_id=request.user.id,
                    details={'token_type': 'refresh'}
                )
                
                return Response({"message": "Logged out (refresh token blacklisted)"}, status=status.HTTP_200_OK)
            elif access_token:
                token = AccessToken(access_token)
                token.blacklist()
                
                # Audit log for logout
                AuditLogger.log(
                    request=request,
                    action='LOGOUT',
                    resource_type='user',
                    resource_id=request.user.id,
                    details={'token_type': 'access'}
                )
                
                return Response({"message": "Logged out (access token blacklisted)"}, status=status.HTTP_200_OK)
            else:
                # Audit log for client-side logout
                AuditLogger.log(
                    request=request,
                    action='LOGOUT',
                    resource_type='user',
                    resource_id=request.user.id,
                    details={'token_type': 'client_side'}
                )
                
                return Response({"message": "Logged out (client side)"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Email Verification --------------------
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([OTPRequestThrottle])
def verify_email(request):
    email = request.data.get('email')
    verification_code = request.data.get('code')
    
    if not email or not verification_code:
        return Response({"error": "Email and verification code are required."}, status=400)
    
    try:
        user = User.objects.get(email=email)
        
        verify_data = {"name": user.name, "otp_code": verification_code}
        verify_serializer = VerifyOTPSerializer(data=verify_data)
        
        if verify_serializer.is_valid():
            verified_user = verify_serializer.validated_data["user"]
            
            # Audit log for email verification
            AuditLogger.log(
                request=request,
                action='USER_UPDATE',
                resource_type='user',
                resource_id=user.id,
                details={'action': 'email_verification', 'status': 'verified'}
            )
            
            return Response({
                "message": "Email verified successfully. Your account is now active.",
                "user": UserSerializer(verified_user).data
            })
        else:
            # Audit log for failed verification
            AuditLogger.log(
                request=request,
                action='USER_UPDATE',
                resource_type='user',
                resource_id=user.id,
                details={'action': 'email_verification', 'status': 'failed'}
            )
            
            return Response({"error": verify_serializer.errors}, status=400)
            
    except User.DoesNotExist:
        return Response({"error": "User not found."}, status=404)


# -------------------- Email Verification View (Token-based) --------------------
class VerifyEmailView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.GET.get('token')
        
        if not token:
            return Response({"error": "Verification token is required."}, status=400)
        
        return Response({"message": "Email verification would be handled here."})


# -------------------- Resend OTP --------------------
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([OTPRequestThrottle])
def resend_otp(request):
    name = request.data.get("name")
    if not name:
        return Response({"error": "Name is required"}, status=400)

    try:
        user = User.objects.get(name=name)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)

    identity = user.identities.first()
    if identity and identity.is_verified:
        return Response({"error": "Account is already verified"}, status=400)

    OTPCode.objects.filter(user=user).delete()

    otp_code = str(random.randint(100000, 999999))
    OTPCode.objects.create(user=user, code=otp_code)

    if identity and identity.provider in ["email", "google"]:
        EmailService.send_otp_email(user=user, otp_code=otp_code, purpose='verification')

    # Audit log for OTP resend
    AuditLogger.log(
        request=request,
        action='USER_UPDATE',
        resource_type='user',
        resource_id=user.id,
        details={'action': 'otp_resend', 'provider': identity.provider if identity else 'unknown'}
    )

    return Response({"message": "OTP resent successfully"}, status=200)
