# payment/urls.py - FIXED VERSION
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentViewSet, PaymentConfigViewSet, 
    WalletPaymentView, AdminPaymentView, health_check
)

router = DefaultRouter()
router.register(r'payment', PaymentViewSet, basename='payment')
router.register(r'config', PaymentConfigViewSet, basename='payment-config')
router.register(r'wallet', WalletPaymentView, basename='wallet-payment')
router.register(r'admin', AdminPaymentView, basename='admin-payment')

urlpatterns = [
    path('', include(router.urls)),
    path('health/', health_check, name='payment-health'),
]