# In admin.py
from django.contrib import admin
from .models import Ad, Notification, LastAction, SystemLog

@admin.register(Ad)
class AdAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_active', 'created_at']
    list_filter = ['is_active', 'text_color', 'created_at']
    search_fields = ['title', 'text']
    readonly_fields = ['created_at']
    fieldsets = (
        ('معلومات الإعلان', {
            'fields': ('title', 'text', 'is_active')
        }),
        ('التصميم', {
            'fields': ('background_color', 'text_color', 'font_size', 'image')
        }),
        ('الروابط والإحصائيات', {
            'fields': ('link',)
        }),
        ('معلومات إضافية', {
            'fields': ('created_at',)
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ('created_at',)
        return self.readonly_fields

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'recipient', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    search_fields = ['title', 'message', 'recipient__email']

@admin.register(LastAction)
class LastActionAdmin(admin.ModelAdmin):
    list_display = ['admin', 'action_type', 'target_user', 'created_at']
    list_filter = ['action_type', 'created_at']
    search_fields = ['admin__email', 'target_user__email', 'description']

@admin.register(SystemLog)
class SystemLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'operation_type', 'operation_name', 'ip_address', 'created_at']
    list_filter = ['operation_type', 'created_at']
    search_fields = ['user__email', 'operation_name', 'ip_address']