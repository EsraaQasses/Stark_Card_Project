# transactions/admin.py
from django.contrib import admin
from .models import Transaction

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "transaction_type", "amount", "status", "created_at"]
    list_filter = ("transaction_type", "status", "created_at")
    search_fields = ("user__name", "user__email", "note")
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        (None, {
            "fields": ("user", "wallet", "transaction_type", "amount", "status")
        }),
        ("Details", {
            "fields": ("note", "external_reference", "payment", "recipient", "recipient_wallet")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at", "processed_at"),
            "classes": ("collapse",)
        }),
    )