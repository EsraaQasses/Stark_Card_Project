from django.contrib import admin
from .models import ThirdPartyAPI, APITransaction

@admin.register(ThirdPartyAPI)
class ThirdPartyAPIAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider', 'is_active', 'priority', 'max_daily_limit', 'created_at']
    list_filter = ['provider', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    list_editable = ['is_active', 'priority']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'provider', 'description', 'is_active')
        }),
        ('API Configuration', {
            'fields': ('base_url', 'instance_id', 'encrypted_api_key', 'max_daily_limit', 'priority')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(APITransaction)
class APITransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'api_config', 'success', 'http_status_code', 'request_timestamp']
    list_filter = ['api_config', 'success', 'request_timestamp']
    search_fields = ['external_transaction_id', 'error_message']
    readonly_fields = ['request_timestamp', 'response_timestamp', 'created_at']
    fieldsets = (
        ('Transaction Info', {
            'fields': ('api_config', 'internal_transaction', 'external_transaction_id')
        }),
        ('Request Details', {
            'fields': ('endpoint_used', 'request_payload', 'request_timestamp')
        }),
        ('Response Details', {
            'fields': ('response_payload', 'http_status_code', 'response_timestamp')
        }),
        ('Status', {
            'fields': ('success', 'error_message')
        }),
    )
