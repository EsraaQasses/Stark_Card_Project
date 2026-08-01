# wallets/admin.py
from django.contrib import admin
from .models import ExchangeRate, ExchangeRateQuote, Wallet

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'currency', 'available_balance', 'pending_balance', 'total_balance']
    list_filter = ['user', 'currency']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['total_balance']

@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['usd_to_syp', 'syp_to_usd', 'updated_at']
    readonly_fields = ['syp_to_usd', 'updated_at']


@admin.register(ExchangeRateQuote)
class ExchangeRateQuoteAdmin(admin.ModelAdmin):
    list_display = [
        'base_currency', 'quote_currency', 'platform_buy_base_rate',
        'platform_sell_base_rate', 'status', 'version', 'effective_at', 'created_by',
    ]
    list_filter = ['status', 'source', 'base_currency', 'quote_currency']
    search_fields = ['activation_note', 'created_by__email', 'created_by__name']
    readonly_fields = [
        'base_currency', 'quote_currency', 'platform_buy_base_rate',
        'platform_sell_base_rate', 'status', 'source', 'effective_at',
        'superseded_at', 'created_by', 'created_at', 'version',
    ]
