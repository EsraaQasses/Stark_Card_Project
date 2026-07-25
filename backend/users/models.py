from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core.validators import RegexValidator
from .utils import generate_agent_code
from django.utils import timezone
from .validators import validate_avatar_size, validate_avatar_extension, validate_avatar_dimensions
from django.contrib.auth.hashers import make_password, check_password
from django_otp.plugins.otp_totp.models import TOTPDevice

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

    agent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="subordinates")

    agent_code = models.CharField(max_length=10, unique=True, null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "name"
    REQUIRED_FIELDS = []


    def save(self, *args, **kwargs):
        if self.role == "agent" and not self.agent_code:
            self.agent_code = generate_agent_code() 
        super().save(*args, **kwargs)


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

    def is_2fa_enabled(self):
        """Check if user has 2FA enabled using django-two-factor-auth"""
        return TOTPDevice.objects.filter(user=self, confirmed=True).exists()


class AdminSecurity(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_security")
    second_password = models.CharField(max_length=128, null=True, blank=True)
    is_second_password_set = models.BooleanField(default=False)
    backup_codes = models.JSONField(blank=True, null=True, default=list)  # ADD THIS FIELD
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

    def verify_totp(self, token):
        """Verify TOTP token using django-otp"""
        try:
            devices = TOTPDevice.objects.filter(user=self.user, confirmed=True)
            for device in devices:
                if device.verify_token(token):
                    return True
            return False
        except Exception:
            return False

    @property
    def is_2fa_enabled(self):
        """Check if user has 2FA enabled"""
        return TOTPDevice.objects.filter(user=self.user, confirmed=True).exists()
        
class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(hours=24)

    def __str__(self):
        return f"Password reset for {self.user.email}"


class UserIdentity(models.Model):
    PROVIDER_CHOICES = [
        ("email", "Email"),
        ("phone", "Phone"),
        ("google", "Google"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="identities")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    identifier = models.CharField(max_length=255, null=True, blank=True)        # email أو phone
    provider_user_id = models.CharField(max_length=255, null=True, blank=True)  # sub من Google
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
    otp_code = models.CharField(max_length=6, null=True, blank=True)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Admin Session for {self.user.name}"