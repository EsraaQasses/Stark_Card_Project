from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import AdListView, LastActionListAPIView, NotificationViewSet, AdViewSet, SystemLogListView

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'ads', AdViewSet, basename='ads')

urlpatterns = [
    path('all/', AdListView.as_view(), name='ad_list_all'),
    path('', include(router.urls)),  
    path('system-logs/', SystemLogListView.as_view(), name='system-logs'),
    path('admin-actions/', LastActionListAPIView.as_view(), name='admin-actions'),
]
