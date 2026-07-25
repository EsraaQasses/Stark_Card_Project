from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApproveTransactionView, TransactionViewSet

router = DefaultRouter()
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path("approve/<int:pk>/", ApproveTransactionView.as_view(), name="transaction-approve"),
    path('', include(router.urls)),
]