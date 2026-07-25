from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentConfigView, PurchaseView, PaymentViewSet

router = DefaultRouter()
router.register(r'history', PaymentViewSet, basename='payment')

urlpatterns = [
    path("config/", PaymentConfigView.as_view(), name="payment-config"),
    path("purchase/", PurchaseView.as_view(), name="purchase"),  # ✅ THIS ENDPOINT
    path("", include(router.urls)),
]