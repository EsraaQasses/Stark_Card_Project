from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

#--------------الإشعارات---------------
class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=64, default="general")
    details = models.JSONField(default=dict, blank=True)
    icon = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "created_at"]),
            models.Index(fields=["recipient", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.recipient}] {self.title}"


#--------------الإعلانات---------------
TEXT_COLOR_CHOICES = (
    ('white', 'أبيض'),
    ('black', 'أسود'),
)

class Ad(models.Model):
    title = models.CharField(max_length=255, verbose_name="عنوان الإعلان")  # New field
    text = models.TextField(verbose_name="نص الإعلان")
    background_color = models.CharField(max_length=7, default="#FFFFFF", verbose_name="لون الخلفية")
    font_size = models.PositiveIntegerField(default=14, verbose_name="حجم الخط")
    text_color = models.CharField(max_length=5, choices=TEXT_COLOR_CHOICES, default='black', verbose_name="لون النص")
    image = models.ImageField(upload_to='ads_images/', blank=True, null=True, verbose_name="صورة الإعلان")
    link = models.URLField(blank=True, null=True, verbose_name="رابط الإعلان")
    is_active = models.BooleanField(default=True, verbose_name="مفعل")  # New field
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "إعلان"
        verbose_name_plural = "الإعلانات"
        ordering = ['-created_at']

    def __str__(self):
        return self.title


#--------------Last action---------------
class LastAction(models.Model):
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_actions')
    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='target_actions', null=True, blank=True)
    action_type = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "آخر إجراء"
        verbose_name_plural = "آخر الإجراءات"

    def __str__(self):
        return f"{self.admin} - {self.action_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


def log_admin_action(admin, action_type, description="", target_user=None):
    """
    سجل أي عملية قام بها الأدمن.
    """
    LastAction.objects.create(
        admin=admin,
        target_user=target_user,
        action_type=action_type,
        description=description
    )


#--------------تسجيل عمليات اليوزر---------------
class SystemLog(models.Model):
    LOGIN = 'login'
    REGISTER = 'register'
    PURCHASE = 'purchase'
    UPLOAD = 'upload'
    DELETE = 'delete'
    UPDATE = 'update'
    OTHER = 'other'

    OPERATION_CHOICES = [
        (LOGIN, 'Login'),
        (REGISTER, 'Register'),
        (PURCHASE, 'Purchase'),
        (UPLOAD, 'Upload'),
        (DELETE, 'Delete'),
        (UPDATE, 'Update'),
        (OTHER, 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    operation_type = models.CharField(max_length=20, choices=OPERATION_CHOICES, default=OTHER)
    operation_name = models.CharField(max_length=255)
    url = models.CharField(max_length=500, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    device_info = models.CharField(max_length=255, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'سجل النظام'
        verbose_name_plural = 'سجلات النظام'

    def __str__(self):
        return f"{self.user} - {self.operation_type} - {self.created_at}"