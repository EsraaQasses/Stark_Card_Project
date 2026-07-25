from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SectionViewSet, ProductViewSet, UserSectionListView, UserProductListView,
    FavoriteViewSet, PurchaseViewSet, ExternalProductViewSet, StoreProductViewSet,
    PackageViewSet,PriceConversionView
)

admin_router = DefaultRouter()
admin_router.register(r"sections", SectionViewSet, basename="admin-section")
admin_router.register(r"products", ProductViewSet, basename="admin-product")
admin_router.register(r"external-products", ExternalProductViewSet, basename='externalproduct')
admin_router.register(r"store-products", StoreProductViewSet, basename='storeproduct')
admin_router.register(r"packages", PackageViewSet, basename='package')  # ADD THIS LINE

user_router = DefaultRouter()
user_router.register(r"sections", UserSectionListView, basename="user-section")
user_router.register(r"products", UserProductListView, basename="user-product")

urlpatterns = [
    path("admin/", include(admin_router.urls)),
    
    path("admin/products/<int:pk>/requirements/", 
         ProductViewSet.as_view({'get': 'requirements', 'post': 'requirements', 'delete': 'requirements'}),
         name="product-requirements"),
    path("admin/products/bulk-toggle/", 
         ProductViewSet.as_view({'post': 'bulk_toggle'}), 
         name="bulk-toggle-products"),
    
    path("user/", include(user_router.urls)),
    path("user/favorites/", FavoriteViewSet.as_view({"get": "list"}), name="user_favorites"),
    path("user/favorites/add/", FavoriteViewSet.as_view({"post": "add"}), name="user_add_favorite"),
    path("user/favorites/remove/", FavoriteViewSet.as_view({"post": "remove"}), name="user_remove_favorite"),
    
    path("user/purchases/", PurchaseViewSet.as_view({'post': 'purchase'}), name='user_purchase'),
    
    path("user/featured-products/", UserProductListView.as_view({'get': 'featured'}), name='featured_products'),
    
    path("user/products/search/", 
         UserProductListView.as_view({'get': 'search'}), 
         name="product-search"),
        path("user/convert-price/", PriceConversionView.as_view(), name='convert-price'),

]