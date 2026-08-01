from django.contrib import admin
from .models import UserQRCode

@admin.register(UserQRCode)
class UserQRCodeAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_at', 'updated_at']
    search_fields = ['user__name', 'user__email']
    readonly_fields = ['created_at', 'updated_at']