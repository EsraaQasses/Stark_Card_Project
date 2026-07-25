from django.contrib import admin
from .models import AgentProfile

@admin.register(AgentProfile)
class AgentProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "commission_rate", "total_earnings")
    search_fields = ("user__name", "user__email")
