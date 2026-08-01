from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core.validators import RegexValidator
from django.utils import timezone
from .validators import validate_avatar_size, validate_avatar_extension, validate_avatar_dimensions
from django.contrib.auth.hashers import make_password, check_password
from decimal import Decimal
from datetime import timedelta
import random
import string
import logging

logger = logging.getLogger(__name__)

def generate_agent_code():
    """Generate a unique agent code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


class CustomerCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=100)
    profit_percentage = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        default=0.00,
        help_text="Profit percentage added to product prices for this category"
    )
    is_default = models.BooleanField(default=False, help_text="Marks this category as the default assigned to newly created users")
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer Category"
        verbose_name_plural = "Customer Categories"
        ordering = ['name']
        indexes = [
            models.Index(fields=['profit_percentage']),
        ]

    def __str__(self):
        return f"{self.display_name} ({self.profit_percentage}%)"

    def save(self, *args, **kwargs):
        """Ensure only one category is marked as default at a time."""
        creating_default = self.is_default
        super().save(*args, **kwargs)
        if creating_default:
            # unset is_default on other categories
            CustomerCategory.objects.exclude(id=self.id).filter(is_default=True).update(is_default=False)


class UserManager(BaseUserManager):
    def create_user(self, name, password=None, email=None, phone=None, role="user", **extra_fields):
        if not name:
            raise ValueError("Users must have a name")

        email = self.normalize_email(email) if email else None
        user = self.model(
            name=name,
            email=email,
            phone=phone,
            role=role,
            **extra_fields
        )
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, name, password=None, email=None, phone=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(name, password, email, phone, role="admin", **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("agent", "Agent"),
        ("user", "User"),
    )
    CURRENCY_CHOICES = (
        ("USD", "US Dollar"),
        ("SYP", "Syrian Pound"),
    )
    
    # Add date_joined field
    date_joined = models.DateTimeField(default=timezone.now)
    
    full_name = models.CharField(max_length=255)
    avatar = models.ImageField(
        upload_to='avatars/%Y/%m/%d/',
        null=True,
        blank=True,
        validators=[validate_avatar_size, validate_avatar_extension, validate_avatar_dimensions],
        help_text="User profile picture"
    )
    name = models.CharField(max_length=255, unique=True) #Username
    email = models.EmailField(unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    country = models.CharField(max_length=100, null=True, blank=True)
    optional_phone = models.CharField(max_length=20, null=True, blank=True)
    is_banned = models.BooleanField(default=False) 
    currency_preference = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="USD")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    auth_version = models.PositiveIntegerField(default=1)

    agent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="subordinates")

    agent_code = models.CharField(max_length=10, unique=True, null=True, blank=True)

    # NEW: Customer Category fields
    category = models.ForeignKey(
        CustomerCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    category_assigned_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_categories'
    )
    category_assigned_at = models.DateTimeField(null=True, blank=True)
    category_notes = models.TextField(blank=True, null=True)

    objects = UserManager()
    USERNAME_FIELD = "name"
    REQUIRED_FIELDS = []


# users/models.py - Update User model save method
    def save(self, *args, **kwargs):
        is_new = self.pk is None
        role_changed = False
        
        if not is_new:
            try:
                old_user = User.objects.get(pk=self.pk)
                role_changed = old_user.role != self.role
            except User.DoesNotExist:
                pass
        
        # If promoted to agent, disconnect from any existing agent
        if role_changed and self.role == "agent":
            self.agent = None

        # Save user first
        super().save(*args, **kwargs)
        
        # Create wallet for new users
        if is_new:
            try:
                from wallets.models import Wallet
                wallet_usd, _ = Wallet.objects.get_or_create(user=self, currency="USD")
                wallet_syp, _ = Wallet.objects.get_or_create(user=self, currency="SYP")
                wallet_usd.update_balances()
                wallet_syp.update_balances()
                logger.info(f"Created wallets for new user: {self.name}")
            except Exception as e:
                logger.error(f"Failed to create wallet for user {self.id}: {str(e)}")
        
        # Generate agent code when promoted to agent
        if role_changed and self.role == "agent" and not self.agent_code:
            self.agent_code = generate_agent_code()
            super().save(update_fields=['agent_code'])
            
            # Create agent profile if not exists
            try:
                from agents.models import AgentProfile
                AgentProfile.objects.get_or_create(user=self)
            except Exception as e:
                logger.error(f"Failed to create agent profile for {self.id}: {str(e)}")
    def __str__(self):
        return f"{self.name} ({self.role})"
    
    def setup_second_password(self, second_password):
        """Set up second password for admin"""
        if self.role != "admin":
            raise ValueError("Only admin users can set up second password")
        
        admin_security, created = AdminSecurity.objects.get_or_create(user=self)
        admin_security.set_second_password(second_password)
        return admin_security

    def check_second_password(self, second_password):
        """Check second password for admin"""
        if not hasattr(self, 'admin_security') or not self.admin_security.is_second_password_set:
            return False
        return self.admin_security.check_second_password(second_password)

    # NEW: Category-related methods
    @property
    def effective_profit_percentage(self):
        """Get the effective profit percentage for this user"""
        if self.category and self.category.is_active:
            return self.category.profit_percentage
        
        default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
        if default_cat:
            return default_cat.profit_percentage
        
        return Decimal('20.00')

    @property
    def customer_category_display(self):
        """Get category display name"""
        if self.category:
            return self.category.display_name
        default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
        if default_cat:
            return default_cat.display_name
        return "Default"

    def assign_category(self, category, assigned_by, notes=""):
        """Assign category to user"""
        self.category = category
        self.category_assigned_by = assigned_by
        self.category_assigned_at = timezone.now()
        self.category_notes = notes
        self.save()

    def remove_category(self):
        """Remove category assignment"""
        self.category = None
        self.category_assigned_by = None
        self.category_assigned_at = None
        self.category_notes = ""
        self.save()


class AdminSecurity(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_security")
    second_password = models.CharField(max_length=128, null=True, blank=True)
    is_second_password_set = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Admin Security for {self.user.name}"

    def check_second_password(self, second_password):
        if not self.second_password or not self.is_second_password_set:
            return False
        return check_password(second_password, self.second_password)

    def set_second_password(self, second_password):
        self.second_password = make_password(second_password)
        self.is_second_password_set = True
        self.save()


class PasswordResetChallenge(models.Model):
    PURPOSE_PASSWORD_RESET = "password_reset"
    PURPOSE_CHOICES = ((PURPOSE_PASSWORD_RESET, "Password reset"),)

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_challenges")
    request_id = models.CharField(max_length=128, unique=True)
    code_hash = models.CharField(max_length=256)
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES, default=PURPOSE_PASSWORD_RESET)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    resend_available_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    verified_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "purpose", "consumed_at", "expires_at"]),
            models.Index(fields=["request_id", "purpose"]),
        ]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_locked(self):
        return self.locked_at is not None or self.attempts >= self.max_attempts


class PasswordResetAuthorization(models.Model):
    PURPOSE_PASSWORD_RESET = "password_reset"
    PURPOSE_CHOICES = ((PURPOSE_PASSWORD_RESET, "Password reset"),)

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_authorizations")
    token_hash = models.CharField(max_length=256, unique=True)
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES, default=PURPOSE_PASSWORD_RESET)
    challenge = models.ForeignKey(PasswordResetChallenge, on_delete=models.CASCADE, related_name="authorizations")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "purpose", "consumed_at", "expires_at"])]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


class UserIdentity(models.Model):
    PROVIDER_CHOICES = [
        ("email", "Email"),
        ("phone", "Phone"),
        ("google", "Google"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="identities")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    identifier = models.CharField(max_length=255, null=True, blank=True)        # email أو phone
    provider_user_id = models.CharField(max_length=255, null=True, blank=True)  # sub from Google
    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "identifier"],
                name="unique_provider_identifier"
            ),
            models.UniqueConstraint(
                fields=["provider_user_id"],
                condition=models.Q(provider="google"),
                name="unique_google_userid"
            ),
        ]


    def __str__(self):
        return f"{self.user.name} via {self.provider}"


class OTPCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    code = models.CharField(max_length=6, validators=[RegexValidator(r'^\d{6}$')])  
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"OTP for {self.user.name}: {self.code}"

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=5)
    
    
class AdminLoginSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="admin_sessions")
    session_token = models.CharField(max_length=100, unique=True)
    step_1_completed = models.BooleanField(default=False)
    step_2_completed = models.BooleanField(default=False)
    step_3_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Admin Session for {self.user.name}"


class UserLoginSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_sessions")
    session_token = models.CharField(max_length=100, unique=True)
    otp_sent = models.BooleanField(default=False)
    otp_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"User Session for {self.user.name}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('USER_CREATE', 'User Created'),
        ('USER_UPDATE', 'User Updated'),
        ('USER_BAN', 'User Banned'),
        ('USER_UNBAN', 'User Unbanned'),
        ('ROLE_CHANGE', 'Role Changed'),
        ('CATEGORY_ASSIGN', 'Category Assigned'),
        ('PASSWORD_CHANGE', 'Password Changed'),
        ('SECOND_PASSWORD_SET', 'Second Password Set'),
        ('SECOND_PASSWORD_CHANGE', 'Second Password Changed'),
        ('CUSTOMER_ADMIN_ACTION', 'Customer Administration Action'),
        ('BALANCE_ADJUSTMENT', 'Balance Adjustment'),
        ('SESSION_REVOKE', 'Sessions Revoked'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='audit_logs'
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=50)
    resource_id = models.IntegerField(null=True, blank=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.name if self.user else 'System'} - {self.action} at {self.created_at}"


class CustomerBalanceAdjustment(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    )
    CURRENCY_CHOICES = (("USD", "USD"), ("SYP", "SYP"))

    target_user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="balance_adjustments")
    requested_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="requested_balance_adjustments")
    approved_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="approved_balance_adjustments")
    wallet = models.ForeignKey("wallets.Wallet", on_delete=models.PROTECT, related_name="customer_balance_adjustments")
    transaction = models.OneToOneField("transactions.Transaction", on_delete=models.PROTECT, null=True, blank=True, related_name="balance_adjustment")
    amount = models.DecimalField(max_digits=20, decimal_places=8)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    reason = models.TextField()
    decision_reason = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    idempotency_key = models.CharField(max_length=180, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["target_user", "status"]), models.Index(fields=["status", "created_at"])]
