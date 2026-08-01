from rest_framework import serializers
from wallets.services import WalletService
from .models import User, UserIdentity, OTPCode, AdminSecurity, AdminLoginSession, CustomerCategory, AuditLog, UserLoginSession
import random
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
import secrets
import re
from django.core.exceptions import ValidationError
from django.contrib.auth.hashers import make_password, check_password
from decimal import Decimal
import logging
from .utils.email_service import EmailService

logger = logging.getLogger(__name__)

def _get_user_wallet(user, currency):
    """Helper to fetch a user's wallet by currency."""
    try:
        return WalletService.get_or_create_wallet(user, currency)
    except Exception:
        return None

# -------------------- Customer Category Serializers --------------------

class CustomerCategorySerializer(serializers.ModelSerializer):
    users_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerCategory
        fields = [
            'id', 'name', 'display_name', 'profit_percentage', 
            'description', 'is_active', 'users_count', 'is_default',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'users_count']

    def get_users_count(self, obj):
        return obj.users.count()

class CustomerCategoryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerCategory
        fields = [
            'id', 'name', 'display_name', 'profit_percentage',
            'description', 'is_active', 'is_default'
        ]

class AssignUserCategorySerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    category_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_user_id(self, value):
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")
        return value

    def validate_category_id(self, value):
        if value is not None:
            try:
                CustomerCategory.objects.get(id=value, is_active=True)
            except CustomerCategory.DoesNotExist:
                raise serializers.ValidationError("Category not found or inactive")
        return value

class BulkAssignCategorySerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    category_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class AdminUserDeleteSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")
        return value

# -------------------- Admin Login Serializers --------------------

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

class AdminStep2LoginSerializer(serializers.Serializer):
    session_token = serializers.CharField()
    second_password = serializers.CharField(write_only=True)

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
            raise serializers.ValidationError("Second password not set up for this admin")

        if not user.admin_security.check_second_password(second_password):
            raise serializers.ValidationError("Invalid second password")

        data["session"] = session
        data["user"] = user
        return data

class AdminStep3LoginSerializer(serializers.Serializer):
    session_token = serializers.CharField()
    otp_code = serializers.CharField(max_length=6, required=False, allow_blank=False)
    token = serializers.CharField(max_length=6, required=False, write_only=True)

    def validate(self, data):
        session_token = data["session_token"]
        otp_code = data.get("otp_code") or data.get("token")

        if not otp_code:
            raise serializers.ValidationError("OTP code is required")

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

        otp = OTPCode.objects.filter(
            user=user,
            code=otp_code,
            is_used=False
        ).first()

        if not otp:
            raise serializers.ValidationError("Invalid OTP code")

        if timezone.now() > otp.created_at + timedelta(minutes=5):
            raise serializers.ValidationError("OTP expired")

        data["session"] = session
        data["user"] = user
        data["otp"] = otp
        return data

class SetupSecondPasswordSerializer(serializers.Serializer):
    second_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['second_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords don't match."})
        
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

        if getattr(settings, 'SECOND_PASSWORD_REQUIRE_SYMBOLS', True) and not re.search(r'[!@#$%^&*(),.?":{}|<>]', value):
            raise serializers.ValidationError("Second password must contain at least one special character")
        
        return data

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
    customer_category = serializers.SerializerMethodField()
    category_details = CustomerCategorySerializer(source='category', read_only=True)
    category_assigned_by_name = serializers.CharField(source='category_assigned_by.name', read_only=True, allow_null=True)
    wallet_summary = serializers.SerializerMethodField()  # NEW: Wallet integration
    wallet_balance = serializers.SerializerMethodField()   # NEW: Simple balance for lists

    class Meta:
        model = User
        fields = [
            "id", "full_name", "name", "email", "phone", "role",
            "country", "optional_phone", "agent", "is_verified",
            "is_banned", "agent_code", "connected_agent", "date_joined",
            "last_login", "is_active", "balances", "customer_category",
            "category", "category_details", "category_assigned_at", 
            "category_notes", "category_assigned_by", "category_assigned_by_name",
            "wallet_summary", "wallet_balance"  # NEW fields
        ]
        read_only_fields = ["id", "is_verified", "agent_code", "connected_agent", 
                          "date_joined", "last_login", "category_assigned_at", 
                          "category_assigned_by", "category_assigned_by_name",
                          "wallet_summary", "wallet_balance"]

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
        """Legacy method - kept for backward compatibility"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            wallet_syp = _get_user_wallet(obj, "SYP")
            return {
                "USD": float(wallet_usd.available_balance) if wallet_usd else 0.0,
                "SYP": float(wallet_syp.available_balance) if wallet_syp else 0.0
            }
        except Exception as e:
            logger.error(f"Error getting balances for user {obj.id}: {str(e)}")
        
        return {"USD": 0.0, "SYP": 0.0}

    def get_first_name(self, obj):
        return obj.full_name.split(' ')[0] if obj.full_name else ''

    def get_last_name(self, obj):
        parts = obj.full_name.split(' ')
        return ' '.join(parts[1:]) if len(parts) > 1 else ''

    def get_customer_category(self, obj):
        """Get user's customer category information"""
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
                'display_name': obj.category.display_name,
                'profit_percentage': float(obj.category.profit_percentage),
                'assigned_at': obj.category_assigned_at,
                'assigned_by': obj.category_assigned_by.name if obj.category_assigned_by else None,
                'notes': obj.category_notes
            }
        default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
        if default_cat:
            return {
                'id': default_cat.id,
                'name': default_cat.name,
                'display_name': default_cat.display_name,
                'profit_percentage': float(default_cat.profit_percentage),
                'assigned_at': None,
                'assigned_by': None,
                'notes': 'Using default category'
            }
        return {
            'id': None,
            'name': 'default',
            'display_name': 'Default',
            'profit_percentage': 15.0,
            'assigned_at': None,
            'assigned_by': None,
            'notes': 'No category assigned'
        }

    def get_wallet_summary(self, obj):
        """Get comprehensive wallet summary for the user"""
        try:
            wallet_data = WalletService.get_wallet_data(obj)
            return {
                'USD': {
                    'available': float(Decimal(str(wallet_data['USD']['available']))),
                    'pending': float(Decimal(str(wallet_data['USD']['pending']))),
                    'total': float(Decimal(str(wallet_data['USD']['total'])))
                },
                'SYP': {
                    'available': float(Decimal(str(wallet_data['SYP']['available']))),
                    'pending': float(Decimal(str(wallet_data['SYP']['pending']))),
                    'total': float(Decimal(str(wallet_data['SYP']['total'])))
                },
                'exchange_rate': wallet_data.get('exchange_rate'),
                'rate_available': wallet_data.get('rate_available', False),
                'quote_id': wallet_data.get('quote_id'),
                'quote_version': wallet_data.get('quote_version'),
                'equivalents': wallet_data.get('equivalents', {}),
            }
        except Exception as e:
            logger.error(f"Error getting wallet summary for user {obj.id}: {str(e)}")
        
        return None

    def get_wallet_balance(self, obj):
        """Get simple wallet balance for lists and admin views"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            if wallet_usd:
                return {
                    'available': float(wallet_usd.available_balance),
                    'pending': float(wallet_usd.pending_balance),
                    'total': float(wallet_usd.total_balance)
                }
        except Exception as e:
            logger.error(f"Error getting wallet balance for user {obj.id}: {str(e)}")
        
        return {'available': 0.0, 'pending': 0.0, 'total': 0.0}

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

        user.save()  # This will trigger automatic wallet creation via User.save() method

        # Assign default customer category if one exists and user has no category
        try:
            default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
            if default_cat:
                user.category = default_cat
                user.category_assigned_by = None
                user.category_assigned_at = None
                user.save()
        except Exception:
            # Fail silently if categories table not available or other issue
            pass

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

        # Send OTP via email using templated service
        if provider in ["email", "google"]:
            EmailService.send_otp_email(user=user, otp_code=otp_code, purpose='verification')

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
class UserLoginOTPSerializer(serializers.Serializer):
    session_token = serializers.CharField()
    otp_code = serializers.CharField(max_length=6, required=False, allow_blank=False)
    token = serializers.CharField(max_length=6, required=False, write_only=True)

    def validate(self, data):
        session_token = data["session_token"]
        otp_code = data.get("otp_code") or data.get("token")

        if not otp_code:
            raise serializers.ValidationError("OTP code is required")

        try:
            session = UserLoginSession.objects.get(
                session_token=session_token,
                otp_sent=True,
                otp_verified=False
            )
        except UserLoginSession.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired session")

        if session.is_expired():
            session.delete()
            raise serializers.ValidationError("Session expired")

        user = session.user

        otp = OTPCode.objects.filter(
            user=user,
            code=otp_code,
            is_used=False
        ).first()

        if not otp:
            raise serializers.ValidationError("Invalid OTP code")

        if timezone.now() > otp.created_at + timedelta(minutes=5):
            raise serializers.ValidationError("OTP expired")

        data["session"] = session
        data["user"] = user
        data["otp"] = otp
        return data 
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
    customer_category = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()  # NEW

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
            "customer_category",
            "wallet_balance"  # NEW
        ]

    def get_users_count(self, obj):
        return obj.subordinates.count() if hasattr(obj, "subordinates") else 0

    def get_balance(self, obj):
        """Legacy method - kept for backward compatibility"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            wallet_syp = _get_user_wallet(obj, "SYP")
            return {
                "USD": float(wallet_usd.available_balance) if wallet_usd else 0.0,
                "SYP": float(wallet_syp.available_balance) if wallet_syp else 0.0
            }
        except Exception:
            pass
        return {"USD": 0.0, "SYP": 0.0}

    def get_status(self, obj):
        return "Banned" if getattr(obj, "is_banned", False) else "Active"

    def get_customer_category(self, obj):
        """Get agent's customer category information"""
        if obj.category:
            return obj.category.display_name
        return "Default"

    def get_wallet_balance(self, obj):
        """Get wallet balance for agent"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            if wallet_usd:
                return {
                    'available_usd': float(wallet_usd.available_balance),
                    'total_usd': float(wallet_usd.total_balance)
                }
        except Exception as e:
            logger.error(f"Error getting wallet balance for agent {obj.id}: {str(e)}")
        
        return {'available_usd': 0.0, 'total_usd': 0.0}

# -------------------- Subordinate User Serializer --------------------
class SubordinateUserSerializer(serializers.ModelSerializer):
    customer_category = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()  # NEW
    
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
            "is_banned",
            "customer_category",
            "wallet_balance"  # NEW
        ]
        read_only_fields = fields

    def get_customer_category(self, obj):
        """Get subordinate's customer category"""
        if obj.category:
            return obj.category.display_name
        return "Default"

    def get_wallet_balance(self, obj):
        """Get wallet balance for subordinate"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            if wallet_usd:
                return {
                    'available_usd': float(wallet_usd.available_balance),
                    'total_usd': float(wallet_usd.total_balance)
                }
        except Exception as e:
            logger.error(f"Error getting wallet balance for subordinate {obj.id}: {str(e)}")
        
        return {'available_usd': 0.0, 'total_usd': 0.0}

# -------------------- User Profile Serializer --------------------
class UserProfileSerializer(serializers.ModelSerializer):
    connected_agent = serializers.SerializerMethodField()
    agent_users = serializers.SerializerMethodField()
    balances = serializers.SerializerMethodField()
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    customer_category = serializers.SerializerMethodField()
    user_final_price_multiplier = serializers.SerializerMethodField()
    category_details = CustomerCategorySerializer(source='category', read_only=True)
    wallet_summary = serializers.SerializerMethodField()  # NEW

    class Meta:
        model = User
        fields = [
            "id", "full_name", "first_name", "last_name", "name", "email", "phone", "role",
            "country", "optional_phone", "is_banned", "agent_code", "avatar",
            "connected_agent", "agent_users", "balances", "currency_preference", "avatar_url",
            "customer_category", "user_final_price_multiplier", "category_details",
            "category", "category_assigned_at", "category_notes",
            "wallet_summary"  # NEW
        ]
        read_only_fields = ["id", "role", "agent_code", "connected_agent", "agent_users", 
                          "is_banned", "category_assigned_at", "wallet_summary"]

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
        """Legacy method - kept for backward compatibility"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            wallet_syp = _get_user_wallet(obj, "SYP")
            return {
                "USD": float(wallet_usd.available_balance) if wallet_usd else 0.0,
                "SYP": float(wallet_syp.available_balance) if wallet_syp else 0.0
            }
        except Exception:
            pass
        return {}

    def get_avatar_url(self, obj):
        if obj.avatar:
            return obj.avatar.url
        return None

    def get_customer_category(self, obj):
        """Get user's customer category information"""
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
                'display_name': obj.category.display_name,
                'profit_percentage': float(obj.category.profit_percentage),
                'assigned_at': obj.category_assigned_at,
                'assigned_by': obj.category_assigned_by.name if obj.category_assigned_by else None,
                'notes': obj.category_notes
            }
        default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
        if default_cat:
            return {
                'id': default_cat.id,
                'name': default_cat.name,
                'display_name': default_cat.display_name,
                'profit_percentage': float(default_cat.profit_percentage),
                'assigned_at': None,
                'assigned_by': None,
                'notes': 'Using default category'
            }
        return {
            'id': None,
            'name': 'default',
            'display_name': 'Default',
            'profit_percentage': 15.0,
            'assigned_at': None,
            'assigned_by': None,
            'notes': 'No category assigned'
        }

    def get_user_final_price_multiplier(self, obj):
        """Get the multiplier for calculating final prices for this user"""
        try:
            profit_percentage = obj.effective_profit_percentage
            multiplier = 1 + (profit_percentage / Decimal('100'))
            return float(multiplier)
        except Exception:
            return 1.0

    def get_wallet_summary(self, obj):
        """Get detailed wallet summary for profile"""
        try:
            wallet_data = WalletService.get_wallet_data(obj)
            wallet_usd = _get_user_wallet(obj, "USD")
            wallet_syp = _get_user_wallet(obj, "SYP")
            return {
                'available_usd': float(wallet_usd.available_balance) if wallet_usd else 0.0,
                'pending_usd': float(wallet_usd.pending_balance) if wallet_usd else 0.0,
                'total_usd': float(wallet_usd.total_balance) if wallet_usd else 0.0,
                'available_syp': float(wallet_syp.available_balance) if wallet_syp else 0.0,
                'pending_syp': float(wallet_syp.pending_balance) if wallet_syp else 0.0,
                'total_syp': float(wallet_syp.total_balance) if wallet_syp else 0.0,
                'rate_available': wallet_data.get('rate_available', False),
                'quote_id': wallet_data.get('quote_id'),
                'quote_version': wallet_data.get('quote_version'),
                'equivalents': wallet_data.get('equivalents', {}),
            }
        except Exception as e:
            logger.error(f"Error getting wallet summary for user {obj.id}: {str(e)}")
        return None

    def validate(self, data):
        """Validate profile data including currency preference"""
        # Validate currency preference
        if 'currency_preference' in data:
            valid_currencies = ['USD', 'SYP']
            if data['currency_preference'] not in valid_currencies:
                raise serializers.ValidationError({
                    'currency_preference': f'Must be one of: {", ".join(valid_currencies)}'
                })
        
        return super().validate(data)

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
        current_password = validated_data.pop('current_password', None)
        new_password = validated_data.pop('new_password', None)
        current_second_password = validated_data.pop('current_second_password', None)
        new_second_password = validated_data.pop('new_second_password', None)

        instance = super().update(instance, validated_data)

        if new_password:
            instance.set_password(new_password)
            instance.save()

        if new_second_password:
            admin_security = instance.admin_security
            admin_security.set_second_password(new_second_password)

        return instance

# -------------------- Audit Log Serializer --------------------
class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True, allow_null=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_name', 'user_email', 'action',
            'resource_type', 'resource_id', 'details', 'ip_address',
            'user_agent', 'created_at'
        ]
        read_only_fields = fields

# -------------------- User List Serializer (Optimized) --------------------
class UserListSerializer(serializers.ModelSerializer):
    balances = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()
    customer_category = serializers.SerializerMethodField()
    category_details = CustomerCategorySerializer(source='category', read_only=True)
    category_assigned_by_name = serializers.CharField(source='category_assigned_by.name', read_only=True, allow_null=True)
    wallet_balance = serializers.SerializerMethodField()  # NEW
    
    class Meta:
        model = User
        fields = [
            "id", "full_name", "name", "email", "phone", "role",
            "country", "is_banned", "date_joined", "last_login",
            "is_active", "balances", "is_verified", "customer_category",
            "category", "category_details", "category_assigned_at", 
            "category_notes", "category_assigned_by", "category_assigned_by_name",
            "agent_code", "wallet_balance"  # NEW
        ]
    
    def get_balances(self, obj):
        """Legacy method - kept for backward compatibility"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            wallet_syp = _get_user_wallet(obj, "SYP")
            return {
                "USD": float(wallet_usd.available_balance) if wallet_usd else 0.0,
                "SYP": float(wallet_syp.available_balance) if wallet_syp else 0.0
            }
        except Exception:
            pass
        return {"USD": 0.0, "SYP": 0.0}
    
    def get_is_verified(self, obj):
        if hasattr(obj, 'prefetched_identities'):
            return any(identity.is_verified for identity in obj.prefetched_identities)
        return False
    
    def get_customer_category(self, obj):
        if hasattr(obj, 'category'):
            if obj.category:
                return obj.category.display_name
            default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
            if default_cat:
                return default_cat.display_name
            return "Default"
        default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
        if default_cat:
            return default_cat.display_name
        return "Default"

    def get_wallet_balance(self, obj):
        """Get wallet balance for admin list view"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            if wallet_usd:
                return {
                    'available': float(wallet_usd.available_balance),
                    'pending': float(wallet_usd.pending_balance),
                    'total': float(wallet_usd.total_balance)
                }
        except Exception as e:
            logger.error(f"Error getting wallet balance for user {obj.id}: {str(e)}")
        
        return {'available': 0.0, 'pending': 0.0, 'total': 0.0}

# -------------------- Simple User List Serializer (for dropdowns) --------------------
class SimpleUserSerializer(serializers.ModelSerializer):
    wallet_balance = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            "id", "full_name", "name", "email", "phone", "role",
            "is_active", "wallet_balance"
        ]
    
    def get_wallet_balance(self, obj):
        """Get simple wallet balance"""
        try:
            wallet_usd = _get_user_wallet(obj, "USD")
            if wallet_usd:
                return float(wallet_usd.available_balance)
        except Exception:
            pass
        return 0.0
