from django.urls import path
from .views import (
    WalletView, WalletCurrencyView, ExchangeRateView, change_user_currency,
    AdminWalletsSummaryView, WalletTransactionsView,
    WalletDepositView, WalletWithdrawView, wallet_quick_stats,
    ExchangeRateQuoteCurrentView, ExchangeRateQuoteHistoryView, ExchangeRateQuoteActivateView
)

urlpatterns = [
    # User wallet endpoints
    path('wallet/', WalletView.as_view(), name='wallet'),
    path('wallet/transactions/', WalletTransactionsView.as_view(), name='wallet-transactions'),
    path('wallet/deposit/', WalletDepositView.as_view(), name='wallet-deposit'),
    path('wallet/withdraw/', WalletWithdrawView.as_view(), name='wallet-withdraw'),
    path('wallet/<str:currency>/', WalletCurrencyView.as_view(), name='wallet-currency'),
    
    # Exchange rate
    path('exchange-rate/', ExchangeRateView.as_view(), name='exchange-rate'),
    path('exchange-rates/current/', ExchangeRateQuoteCurrentView.as_view(), name='exchange-rates-current'),
    path('exchange-rates/history/', ExchangeRateQuoteHistoryView.as_view(), name='exchange-rates-history'),
    path('exchange-rates/activate/', ExchangeRateQuoteActivateView.as_view(), name='exchange-rates-activate'),
    path('change-currency/', change_user_currency, name='change-currency'),
    
    # Admin only
    path('admin/wallets-summary/', AdminWalletsSummaryView.as_view(), name='admin-wallets-summary'),
    path('admin/wallet-stats/', wallet_quick_stats, name='wallet-quick-stats'),
]
