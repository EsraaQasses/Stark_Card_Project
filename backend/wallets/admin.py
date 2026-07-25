from django.contrib import admin
from .models import Wallet, ExchangeRate

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = [
        'id', 
        'user', 
        'currency', 
        'available_balance',  
        'pending_balance',   
        'total_balance'       
    ]
    list_filter = ['currency', 'user']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['available_balance', 'pending_balance']  

    def total_balance(self, obj):
        return obj.total_balance
    total_balance.short_description = 'Total Balance'

@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'usd_to_syp', 
        'syp_to_usd', 
        'updated_at'
    ]
    readonly_fields = ['syp_to_usd', 'updated_at']
    list_per_page = 10

    def has_add_permission(self, request):
        if ExchangeRate.objects.count() >= 1:
            return False
        return super().has_add_permission(request)