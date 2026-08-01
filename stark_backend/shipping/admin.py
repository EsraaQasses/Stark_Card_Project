from django.contrib import admin
from .models import StandardShippingRequest, AgentShippingRequest, AgentAdminShippingRequest


@admin.register(StandardShippingRequest)
class StandardShippingRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "amount", "currency", "status", "created_at")
    list_filter = ("status", "currency")
    search_fields = ("user__name", "user__phone")


@admin.register(AgentShippingRequest)
class AgentShippingRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "agent", "amount", "currency", "status", "created_at")
    list_filter = ("status", "currency")
    search_fields = ("user__name", "agent__name")


@admin.register(AgentAdminShippingRequest)
class AgentAdminShippingRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "agent", "amount", "currency", "status", "created_at")
    list_filter = ("status", "currency")
    search_fields = ("agent__name",)
