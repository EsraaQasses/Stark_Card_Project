from rest_framework import serializers
from wallets.models import Wallet
from .models import User, UserIdentity, OTPCode, AdminSecurity, AdminLoginSession
import random
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
import secrets
import re
from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import make_password, check_password



# -------------------- Admin Login Serializers --------------------

# -------------------- Admin Step 1 Serializer --------------------
class AdminStep1LoginSerializer(serializers.Serializer):
    name = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        try:
            user = User.objects.get(name=data["name"])
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        if not user.check_password(data["password"]):
            raise serializers.ValidationError("Invalid credentials")

        if user.role != "admin":
            raise serializers.ValidationError("Not an admin user")

        if not user.is_active:
            raise serializers.ValidationError("Account is inactive")

        # Check if admin security is set up
        if not hasattr(user, 'admin_security'):
            admin_security = AdminSecurity.objects.create(user=user)
        else:
            admin_security = user.admin_security

        data["user"] = user
        data["admin_security"] = admin_security
        return data

# -------------------- Admin Step 2 Serializer --------------------
class AdminStep2LoginSerializer(serializers.Serializer):
    session_token = serializers.CharField()
    second_password = serializers.CharField(write_only=True)

    # *** NOTE: The validate_second_password method has been removed as requested ***
    #           Password complexity rules should only be applied in the
    #           SetupSecondPasswordSerializer.

    def validate(self, data):
        session_token = data["session_token"]
        second_password = data["second_password"]

        try:
            session = AdminLoginSession.objects.get(
                session_token=session_token,
                step_1_completed=True,
                step_2_completed=False
            )
        except AdminLoginSession.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired session")

        if session.is_expired():
            session.delete()
            raise serializers.ValidationError("Session expired")

        user = session.user
        
        if not hasattr(user, 'admin_security') or not user.admin_security.is_second_password_set:
            # Note: This is a critical check for step 2.
            raise serializers.ValidationError("Second password not set up for this admin")

        if not user.admin_security.check_second_password(second_password):
            raise serializers.ValidationError("Invalid second password")

        data["session"] = session
        data["user"] = user
        return data

# -------------------- Admin Step 3 Serializer --------------------
class AdminStep3LoginSerializer(serializers.Serializer):
    session_token = serializers.CharField()
    token = serializers.CharField(max_length=6)

    def validate(self, data):
        session_token = data["session_token"]
        token = data["token"]

        try:
            session = AdminLoginSession.objects.get(
                session_token=session_token,
                step_1_completed=True,
                step_2_completed=True,
                step_3_completed=False
            )
        except AdminLoginSession.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired session")

        if session.is_expired():
            session.delete()
            raise serializers.ValidationError("Session expired")

        user = session.user
        admin_security = user.admin_security
        
        validation_success = False
        
        # 1. Check for 2FA/TOTP first
        if admin_security.is_2fa_enabled:
            # Use the new verify_totp method
            validation_success = admin_security.verify_totp(token)
        
        # 2. Fallback to Email OTP
        elif getattr(settings, 'ADMIN_OTP_REQUIRED', True):
            otp = OTPCode.objects.filter(
                user=user, 
                code=token, 
                is_used=False
            ).order_by('-created_at').first()

            otp_expiry_minutes = getattr(settings, 'ADMIN_OTP_EXPIRY_MINUTES', 5)
            if otp and timezone.now() <= otp.created_at + timedelta(minutes=otp_expiry_minutes):
                validation_success = True
                otp.is_used = True
                otp.save()
        
        if not validation_success:
            raise serializers.ValidationError("Invalid authentication token")

        data["session"] = session
        data["user"] = user
        return data

# -------------------- Setup Second Password Serializer --------------------
class SetupSecondPasswordSerializer(serializers.Serializer):
    second_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['second_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords don't match."})
        
        # --- START Re-implemented Second Password Complexity Validation ---
        value = data['second_password']
        
        if len(value) < getattr(settings, 'SECOND_PASSWORD_MIN_LENGTH', 8):
            raise serializers.ValidationError(
                f"Second password must be at least {getattr(settings, 'SECOND_PASSWORD_MIN_LENGTH', 8)} characters long"
            )

        if getattr(settings, 'SECOND_PASSWORD_REQUIRE_UPPERCASE', True) and not re.search(r'[A-Z]', value):
            raise serializers.ValidationError("Second password must contain at least one uppercase letter")

        if getattr(settings, 'SECOND_PASSWORD_REQUIRE_LOWERCASE', True) and not re.search(r'[a-z]', value):
            raise serializers.ValidationError("Second password must contain at least one lowercase letter")

        if getattr(settings, 'SECOND_PASSWORD_REQUIRE_NUMBERS', True) and not re.search(r'[0-9]', value):
            raise serializers.ValidationError("Second password must contain at least one number")

        # Note: You need to define the full symbol regex if you want to be stricter than just one symbol.
        if getattr(settings, 'SECOND_PASSWORD_REQUIRE_SYMBOLS', True) and not re.search(r'[!@#$%^&*(),.?":{}|<>]', value):
            raise serializers.ValidationError("Second password must contain at least one special character")
        
        # --- END Re-implemented Second Password Complexity Validation ---
        
        return data



# -------------------- Admin Login (Legacy) --------------------
class AdminLoginSerializer(serializers.Serializer):
    name = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        try:
            user = User.objects.get(name=data["name"])
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        if not user.check_password(data["password"]):
            raise serializers.ValidationError("Invalid credentials")

        if user.role != "admin":
            raise serializers.ValidationError("Not an admin user")

        if not user.is_active:
            raise serializers.ValidationError("Account is inactive")

        data["user"] = user
        return data


# -------------------- User Serializer --------------------
class UserSerializer(serializers.ModelSerializer):
    is_verified = serializers.SerializerMethodField()
    connected_agent = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    last_login = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True, allow_null=True)
    balances = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "full_name", "name", "email", "phone", "role",
            "country", "optional_phone", "agent", "is_verified",
            "is_banned", "agent_code", "connected_agent", "date_joined",
            "last_login", "is_active", "balances"
        ]
        read_only_fields = ["id", "is_verified", "agent_code", "connected_agent", "date_joined", "last_login"]

    def get_is_verified(self, obj):
        return obj.identities.filter(is_verified=True).exists()

    def get_connected_agent(self, obj):
        if obj.agent:
            return {
                "id": obj.agent.id,
                "full_name": obj.agent.full_name,
                "agent_code": obj.agent.agent_code
            }
        return None

    def get_balances(self, obj):
        try:
            from wallets.models import Wallet
            wallets = Wallet.objects.filter(user=obj)
            balances = {}
            for wallet in wallets:
                # FIX: Change 'balance' to 'total_balance'
                balances[wallet.currency] = float(wallet.total_balance)
            return balances
        except Exception as e:
            print(f"Error getting balances for user {obj.id}: {str(e)}")
            return {"USD": 0.0, "SYP": 0.0}
        
    def get_first_name(self, obj):
        return obj.full_name.split(' ')[0] if obj.full_name else ''

    def get_last_name(self, obj):
        parts = obj.full_name.split(' ')
        return ' '.join(parts[1:]) if len(parts) > 1 else ''


# -------------------- Register Serializer --------------------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    provider = serializers.ChoiceField(choices=["email", "phone", "google"])
    agent_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "full_name", "name", "email", "phone", "password",
            "country", "optional_phone", "role", "provider", "agent_code"
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        provider = validated_data.pop("provider")
        agent_code = validated_data.pop("agent_code", None)

        user = User(**validated_data)
        user.set_password(password)
        user.is_active = False  # User inactive until OTP verification

        # Link user to agent if code provided
        if agent_code:
            try:
                agent = User.objects.get(agent_code=agent_code, role="agent")
                user.agent = agent
            except User.DoesNotExist:
                raise serializers.ValidationError({"agent_code": "Invalid agent code"})

        user.save()

        identifier = user.email if provider in ["email", "google"] else user.phone

        # Create user identity (not verified initially)
        UserIdentity.objects.create(
            user=user,
            provider=provider,
            identifier=identifier,
            is_verified=False
        )

        # ✅ CRITICAL: ALWAYS CREATE OTP FOR VERIFICATION
        otp_code = str(random.randint(100000, 999999))
        OTPCode.objects.create(user=user, code=otp_code)

        # Send OTP via email
        if provider in ["email", "google"]:
            send_mail(
                subject="Your Stark Account Verification Code",
                message=f"""Welcome to Stark!

Your verification code is: {otp_code}

Enter this code in the app to verify your email address and activate your account.

This code will expire in 5 minutes.

Best regards,
Stark Team""",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False
            )

        return user


# -------------------- User Login Serializer --------------------
class UserLoginSerializer(serializers.Serializer):
    name = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        try:
            user = User.objects.get(name=data["name"])
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        if not user.check_password(data["password"]):
            raise serializers.ValidationError("Invalid credentials")

        if user.role == "admin":
            raise serializers.ValidationError("Admins must login from admin portal")

        if not user.identities.filter(is_verified=True).exists():
            raise serializers.ValidationError("Account not verified")

        if user.is_banned:
            raise serializers.ValidationError("Account is banned")

        data["user"] = user
        return data


# -------------------- Verify OTP Serializer --------------------
class VerifyOTPSerializer(serializers.Serializer):
    name = serializers.CharField()
    otp_code = serializers.CharField(max_length=6)

    def validate(self, data):
        try:
            user = User.objects.get(name=data["name"])
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        otp = OTPCode.objects.filter(user=user, code=data["otp_code"], is_used=False).first()

        if not otp:
            raise serializers.ValidationError("Invalid OTP")

        if timezone.now() > otp.created_at + timedelta(minutes=5):
            raise serializers.ValidationError("OTP expired")

        identity = user.identities.first()
        if identity:
            identity.is_verified = True
            identity.save()

        user.is_active = True
        user.save()

        otp.is_used = True
        otp.save()

        data["user"] = user
        return data


# -------------------- Agent Serializer --------------------
class AgentUserSerializer(serializers.ModelSerializer):
    users_count = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "phone",
            "country",
            "users_count",
            "status",
            "balance",
        ]

    def get_users_count(self, obj):
        # عدد العملاء التابعين لهذا المستخدم إذا كان وكيل
        return obj.subordinates.count() if hasattr(obj, "subordinates") else 0

    def get_balance(self, obj):
        # نجلب رصيد المستخدم من محفظته (USD و SYP)
        wallets = Wallet.objects.filter(user=obj)
        balances = {}
        for w in wallets:
            balances[w.currency.upper()] = float(w.balance)
        # إذا ما عنده محفظة نرجع صفر
        if not balances:
            balances = {"USD": 0.0, "SYP": 0.0}
        return balances

    def get_status(self, obj):
        return "Banned" if getattr(obj, "is_banned", False) else "Active"


# -------------------- Subordinate User Serializer --------------------
class SubordinateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "name",
            "email",
            "phone",
            "role",
            "country",
            "optional_phone",
            "is_banned"
        ]
        read_only_fields = fields


# -------------------- User Profile Serializer --------------------
class UserProfileSerializer(serializers.ModelSerializer):
    connected_agent = serializers.SerializerMethodField()
    agent_users = serializers.SerializerMethodField()
    balances = serializers.SerializerMethodField()
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "full_name", "first_name", "last_name", "name", "email", "phone", "role",
            "country", "optional_phone", "is_banned", "agent_code", "avatar",
            "connected_agent", "agent_users", "balances", "currency_preference", "avatar_url"
        ]
        read_only_fields = ["id", "role", "agent_code", "connected_agent", "agent_users", "is_banned"]

    def get_first_name(self, obj):
        return obj.full_name.split(' ')[0] if obj.full_name else ''

    def get_last_name(self, obj):
        parts = obj.full_name.split(' ')
        return ' '.join(parts[1:]) if len(parts) > 1 else ''

    def get_connected_agent(self, obj):
        if obj.agent:
            return {
                "id": obj.agent.id,
                "full_name": obj.agent.full_name,
                "agent_code": obj.agent.agent_code
            }
        return None

    def get_agent_users(self, obj):
        if obj.role == "agent":
            return [
                {
                    "id": u.id,
                    "full_name": u.full_name,
                    "first_name": u.full_name.split(' ')[0] if u.full_name else '',
                    "last_name": ' '.join(u.full_name.split(' ')[1:]) if len(u.full_name.split(' ')) > 1 else '',
                    "name": u.name,
                    "email": u.email,
                    "phone": u.phone,
                } for u in obj.subordinates.all()
            ]
        return []

    def get_balances(self, obj):
        wallets = Wallet.objects.filter(user=obj)
        # FIX: Change 'balance' to 'total_balance'
        return {wallet.currency: float(wallet.total_balance) for wallet in wallets} if wallets else {}

    def get_avatar_url(self, obj):
        if obj.avatar:
            return obj.avatar.url
        return None

    def update(self, instance, validated_data):
        email = validated_data.get('email', instance.email)
        if email and email != instance.email:
            if User.objects.filter(email=email).exclude(id=instance.id).exists():
                raise serializers.ValidationError({"email": "This email is already taken."})

        phone = validated_data.get('phone', instance.phone)
        if phone and phone != instance.phone:
            if User.objects.filter(phone=phone).exclude(id=instance.id).exists():
                raise serializers.ValidationError({"phone": "This phone number is already taken."})

        name = validated_data.get('name', instance.name)
        if name and name != instance.name:
            if User.objects.filter(name=name).exclude(id=instance.id).exists():
                raise serializers.ValidationError({"name": "This username is already taken."})

        return super().update(instance, validated_data)
    
    
# -------------------- Change Password Serializer --------------------
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, min_length=6, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords don't match."})
        return data

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
    
    
# -------------------- Forgot Password Serializer --------------------
class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("No user found with this email address.")
        return value
    
    
# -------------------- Reset Password Serializer --------------------
class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=6, write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords don't match."})
        return data
    
    
# -------------------- Admin Profile Update Serializer --------------------
class AdminProfileUpdateSerializer(serializers.ModelSerializer):
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False, min_length=6)
    current_second_password = serializers.CharField(write_only=True, required=False)
    new_second_password = serializers.CharField(write_only=True, required=False, min_length=8)
    
    class Meta:
        model = User
        fields = [
            "full_name", "name", "email", "current_password", "new_password",
            "current_second_password", "new_second_password"
        ]

    def validate(self, data):
        user = self.instance
        request = self.context.get('request')
        
        # Check if email is being changed and validate uniqueness
        if 'email' in data and data['email'] != user.email:
            if User.objects.filter(email=data['email']).exclude(id=user.id).exists():
                raise serializers.ValidationError({"email": "This email is already taken."})

        # Check if username is being changed and validate uniqueness
        if 'name' in data and data['name'] != user.name:
            if User.objects.filter(name=data['name']).exclude(id=user.id).exists():
                raise serializers.ValidationError({"name": "This username is already taken."})

        # Validate password change
        if data.get('new_password'):
            if not data.get('current_password'):
                raise serializers.ValidationError({
                    "current_password": "Current password is required to set a new password."
                })
            if not user.check_password(data['current_password']):
                raise serializers.ValidationError({
                    "current_password": "Current password is incorrect."
                })

        # Validate second password change
        if data.get('new_second_password'):
            if not data.get('current_second_password'):
                raise serializers.ValidationError({
                    "current_second_password": "Current second password is required to set a new second password."
                })
            
            # Check if user has admin security setup
            if not hasattr(user, 'admin_security') or not user.admin_security.is_second_password_set:
                raise serializers.ValidationError({
                    "current_second_password": "Second password is not set up for this account."
                })
            
            if not user.admin_security.check_second_password(data['current_second_password']):
                raise serializers.ValidationError({
                    "current_second_password": "Current second password is incorrect."
                })

        return data

    def update(self, instance, validated_data):
        # Remove password fields from validated_data to handle separately
        current_password = validated_data.pop('current_password', None)
        new_password = validated_data.pop('new_password', None)
        current_second_password = validated_data.pop('current_second_password', None)
        new_second_password = validated_data.pop('new_second_password', None)

        # Update basic profile fields
        instance = super().update(instance, validated_data)

        # Update main password if provided
        if new_password:
            instance.set_password(new_password)
            instance.save()

        # Update second password if provided
        if new_second_password:
            admin_security = instance.admin_security
            admin_security.set_second_password(new_second_password)

        return instance
    
    
# -------------------- 2FA Setup Serializer --------------------
class Setup2FASerializer(serializers.Serializer):
    token = serializers.CharField(max_length=6, min_length=6)

    def validate(self, data):
        user = self.context['request'].user
        token = data['token']
        
        if not hasattr(user, 'admin_security'):
            raise serializers.ValidationError("Admin security not set up")
        
        # Use the new verify_totp method
        if not user.admin_security.verify_totp(token):
            raise serializers.ValidationError("Invalid 2FA token")
        
        data['user'] = user
        return data

# -------------------- 2FA Verification Serializer --------------------
class Verify2FASerializer(serializers.Serializer):
    session_token = serializers.CharField()
    token = serializers.CharField(max_length=6, min_length=6)

    def validate(self, data):
        session_token = data["session_token"]
        token = data["token"]

        try:
            session = AdminLoginSession.objects.get(
                session_token=session_token,
                step_1_completed=True,
                step_2_completed=True,
                step_3_completed=False
            )
        except AdminLoginSession.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired session")

        if session.is_expired():
            session.delete()
            raise serializers.ValidationError("Session expired")

        user = session.user
        
        if not hasattr(user, 'admin_security') or not user.admin_security.is_2fa_enabled:
            raise serializers.ValidationError("2FA not enabled for this account")

        if not user.admin_security.verify_totp(token):
            raise serializers.ValidationError("Invalid 2FA token")

        data["session"] = session
        data["user"] = user
        return data
