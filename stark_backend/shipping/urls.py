# shipping/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShippingViewSet,
    AgentShippingRequestView,
    AgentCashoutRequestView,
    StandardShippingRequestViewSet,
    AgentShippingRequestViewSet,
    AgentAdminShippingRequestViewSet,
)

router = DefaultRouter()
router.register(r'standard', StandardShippingRequestViewSet, basename='shipping-standard')
router.register(r'via-agent', AgentShippingRequestViewSet, basename='shipping-via-agent')
router.register(r'agent-admin', AgentAdminShippingRequestViewSet, basename='shipping-agent-admin')
router.register(r'', ShippingViewSet, basename='shipping')

urlpatterns = [
    path('agent-request/', AgentShippingRequestView.as_view(), name='agent-shipping-request'),
    path('agent-cashout-request/', AgentCashoutRequestView.as_view(), name='agent-cashout-request'),
    # Backward compatibility (legacy path)
    path('agent-cashout/', AgentCashoutRequestView.as_view(), name='agent-cashout-legacy'),
    path('', include(router.urls)),
]
