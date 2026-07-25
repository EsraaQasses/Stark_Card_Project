# requests/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RequestViewSet, AdminRequestViewSet

router = DefaultRouter()
router.register(r'user/requests', RequestViewSet, basename='user-requests')
router.register(r'admin/requests', AdminRequestViewSet, basename='admin-requests')

urlpatterns = [
    path('', include(router.urls)),
]