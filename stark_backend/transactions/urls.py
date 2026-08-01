from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ApproveTransactionView, TransactionViewSet, FinancialSummaryView, AgentFinancialSummaryView, TransferLookupView, TransferCreateView

router = DefaultRouter()
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path("approve/<int:pk>/", ApproveTransactionView.as_view(), name="transaction-approve"),
    path("financial/summary/", FinancialSummaryView.as_view(), name="financial-summary"),
    path("financial/summary/agent/", AgentFinancialSummaryView.as_view(), name="agent-financial-summary"),
    path("transfer/lookup/", TransferLookupView.as_view(), name="transfer-lookup"),
    path("transfer/", TransferCreateView.as_view(), name="transfer-create"),
    path('', include(router.urls)),
]
