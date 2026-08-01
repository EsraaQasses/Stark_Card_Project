from django.urls import path
from . import views

urlpatterns = [
    path('generate/', views.GenerateUserQRCodeView.as_view(), name='generate-qr'),
    path('my-qr/', views.GetMyQRCodeView.as_view(), name='my-qr'),
    path('user/<int:user_id>/qr/', views.GetUserQRCodeView.as_view(), name='user-qr'),
]