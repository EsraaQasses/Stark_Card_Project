from django.contrib import admin
from .models import Transaction

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "agent", "admin", "wallet", "transaction_type", "amount", "status", "created_at")
    list_filter = ("transaction_type", "status")
    search_fields = ("user__name", "agent__name", "admin__name")
