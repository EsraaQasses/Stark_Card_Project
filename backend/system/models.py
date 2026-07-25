from django.db import models
from django.conf import settings
from store.models import Section, Product

User = settings.AUTH_USER_MODEL

#--------------الإشعارات---------------
class Notification(models.Model):

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)                     # عنوان الإشعار
    message = models.TextField()                                 # المحتوى
    icon = models.ImageField(
    blank=True,
    null=True,
    max_length=100,
    upload_to="notifications/icons/"  
)  
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"[{self.recipient}] {self.title}"


#--------------الإعلانت---------------
TEXT_COLOR_CHOICES = (
    ('white', 'أبيض'),
    ('black', 'أسود'),
)

class Ad(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='ads')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='ads')
    text = models.TextField()  # نص الإعلان
    background_color = models.CharField(max_length=7, default="#FFFFFF")  # الخلفية، يسمح برمز HEX
    font_size = models.PositiveIntegerField(default=14)  # حجم الخط
    text_color = models.CharField(max_length=5, choices=TEXT_COLOR_CHOICES, default='black')
    image = models.ImageField(upload_to='ads_images/', blank=True, null=True)  # صورة الإعلان
    link = models.URLField(blank=True, null=True)  # رابط الانتقال
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.section} - {self.product}"
    

#--------------Last action---------------
class LastAction(models.Model):
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_actions')
    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='target_actions', null=True, blank=True)
    action_type = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.admin} - {self.action_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
    

def log_admin_action(admin, action_type, description="", target_user=None):
    """
    سجل أي عملية قام بها الأدمن.
    admin: كائن المستخدم الذي هو الأدمن
    action_type: نص يصف نوع العملية
    description: نص إضافي يوضح العملية
    target_user: إذا كانت العملية مرتبطة بمستخدم آخر (مثل ترقية وكيل)
    """
    LastAction.objects.create(
        admin=admin,
        target_user=target_user,
        action_type=action_type,
        description=description
    )


#--------------تسجيل عمليات اليوزر---------------
class SystemLog(models.Model):
    # أنواع العمليات الممكنة
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
    operation_name = models.CharField(max_length=255)  # مثلا "POST /payments/purchase/"
    url = models.CharField(max_length=500, blank=True, null=True)
    description = models.TextField(blank=True, null=True)  # أي تفاصيل إضافية
    device_info = models.CharField(max_length=255, blank=True, null=True)  # User Agent
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'System Log'
        verbose_name_plural = 'System Logs'

    def __str__(self):
        return f"{self.user} - {self.operation_type} - {self.created_at}"
