# users/admin.py - COMPLETE FIXED VERSION
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, UserIdentity, OTPCode, AdminSecurity, AdminLoginSession, CustomerCategory, AuditLog, UserLoginSession


class UserIdentityInline(admin.TabularInline):
    model = UserIdentity
    extra = 0
    readonly_fields = ['provider', 'identifier', 'provider_user_id', 'is_verified', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class OTPCodeInline(admin.TabularInline):
    model = OTPCode
    extra = 0
    readonly_fields = ['code', 'created_at', 'is_used']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class AdminSecurityInline(admin.StackedInline):
    model = AdminSecurity
    extra = 0
    readonly_fields = ['is_second_password_set', 'created_at', 'updated_at']
    can_delete = False
    fieldsets = (
        ('Second Password Security', {
            'fields': ('is_second_password_set', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def has_add_permission(self, request, obj=None):
        return False


class AdminLoginSessionInline(admin.TabularInline):
    model = AdminLoginSession
    extra = 0
    readonly_fields = ['session_token_short', 'step_1_completed', 'step_2_completed', 
                      'step_3_completed', 'created_at', 'expires_at', 'is_expired_display']
    can_delete = True
    
    def session_token_short(self, obj):
        return f"{obj.session_token[:15]}..." if obj.session_token else "-"
    session_token_short.short_description = 'Session Token'
    
    def is_expired_display(self, obj):
        return obj.is_expired()
    is_expired_display.boolean = True
    is_expired_display.short_description = 'Expired'
    
    def has_add_permission(self, request, obj=None):
        return False


class UserLoginSessionInline(admin.TabularInline):
    model = UserLoginSession
    extra = 0
    readonly_fields = ['session_token_short', 'otp_sent', 'otp_verified', 
                      'created_at', 'expires_at', 'is_expired_display']
    can_delete = True
    
    def session_token_short(self, obj):
        return f"{obj.session_token[:15]}..." if obj.session_token else "-"
    session_token_short.short_description = 'Session Token'
    
    def is_expired_display(self, obj):
        return obj.is_expired()
    is_expired_display.boolean = True
    is_expired_display.short_description = 'Expired'
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = (
        (None, {"fields": ("name", "email", "phone", "role", "agent", "password")}),
        (_("Personal Info"), {"fields": ("full_name", "country", "optional_phone", "avatar", "currency_preference")}),
        (_("Customer Category"), {"fields": ("category", "category_notes")}),
        (_("Status"), {"fields": ("is_banned", "is_active", "is_staff", "is_superuser")}),
        (_("Important dates"), {"fields": ("last_login", "date_joined", "category_assigned_at")}),
        (_("Permissions"), {"fields": ("groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("name", "email", "phone", "role", "agent", "password1", "password2"),
        }),
    )
    list_display = ("id", "name", "email", "phone", "role", "agent", "category_display", "is_active", "is_banned", "date_joined")
    list_filter = ("role", "is_banned", "is_active", "is_staff", "country", "category", "date_joined")
    search_fields = ("name", "email", "phone", "full_name", "agent_code")
    readonly_fields = ("date_joined", "last_login", "agent_code", "category_assigned_at")
    ordering = ("-date_joined",)
    inlines = [UserIdentityInline, OTPCodeInline, AdminSecurityInline, AdminLoginSessionInline, UserLoginSessionInline]
    
    def category_display(self, obj):
        return obj.customer_category_display if obj.category else "Default"
    category_display.short_description = 'Category'
    
    # Bulk actions
    actions = ['ban_users', 'unban_users', 'activate_users', 'deactivate_users', 'make_agents', 'make_admins']
    
    def ban_users(self, request, queryset):
        updated = queryset.update(is_banned=True)
        self.message_user(request, f'{updated} users have been banned.')
    ban_users.short_description = "Ban selected users"
    
    def unban_users(self, request, queryset):
        updated = queryset.update(is_banned=False)
        self.message_user(request, f'{updated} users have been unbanned.')
    unban_users.short_description = "Unban selected users"
    
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} users have been activated.')
    activate_users.short_description = "Activate selected users"
    
    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} users have been deactivated.')
    deactivate_users.short_description = "Deactivate selected users"
    
    def make_agents(self, request, queryset):
        for user in queryset:
            if user.role != 'agent':
                user.role = 'agent'
                user.save()
        self.message_user(request, f'{queryset.count()} users have been made agents.')
    make_agents.short_description = "Make selected users agents"
    
    def make_admins(self, request, queryset):
        for user in queryset:
            if user.role != 'admin':
                user.role = 'admin'
                user.is_staff = True
                user.is_superuser = True
                user.save()
        self.message_user(request, f'{queryset.count()} users have been made admins.')
    make_admins.short_description = "Make selected users admins"
    
    def get_inline_instances(self, request, obj=None):
        # Only show admin-related inlines for admin users
        if obj and obj.role == 'admin':
            return [inline(self.model, self.admin_site) for inline in self.inlines]
        else:
            # For non-admin users, exclude admin security and session inlines
            return [inline(self.model, self.admin_site) for inline in self.inlines 
                   if inline not in [AdminSecurityInline, AdminLoginSessionInline]]


@admin.register(UserIdentity)
class UserIdentityAdmin(admin.ModelAdmin):
    list_display = ['user', 'provider', 'identifier', 'is_verified', 'created_at']
    list_filter = ['provider', 'is_verified', 'created_at']
    search_fields = ['user__name', 'user__email', 'identifier', 'provider_user_id']
    readonly_fields = ['created_at']
    list_select_related = ['user']


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ['user', 'code', 'is_used', 'created_at', 'is_expired']
    list_filter = ['is_used', 'created_at']
    search_fields = ['user__name', 'user__email', 'code']
    readonly_fields = ['created_at']
    list_select_related = ['user']
    
    def is_expired(self, obj):
        return obj.is_expired()
    is_expired.boolean = True
    is_expired.short_description = 'Expired'


@admin.register(AdminSecurity)
class AdminSecurityAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_second_password_set', 'created_at', 'updated_at']
    list_filter = ['is_second_password_set', 'created_at', 'updated_at']
    search_fields = ['user__name', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    list_select_related = ['user']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return request.method in ['GET', 'HEAD']
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AdminLoginSession)
class AdminLoginSessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'session_token_short', 'step_1_completed', 'step_2_completed', 
                   'step_3_completed', 'created_at', 'expires_at', 'is_expired']
    list_filter = ['step_1_completed', 'step_2_completed', 'step_3_completed', 'created_at']
    search_fields = ['user__name', 'user__email', 'session_token']
    readonly_fields = ['user', 'session_token', 'step_1_completed', 'step_2_completed', 
                      'step_3_completed', 'created_at', 'expires_at']
    list_select_related = ['user']
    
    def session_token_short(self, obj):
        return f"{obj.session_token[:20]}..." if obj.session_token else "-"
    session_token_short.short_description = 'Session Token'
    
    def is_expired(self, obj):
        return obj.is_expired()
    is_expired.boolean = True
    is_expired.short_description = 'Expired'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return request.method in ['GET', 'HEAD']


@admin.register(CustomerCategory)
class CustomerCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'display_name', 'profit_percentage', 'is_active', 'is_default', 'users_count']
    list_filter = ['is_active', 'is_default', 'created_at']
    search_fields = ['name', 'display_name', 'description']
    readonly_fields = ['created_at', 'updated_at']
    list_editable = ['is_active', 'is_default']
    ordering = ['name']
    
    fieldsets = (
        (None, {
            'fields': ('name', 'display_name', 'profit_percentage', 'description')
        }),
        ('Settings', {
            'fields': ('is_active', 'is_default'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def users_count(self, obj):
        return obj.users.count()
    users_count.short_description = 'Users'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user_display', 'action', 'resource_type', 'resource_id', 'ip_address', 'created_at']
    list_filter = ['action', 'resource_type', 'created_at']
    search_fields = ['user__name', 'user__email', 'details', 'ip_address']
    readonly_fields = ['user', 'action', 'resource_type', 'resource_id', 'details', 'ip_address', 'user_agent', 'created_at']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    def user_display(self, obj):
        return obj.user.name if obj.user else 'System'
    user_display.short_description = 'User'
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return request.method in ['GET', 'HEAD']
    
    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


# Custom admin site header and title
admin.site.site_header = "Stark Backend Administration"
admin.site.site_title = "Stark Admin Portal"
admin.site.index_title = "Welcome to Stark Backend Administration"
