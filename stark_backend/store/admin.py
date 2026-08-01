# store/admin.py - UPDATED VERSION (remove Package imports)
from django.contrib import admin
from .models import (
    Section, Product, ProductRequirement, 
    Favorite, ExternalProduct, StoreProduct
)

@admin.register(ExternalProduct)
class ExternalProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'api_config', 'external_id', 'base_price', 'category', 'is_active', 'last_synced']
    list_filter = ['api_config', 'is_active', 'category']
    search_fields = ['name', 'external_id', 'description']
    readonly_fields = ['last_synced']
    list_per_page = 20

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ['name_en', 'name_ar', 'father_section', 'is_active', 'created_at']
    list_filter = ['is_active', 'father_section']
    search_fields = ['name_en', 'name_ar', 'description']
    list_per_page = 20

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'name_en', 'name_ar', 'section', 'product_type', 
        'currency', 'base_price', 'product_profit_percentage', 'is_active', 'created_at'
    ]
    list_filter = ['section', 'product_type', 'currency', 'is_active']
    search_fields = ['name_en', 'name_ar', 'description_en', 'description_ar']
    autocomplete_fields = ['section', 'api_config', 'external_product']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 20
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name_en', 'name_ar', 'description_en', 'description_ar', 'section')
        }),
        ('API Configuration', {
            'fields': ('api_config', 'external_product'),
            'classes': ('collapse',)
        }),
        ('Pricing', {
            'fields': ('product_type', 'currency', 'base_price', 'product_profit_percentage')
        }),
        ('Amount Based Settings', {
            'fields': ('min_amount', 'max_amount'),
            'classes': ('collapse',)
        }),
        ('Customization Settings', {
            'fields': ('customization_options',),
            'classes': ('collapse',)
        }),
        ('Media', {
            'fields': ('image',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(ProductRequirement)
class ProductRequirementAdmin(admin.ModelAdmin):
    list_display = ['field_name', 'field_type', 'product', 'is_required', 'order']
    list_filter = ['field_type', 'is_required']
    search_fields = ['field_name', 'product__name_en']
    autocomplete_fields = ['product']
    list_per_page = 20

@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'product__name_en']
    autocomplete_fields = ['user', 'product']
    list_per_page = 20

@admin.register(StoreProduct)
class StoreProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'section', 'external_product', 'price', 'is_active', 'created_at']
    list_filter = ['section', 'is_active']
    search_fields = ['name', 'description']
    autocomplete_fields = ['section', 'external_product']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 20

    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'description', 'section')
        }),
        ('External Product', {
            'fields': ('external_product',)
        }),
        ('Pricing', {
            'fields': ('price',)
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
