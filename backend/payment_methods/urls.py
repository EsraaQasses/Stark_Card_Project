from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentMethodAdminViewSet, PaymentMethodListView

router = DefaultRouter()
router.register(r'admin/payment-methods', PaymentMethodAdminViewSet, basename='payment_method_admin')

urlpatterns = [
    path('', include(router.urls)),
    # للمستخدم العادي
    path('user/payment-methods/', PaymentMethodListView.as_view(), name='user_payment_methods'),
]