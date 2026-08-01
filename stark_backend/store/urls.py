# store/urls.py - Updated
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SectionViewSet, ProductViewSet, UserSectionListView, UserProductListView,
    FavoriteViewSet, PurchaseViewSet, ExternalProductViewSet, StoreProductViewSet,
    PriceConversionView
)

admin_router = DefaultRouter()
admin_router.register(r"sections", SectionViewSet, basename="admin-section")
admin_router.register(r"products", ProductViewSet, basename="admin-product")
admin_router.register(r"external-products", ExternalProductViewSet, basename='externalproduct')
admin_router.register(r"store-products", StoreProductViewSet, basename='storeproduct')

user_router = DefaultRouter()
user_router.register(r"sections", UserSectionListView, basename="user-section")
user_router.register(r"products", UserProductListView, basename="user-product")

urlpatterns = [
    # Admin endpoints
    path("admin/", include(admin_router.urls)),
    
    # Product requirements (admin only)
    path("admin/products/<int:pk>/requirements/", 
         ProductViewSet.as_view({'get': 'requirements', 'post': 'requirements', 'delete': 'requirements'}),
         name="product-requirements"),
    path("admin/products/bulk-toggle/", 
         ProductViewSet.as_view({'post': 'bulk_toggle'}), 
         name="bulk-toggle-products"),
    
    # User endpoints
    path("user/", include(user_router.urls)),
    
    # Product requirements for users
    path("user/products/<int:pk>/requirements/", 
         UserProductListView.as_view({'get': 'requirements'}), 
         name="user-product-requirements"),
    path("user/products/<int:pk>/price_calculator/",
         UserProductListView.as_view({'get': 'price_calculator'}),
         name="user-product-price-calculator"),
    
    # Favorites
    path("user/favorites/", FavoriteViewSet.as_view({"get": "list"}), name="user_favorites"),
    path("user/favorites/add/", FavoriteViewSet.as_view({"post": "add"}), name="user_add_favorite"),
    path("user/favorites/remove/", FavoriteViewSet.as_view({"post": "remove"}), name="user_remove_favorite"),
    
    # Purchases
    path("user/purchases/", PurchaseViewSet.as_view({'get': 'list', 'post': 'purchase'}), name='user_purchase'),
    
    # Featured products
    path("user/featured-products/", 
         UserProductListView.as_view({'get': 'featured'}), 
         name='featured_products'),
    
    # Search
    path("user/products/search/", 
         UserProductListView.as_view({'get': 'search'}), 
         name="product-search"),
    
    # Price conversion
    path("user/convert-price/", PriceConversionView.as_view(), name='convert-price'),
]
