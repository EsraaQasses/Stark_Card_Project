from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path("api/wallets/", include("wallets.urls")),
    path("api/transactions/", include("transactions.urls")),
    path("api/store/", include("store.urls")),
    path("api/agents/", include("agents.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path('api/payment-methods/', include('payment_methods.urls')),    path("api/third_party_apis/", include("third_party_apis.urls")),
    path("api/payment/", include("payment.urls")),
    path('api/system/', include('system.urls')),
    path('api/all_requests/', include('all_requests.urls')),
    path('api/qr_code/', include('qr_code.urls')),
    path('api/shipping/', include('shipping.urls')), 
    path('api/finance/', include('finance.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
