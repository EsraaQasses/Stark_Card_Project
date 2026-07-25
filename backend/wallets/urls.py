from django.urls import path
from .views import ExchangeRateView, WalletView, change_user_currency

urlpatterns = [
    path('wallet/', WalletView.as_view(), name='wallet'),
    path('exchange-rate/', ExchangeRateView.as_view(), name='exchange-rate'), 
    path('change-currency/', change_user_currency, name='change-currency'),
]