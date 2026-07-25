from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'apis', views.ThirdPartyAPIViewSet, basename='thirdpartyapi')
router.register(r'transactions', views.APITransactionViewSet, basename='apitransaction')

urlpatterns = [
    path('', include(router.urls)),
    path('apis/', views.ThirdPartyAPIViewSet.as_view({'get': 'list'}), name='api-list-direct'),
]