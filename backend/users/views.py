import random
import secrets
from datetime import timedelta
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework import generics, status, serializers
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_otp.plugins.otp_totp.models import TOTPDevice
import django_otp

# Import for QR code generation
import qrcode
from io import BytesIO
import base64

from .serializers import (
    UserProfileSerializer, UserSerializer, RegisterSerializer,
    VerifyOTPSerializer, UserLoginSerializer, AdminLoginSerializer,
    ChangePasswordSerializer, ResetPasswordSerializer, ForgotPasswordSerializer,
    AdminStep1LoginSerializer, AdminStep2LoginSerializer, AdminStep3LoginSerializer,
    SetupSecondPasswordSerializer, AdminProfileUpdateSerializer
)
from .models import OTPCode, User, PasswordResetToken, AdminSecurity, AdminLoginSession
from .permissions import IsAdminUser


# -------------------- Backup Codes Manager --------------------
class BackupCodeManager:
    """Production-ready backup codes manager"""
    
    @staticmethod
    def create_backup_codes(user, count=10):
        """Generate and store secure backup codes"""
        backup_codes = []
        for i in range(count):
            # Generate 10-character backup codes (more secure)
            code = secrets.token_urlsafe(8).upper().replace('_', '').replace('-', '')[:10]
            backup_codes.append(code)
        
        # Store backup codes in user's admin security record
        admin_security, created = AdminSecurity.objects.get_or_create(user=user)
        admin_security.backup_codes = backup_codes
        admin_security.save()
        
        return backup_codes
    
    @staticmethod
    def verify_backup_code(user, code):
        """Verify a backup code and mark it as used"""
        try:
            admin_security = AdminSecurity.objects.get(user=user)
            if not admin_security.backup_codes:
                return False
                
            if code in admin_security.backup_codes:
                # Remove the used code
                admin_security.backup_codes.remove(code)
                admin_security.save()
                return True
            return False
        except AdminSecurity.DoesNotExist:
            return False
    
    @staticmethod
    def get_remaining_codes(user):
        """Get number of remaining backup codes"""
        try:
            admin_security = AdminSecurity.objects.get(user=user)
            return len(admin_security.backup_codes) if admin_security.backup_codes else 0
        except AdminSecurity.DoesNotExist:
            return 0


# -------------------- 2FA Management Views --------------------
class TwoFactorSetupView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get 2FA setup information with proper security"""
        try:
            user = request.user
            
            # Check if 2FA is already enabled
            existing_devices = TOTPDevice.objects.filter(user=user, confirmed=True)
            
            if existing_devices.exists():
                return Response({
                    "success": True,
                    "is_2fa_enabled": True,
                    "message": "2FA is already enabled for this account",
                    "devices": [
                        {
                            "id": device.id,
                            "name": device.name or "Authenticator App",
                            "confirmed": device.confirmed,
                            "created_at": device.created_at
                        }
                        for device in existing_devices
                    ],
                    "backup_codes_remaining": BackupCodeManager.get_remaining_codes(user)
                }, status=status.HTTP_200_OK)
            
            # Check for any unconfirmed devices first
            unconfirmed_device = TOTPDevice.objects.filter(
                user=user, 
                confirmed=False
            ).first()
            
            if unconfirmed_device:
                # Return existing unconfirmed device
                provisioning_url = unconfirmed_device.config_url
            else:
                # Create a new TOTP device
                unconfirmed_device = TOTPDevice.objects.create(
                    user=user,
                    name="Authenticator App",
                    confirmed=False
                )
                provisioning_url = unconfirmed_device.config_url
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(provisioning_url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            qr_code = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                "success": True,
                "is_2fa_enabled": False,
                "secret_key": unconfirmed_device.bin_key.hex(),  # For manual entry
                "qr_code": f"data:image/png;base64,{qr_code}",
                "provisioning_url": provisioning_url,
                "device_id": unconfirmed_device.id,
                "message": "Scan the QR code with your authenticator app like Google Authenticator or Authy"
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": "Failed to generate 2FA setup",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class TwoFactorVerifyView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        """Verify and enable 2FA with proper token validation"""
        try:
            token = request.data.get('token')
            if not token:
                return Response({
                    "success": False,
                    "error": "2FA token is required"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find unconfirmed device for this user
            device = TOTPDevice.objects.filter(
                user=request.user, 
                confirmed=False
            ).first()
            
            if not device:
                return Response({
                    "success": False,
                    "error": "No pending 2FA setup found. Please start the 2FA setup process again."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Verify the token using django-otp
            if device.verify_token(token):
                device.confirmed = True
                device.save()
                
                # Generate secure backup codes
                backup_codes = BackupCodeManager.create_backup_codes(request.user, 10)
                
                # Log the 2FA enablement
                print(f"🔐 2FA enabled for user: {request.user.email}")
                
                return Response({
                    "success": True,
                    "message": "Two-factor authentication enabled successfully!",
                    "is_2fa_enabled": True,
                    "backup_codes": backup_codes,
                    "backup_codes_count": len(backup_codes),
                    "warning": "IMPORTANT: Save these backup codes in a secure location. You will need them if you lose access to your authenticator app. These codes will not be shown again."
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "success": False,
                    "error": "Invalid 2FA token. Please try again with the current code from your authenticator app."
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                "success": False,
                "error": "Failed to verify 2FA token",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class TwoFactorDisableView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request):
        """Disable 2FA with proper security checks"""
        try:
            user = request.user
            
            # Verify password or second password for security
            password = request.data.get('password')
            second_password = request.data.get('second_password')
            
            if not password and not second_password:
                return Response({
                    "success": False,
                    "error": "Password or second password is required to disable 2FA"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if password and not user.check_password(password):
                return Response({
                    "success": False,
                    "error": "Invalid password"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if second_password and hasattr(user, 'admin_security'):
                if not user.admin_security.check_second_password(second_password):
                    return Response({
                        "success": False,
                        "error": "Invalid second password"
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Delete all TOTP devices
            devices_count = TOTPDevice.objects.filter(user=user).count()
            TOTPDevice.objects.filter(user=user).delete()
            
            # Clear backup codes
            try:
                admin_security = AdminSecurity.objects.get(user=user)
                admin_security.backup_codes = []
                admin_security.save()
            except AdminSecurity.DoesNotExist:
                pass
            
            # Log the action
            print(f"🔓 2FA disabled for user: {user.email}")
            
            return Response({
                "success": True,
                "message": f"Two-factor authentication disabled successfully. {devices_count} device(s) removed.",
                "is_2fa_enabled": False
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": "Failed to disable 2FA",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class TwoFactorStatusView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get comprehensive 2FA status"""
        try:
            user = request.user
            devices = TOTPDevice.objects.filter(user=user)
            active_devices = devices.filter(confirmed=True)
            
            backup_codes_count = BackupCodeManager.get_remaining_codes(user)
            
            return Response({
                "success": True,
                "is_2fa_enabled": active_devices.exists(),
                "devices_count": active_devices.count(),
                "backup_codes_remaining": backup_codes_count,
                "devices": [
                    {
                        "id": device.id,
                        "name": device.name or "Authenticator App",
                        "confirmed": device.confirmed,
                        "created_at": device.created_at,
                        "last_used": device.last_used
                    }
                    for device in devices
                ]
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": "Failed to get 2FA status",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Utility Functions for Views --------------------

def _send_otp_email(user, otp_code, purpose="login"):
    """Production-ready OTP email sending with proper formatting"""
    
    subject_map = {
        "login": "Your Admin Login OTP - Stark",
        "verification": "Your Account Verification Code - Stark",
        "reset": "Your Password Reset OTP - Stark"
    }
    
    message_map = {
        "login": f"""Hello {user.full_name},

Your admin login verification code is: {otp_code}

This code will expire in {getattr(settings, 'ADMIN_OTP_EXPIRY_MINUTES', 10)} minutes.

If you didn't request this login, please secure your account immediately.

Best regards,
Stark Security Team""",
        
        "verification": f"""Hello {user.full_name},

Your account verification code is: {otp_code}

Enter this code to verify your email address and activate your account.

This code will expire in 10 minutes.

Best regards,
Stark Team""",
        
        "reset": f"""Hello {user.full_name},

Your password reset verification code is: {otp_code}

Enter this code to reset your password.

This code will expire in 10 minutes.

If you didn't request a password reset, please ignore this email.

Best regards,
Stark Team"""
    }
    
    print(f"📧 DEBUG: Generated OTP {otp_code} for {user.email} (Purpose: {purpose})")
    
    try:
        send_mail(
            subject=subject_map.get(purpose, "Your Verification Code - Stark"),
            message=message_map.get(purpose, f"Your verification code is: {otp_code}"),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False
        )
        print(f"✅ DEBUG: OTP email sent successfully to {user.email}")
        return True
    except Exception as e:
        print(f"❌ DEBUG: Failed to send OTP email to {user.email}: {str(e)}")
        # In production, you might want to use a logging service
        return False

def _get_client_ip(request):
    """Get client IP address for security logging"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# -------------------- Admin Step 1 Login --------------------
class AdminStep1LoginView(generics.GenericAPIView):
    serializer_class = AdminStep1LoginSerializer
    permission_classes = [AllowAny]
    http_method_names = ['post', 'head', 'options']

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
                "requires_2fa": False,
                "requires_otp": False
            }

            if not admin_security.is_second_password_set:
                response_data["message"] = "Please set up your second password to continue"
                response_data["requires_setup"] = True
            else:
                # Check if 2FA is enabled
                has_2fa = TOTPDevice.objects.filter(user=user, confirmed=True).exists()
                if has_2fa:
                    response_data["requires_2fa"] = True
                    response_data["message"] = "Step 1 completed. Please proceed to second password and 2FA."
                else:
                    # Send OTP for non-2FA users
                    if getattr(settings, 'ADMIN_OTP_REQUIRED', True):
                        otp_code = str(random.randint(100000, 999999))
                        OTPCode.objects.create(user=user, code=otp_code)
                        _send_otp_email(user, otp_code, "login")
                        
                        response_data["requires_otp"] = True
                        response_data["message"] = "Step 1 completed. OTP sent to your email. Please proceed to second password."
                    else:
                        response_data["message"] = "Step 1 completed. Please proceed to second password."

            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": "Authentication failed",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Admin Step 2 Login --------------------
class AdminStep2LoginView(generics.GenericAPIView):
    serializer_class = AdminStep2LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            session = serializer.validated_data["session"]
            user = serializer.validated_data["user"]

            # Mark step 2 as completed
            session.step_2_completed = True
            
            # Check 2FA status
            has_2fa = TOTPDevice.objects.filter(user=user, confirmed=True).exists()
            
            response_data = {
                "success": True,
                "message": "Second password verified successfully.",
                "session_token": session.session_token,
                "requires_2fa": has_2fa,
                "requires_otp": False
            }

            if has_2fa:
                response_data["message"] = "Second password verified. Please enter your 2FA code from your authenticator app."
            
            elif getattr(settings, 'ADMIN_OTP_REQUIRED', True):
                # Send OTP for non-2FA users
                otp_code = str(random.randint(100000, 999999))
                OTPCode.objects.create(user=user, code=otp_code)
                _send_otp_email(user, otp_code, "login")
                
                response_data["requires_otp"] = True
                response_data["message"] = "Second password verified successfully. OTP sent to your email."
            
            else:
                response_data["message"] = "Second password verified. Proceed to final login."

            session.save()
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": "Second password verification failed",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Admin Step 3 Login (PRODUCTION-READY) --------------------
class AdminStep3LoginView(generics.GenericAPIView):
    serializer_class = AdminStep3LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            
            if not serializer.is_valid():
                # Proper error handling for production
                error_messages = []
                for field, errors in serializer.errors.items():
                    for error in errors:
                        if hasattr(error, '__call__'):
                            error_messages.append(f"{field}: Validation error")
                        else:
                            error_messages.append(f"{field}: {error}")
                
                return Response({
                    "success": False,
                    "error": " | ".join(error_messages) if error_messages else "Authentication failed"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            session = serializer.validated_data["session"]
            user = serializer.validated_data["user"]

            # Mark step 3 as completed
            session.step_3_completed = True
            session.save()

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            access_token = refresh.access_token
            
            # Set token expiration (optional)
            access_token.set_exp(lifetime=timedelta(hours=24))
            
            # Clean up session
            session.delete()

            # Log successful admin login
            print(f"🔑 Admin login successful: {user.email} from IP: {_get_client_ip(request)}")

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
                    "email": user.email
                },
                "expires_in": 3600 * 24  # 24 hours in seconds
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Admin Step 3 login error: {str(e)}")
            return Response({
                "success": False,
                "error": "Authentication failed. Please try again."
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
            
            # Setup second password
            user.setup_second_password(second_password)
            
            # Mark step 2 as completed
            session.step_2_completed = True
            
            # Check authentication requirements
            has_2fa = TOTPDevice.objects.filter(user=user, confirmed=True).exists()
            response_data = {
                "success": True,
                "message": "Second password set up successfully",
                "requires_2fa": has_2fa,
                "requires_otp": False
            }
            
            if not has_2fa and getattr(settings, 'ADMIN_OTP_REQUIRED', True):
                # Send OTP for non-2FA users
                otp_code = str(random.randint(100000, 999999))
                OTPCode.objects.create(user=user, code=otp_code)
                _send_otp_email(user, otp_code, "login")
                
                response_data["requires_otp"] = True
                response_data["message"] = "Second password set up successfully. OTP sent to your email."
            
            session.save()

            return Response(response_data, status=status.HTTP_200_OK)

        except AdminLoginSession.DoesNotExist:
            return Response({
                "success": False,
                "error": "Invalid or expired session"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                "success": False,
                "error": "Failed to set up second password",
                "details": str(e)
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
            request.user.setup_second_password(second_password)
            return Response({
                "message": "Second password set up successfully"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
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
            "is_second_password_set": is_setup
        }, status=status.HTTP_200_OK)


# -------------------- 2FA Status Check --------------------
class Check2FAStatusView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Check 2FA status using django-otp"""
        try:
            is_2fa_enabled = TOTPDevice.objects.filter(user=request.user, confirmed=True).exists()
            devices_count = TOTPDevice.objects.filter(user=request.user, confirmed=True).count()
            
            return Response({
                "is_2fa_enabled": is_2fa_enabled,
                "devices_count": devices_count,
                "devices": [
                    {
                        "id": device.id,
                        "name": device.name or "Authenticator App",
                        "confirmed": device.confirmed,
                        "created_at": device.created_at
                    }
                    for device in TOTPDevice.objects.filter(user=request.user)
                ]
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "error": "Failed to check 2FA status",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Debug Session --------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def debug_session(request):
    """Debug endpoint to check session state"""
    session_token = request.data.get('session_token')
    
    try:
        session = AdminLoginSession.objects.get(session_token=session_token)
        return Response({
            'session_exists': True,
            'step_1_completed': session.step_1_completed,
            'step_2_completed': session.step_2_completed, 
            'step_3_completed': session.step_3_completed,
            'user': session.user.name,
            'is_expired': session.is_expired(),
            'current_time': timezone.now()
        })
    except AdminLoginSession.DoesNotExist:
        return Response({'session_exists': False})


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

        # Return updated user data
        user_serializer = UserProfileSerializer(instance, context={'request': request})
        
        response_data = {
            "message": "Profile updated successfully",
            "user": user_serializer.data
        }
        
        # Add specific success messages based on what was updated
        if 'new_password' in request.data:
            response_data["password_message"] = "Password updated successfully"
        
        if 'new_second_password' in request.data:
            response_data["second_password_message"] = "Second password updated successfully"

        return Response(response_data, status=status.HTTP_200_OK)


# -------------------- User Registration --------------------
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        connected_agent_name = user.agent.full_name if user.agent else None

        return Response({
            "message": "User registered successfully. Please verify OTP sent to your provider.",
            "user": UserSerializer(user).data,
            "connected_agent": connected_agent_name
        }, status=status.HTTP_201_CREATED)


# -------------------- OTP Verification --------------------
class VerifyOTPView(generics.GenericAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        return Response({
            "message": "OTP verified successfully. Account activated.",
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)


# -------------------- User Login --------------------
class UserLoginView(generics.GenericAPIView):
    serializer_class = UserLoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
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

        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
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
                return Response({"message": "Logged out (refresh token blacklisted)"}, status=status.HTTP_200_OK)
            elif access_token:
                token = AccessToken(access_token)
                token.blacklist()
                return Response({"message": "Logged out (access token blacklisted)"}, status=status.HTTP_200_OK)
            else:
                return Response({"message": "No token provided, but logged out (client side)"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Invalid or expired token", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# -------------------- Ban User --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ban_user(request, user_id):
    if not request.user.role == "admin":
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    user = get_object_or_404(User, id=user_id)

    if user == request.user:
        return Response({'error': "You can't ban yourself."}, status=status.HTTP_400_BAD_REQUEST)

    if user.is_banned:
        return Response({'status': f'{user.name} is already banned.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_banned = True
    user.save()
    return Response({'status': f'{user.name} has been banned.'}, status=status.HTTP_200_OK)


# -------------------- Unban User --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unban_user(request, user_id):
    if not request.user.role == "admin":
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    user = get_object_or_404(User, id=user_id)

    if not user.is_banned:
        return Response({'status': f'{user.name} is not banned.'}, status=status.HTTP_400_BAD_REQUEST)

    user.is_banned = False
    user.save()
    return Response({'status': f'{user.name} has been unbanned.'}, status=status.HTTP_200_OK)


# -------------------- Make User Agent --------------------
@api_view(['POST'])
@permission_classes([IsAdminUser])
def make_user_agent(request, user_id):
    """Make a regular user an agent"""
    try:
        user = get_object_or_404(User, id=user_id)
        
        if user.role == "agent":
            return Response({
                'message': f'{user.name} is already an agent.',
                'agent_code': user.agent_code
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if user.role == "admin":
            return Response({
                'error': 'Cannot change admin role to agent'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Change role to agent
        user.role = "agent"
        user.save()
        
        # Ensure user has wallets
        from wallets.models import Wallet
        Wallet.objects.get_or_create(user=user, currency="USD")
        Wallet.objects.get_or_create(user=user, currency="SYP")

        return Response({
            'message': f'{user.name} has been promoted to agent.',
            'agent_code': user.agent_code,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error making user agent: {str(e)}")
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
        
        # Check if user is already admin
        if user.role == "admin":
            # Get admin security status
            admin_security, created = AdminSecurity.objects.get_or_create(user=user)
            return Response({
                'success': True,
                'message': f'{user.name} is already an admin.',
                'user': UserSerializer(user).data,
                'requires_second_password_setup': not admin_security.is_second_password_set,
                'already_admin': True
            }, status=status.HTTP_200_OK)
        
        # Prevent making banned users admin
        if user.is_banned:
            return Response({
                'success': False,
                'error': 'Cannot promote banned user to admin'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Store original role for audit
        original_role = user.role
        
        # Change role to admin
        user.role = "admin"
        user.is_staff = True
        user.is_superuser = True
        user.save()
        
        # Create admin security record
        admin_security, created = AdminSecurity.objects.get_or_create(user=user)
        
        # Log the action
        print(f"👑 User {user.name} (ID: {user.id}) promoted from {original_role} to admin by {request.user.name}")
        
        return Response({
            'success': True,
            'message': f'{user.name} has been promoted to admin.',
            'user': UserSerializer(user).data,
            'requires_second_password_setup': not admin_security.is_second_password_set,
            'already_admin': False,
            'original_role': original_role
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error making user admin: {str(e)}")
        return Response({
            'success': False,
            'error': 'Failed to make user admin',
            'details': str(e)
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
                'has_2fa': TOTPDevice.objects.filter(user=user, confirmed=True).exists()
            })
        
        return Response(admin_data)
        
    except Exception as e:
        return Response({
            'error': 'Failed to fetch admin users',
            'details': str(e)
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
            'security': {
                'has_second_password': admin_security.is_second_password_set if admin_security else False,
                'second_password_set_at': admin_security.updated_at if admin_security else None,
                'security_created_at': admin_security.created_at if admin_security else None,
                'has_2fa': TOTPDevice.objects.filter(user=user, confirmed=True).exists(),
                'devices_count': TOTPDevice.objects.filter(user=user, confirmed=True).count()
            },
            'permissions': {
                'groups': list(user.groups.values_list('name', flat=True)),
                'user_permissions': list(user.user_permissions.values_list('codename', flat=True))
            }
        }
        
        return Response(user_data)
        
    except Exception as e:
        return Response({
            'error': 'Failed to fetch admin user details',
            'details': str(e)
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
        
        # Store original role or set to 'user'
        user.role = "user"
        user.is_staff = False
        user.is_superuser = False
        user.save()
        
        # Keep admin security record for audit purposes
        
        return Response({
            'message': f'{user.name} has been demoted to regular user.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"Error removing admin role: {str(e)}")
        return Response({
            'error': 'Failed to remove admin role'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# -------------------- List All Users --------------------
@api_view(['GET'])
@permission_classes([IsAdminUser])
def user_list(request):
    """Get all users for admin dashboard"""
    try:
        users = User.objects.all().order_by('-date_joined')
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    except Exception as e:
        print(f"Error in user_list: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        print(f"Error in simple_user_list: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        return Response({"error": str(e)}, status=500)


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
        
        week_ago = timezone.now() - timedelta(days=7)
        new_users_week = User.objects.filter(date_joined__gte=week_ago).count()
        
        return Response({
            'total_users': total_users,
            'active_users': active_users,
            'banned_users': banned_users,
            'admin_users': admin_users,
            'agent_users': agent_users,
            'regular_users': regular_users,
            'new_users_week': new_users_week
        })
    except Exception as e:
        return Response({
            'error': 'Database error',
            'detail': str(e)
        }, status=500)


# -------------------- Promote to Sub-Admin --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def promote_to_sub_admin(request, user_id):
    if not IsAdminUser(request.user):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    user = get_object_or_404(User, id=user_id)

    if user.role == "admin":
        return Response({'message': f'{user.name} is already an admin.'}, status=status.HTTP_400_BAD_REQUEST)

    user.role = "admin"
    user.save()

    return Response({
        'message': f'{user.name} has been promoted to sub-admin.',
    }, status=status.HTTP_200_OK)


# -------------------- Resend OTP --------------------
@api_view(["POST"])
@permission_classes([AllowAny])
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
        send_mail(
            subject="Your OTP Code",
            message=f"Your verification code is {otp_code}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[identity.identifier],
            fail_silently=False
        )
    else:
        print(f"OTP for {identity.identifier}: {otp_code}")

    return Response({"message": "OTP resent successfully"}, status=200)


# -------------------- User Profile --------------------
class UserProfileView(generics.RetrieveUpdateAPIView):
    authentication_classes = [JWTAuthentication, TokenAuthentication, SessionAuthentication]
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
        
        return Response(serializer.data)


# -------------------- Change Password --------------------
class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)


# -------------------- Forgot Password --------------------
class ForgotPasswordView(generics.GenericAPIView):
    serializer_class = ForgotPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        user = User.objects.get(email=email)
        
        token = secrets.token_urlsafe(50)
        
        PasswordResetToken.objects.filter(user=user).delete()
        
        reset_token = PasswordResetToken.objects.create(user=user, token=token)
        
        reset_link = f"{settings.FRONTEND_RESET_PASSWORD_URL}?token={token}"
        
        send_mail(
            subject="Password Reset Request - Stark",
            message=f"""Hello {user.full_name},

You requested a password reset for your Stark account.

Click the link below to reset your password:
{reset_link}

This link will expire in 24 hours.

If you didn't request this, please ignore this email.

Best regards,
Stark Team""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False
        )
        
        return Response({
            "message": "Password reset link has been sent to your email."
        }, status=status.HTTP_200_OK)


# -------------------- Reset Password --------------------
class ResetPasswordView(generics.GenericAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        
        try:
            reset_token = PasswordResetToken.objects.get(token=token, is_used=False)
        except PasswordResetToken.DoesNotExist:
            return Response({"error": "Invalid or expired reset token."}, status=400)
        
        if reset_token.is_expired():
            return Response({"error": "Reset token has expired."}, status=400)
        
        user = reset_token.user
        user.set_password(new_password)
        user.save()
        
        reset_token.is_used = True
        reset_token.save()
        
        PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
        
        return Response({
            "message": "Password has been reset successfully. You can now login with your new password."
        }, status=status.HTTP_200_OK)


# -------------------- Email Verification --------------------
@api_view(['POST'])
@permission_classes([AllowAny])
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
            return Response({
                "message": "Email verified successfully. Your account is now active.",
                "user": UserSerializer(verified_user).data
            })
        else:
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
                    "error": "Target user is not an admin"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if current user has permission (super admin can set for others)
            if not request.user.is_superuser and request.user.id != target_user.id:
                return Response({
                    "error": "You can only set your own second password"
                }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            second_password = serializer.validated_data['second_password']
            
            # Set up second password
            admin_security = target_user.setup_second_password(second_password)
            
            return Response({
                "message": "Second password set up successfully",
                "user": {
                    "id": target_user.id,
                    "name": target_user.name,
                    "full_name": target_user.full_name
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "error": "Failed to set second password",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
            
            
# -------------------- 2FA Status View --------------------
class TwoFAStatusView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get 2FA status for the current user"""
        try:
            user = request.user
            
            # Check if user has confirmed TOTP devices
            devices = TOTPDevice.objects.filter(user=user, confirmed=True)
            is_2fa_enabled = devices.exists()
            
            # Get backup codes info
            backup_codes_count = 0
            if hasattr(user, 'admin_security') and user.admin_security.backup_codes:
                backup_codes_count = len(user.admin_security.backup_codes)
            
            return Response({
                "success": True,
                "is_2fa_enabled": is_2fa_enabled,
                "devices_count": devices.count(),
                "backup_codes_remaining": backup_codes_count,
                "devices": [
                    {
                        "id": device.id,
                        "name": device.name or "Authenticator App",
                        "confirmed": device.confirmed,
                        "created_at": device.created_at
                    }
                    for device in devices
                ]
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": "Failed to get 2FA status",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
