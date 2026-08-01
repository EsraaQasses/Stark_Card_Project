from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'apis', views.ThirdPartyAPIViewSet, basename='thirdpartyapi')
router.register(r'transactions', views.APITransactionViewSet, basename='apitransaction')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/', views.ThirdPartyAPIViewSet.as_view({'get': 'dashboard_stats'}), name='api-dashboard'),
    path('recent-failures/', views.APITransactionViewSet.as_view({'get': 'recent_failures'}), name='recent-failures'),
]