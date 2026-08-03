# store/serializers.py
from rest_framework import serializers
from .models import (
    Section, Product, ProductRequirement, Favorite, 
    StoreProduct, ExternalProduct
)
from transactions.models import Transaction
from store.services.currency_service import CurrencyService
from store.services.price_service import PriceService
from wallets.rate_quotes import ExchangeRateQuoteService
from store.services.image_resolver import ProductImageResolver
import json
import logging
import re
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)


# ==================== UTILITY FUNCTIONS ====================

def safe_decimal(value, default=Decimal('0')):
    """Safely convert any value to Decimal"""
    if isinstance(value, Decimal):
        return value
    if value is None:
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


def safe_float(value, default=0.0):
    """Safely convert any value to float for JSON"""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Decimal):
        return float(value)
    if value is None:
        return default
    try:
        return float(str(value))
    except Exception:
        return default


class ProductImageMetadataMixin(serializers.Serializer):
    image_url = serializers.SerializerMethodField()
    image_source = serializers.SerializerMethodField()
    image_available = serializers.SerializerMethodField()
    image_is_fallback = serializers.SerializerMethodField()

    def _image_metadata(self, obj):
        cache = getattr(self, "_image_metadata_cache", None)
        if cache is None:
            cache = self._image_metadata_cache = {}
        key = getattr(obj, "pk", id(obj))
        if key not in cache:
            cache[key] = ProductImageResolver.resolve(obj, self.context.get("request"))
        return cache[key]

    def get_image_url(self, obj):
        return self._image_metadata(obj)["image_url"]

    def get_image_source(self, obj):
        return self._image_metadata(obj)["image_source"]

    def get_image_available(self, obj):
        return self._image_metadata(obj)["image_available"]

    def get_image_is_fallback(self, obj):
        return self._image_metadata(obj)["image_is_fallback"]


def extract_purchase_product_name(note):
    raw = (note or "").strip()
    if not raw:
        return None

    match = re.search(
        r"Purchase:\s*(.+?)(?=\s+\((?:Amount|Units):|\s+-\s+(?:External ID|Order ID):|$)",
        raw,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()

    return raw


def normalize_inquiry_enabled(external_data):
    """Normalize inquiry flag from external product data."""
    if not isinstance(external_data, dict):
        return False
    inquiry_enabled = external_data.get('inquiry_enabled')
    if inquiry_enabled is None and isinstance(external_data.get('original_data'), dict):
        inquiry_enabled = external_data['original_data'].get('inquiry_enabled')
    return str(inquiry_enabled).lower() in {"1", "true", "yes"}


# ==================== SECTION SERIALIZER ====================

class SectionSerializer(serializers.ModelSerializer):
    subsections = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)
    products_count = serializers.SerializerMethodField()
    father_section_name = serializers.CharField(
        source='father_section.name_en', 
        read_only=True, 
        allow_null=True
    )
    store_products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Section
        fields = [
            "id", "name_en", "name_ar", "description", "image", 
            "father_section", "father_section_name", "subsections", 
            "products_count", "store_products_count", "created_at", 
            "updated_at", "is_active"
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_subsections(self, obj):
        """Get only active subsections"""
        subsections = getattr(obj, "active_subsections", None)
        if subsections is None:
            subsections = obj.subsections.filter(is_active=True)
        return SectionSerializer(
            subsections,
            many=True,
            context=self.context
        ).data

    def get_products_count(self, obj):
        """Count of active products in this section"""
        annotated = getattr(obj, "active_products_count_optimized", None)
        if annotated is not None:
            return annotated
        return obj.products.filter(is_active=True).count()

    def get_store_products_count(self, obj):
        """Count of active store products in this section"""
        annotated = getattr(obj, "active_store_products_count_optimized", None)
        if annotated is not None:
            return annotated
        return obj.store_products.filter(is_active=True).count()


# ==================== PRODUCT REQUIREMENT SERIALIZER ====================

class ProductRequirementSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField()

    class Meta:
        model = ProductRequirement
        fields = ["id", "field_name", "field_type", "is_required", "placeholder", "order", "options"]
        read_only_fields = ["id"]

    def get_options(self, obj):
        """Return select options as a list for frontend use."""
        return obj.get_options_list()


# ==================== EXTERNAL PRODUCT SERIALIZER ====================

class ExternalProductSerializer(ProductImageMetadataMixin, serializers.ModelSerializer):
    api_name = serializers.CharField(source='api_config.name', read_only=True)
    provider = serializers.CharField(source='api_config.provider', read_only=True)
    is_api_active = serializers.BooleanField(source='api_config.is_active', read_only=True)
    
    class Meta:
        model = ExternalProduct
        fields = [
            'id', 'external_id', 'name', 'description', 'base_price',
            'category', 'required_fields_json', 'api_config', 'api_name',
            'provider', 'is_api_active', 'is_active', 'last_synced',
            'image_url', 'image_source', 'image_available', 'image_is_fallback'
        ]
        read_only_fields = fields


# ==================== PRODUCT SERIALIZER (For Admin) ====================

class ProductSerializer(ProductImageMetadataMixin, serializers.ModelSerializer):
    requirements = ProductRequirementSerializer(many=True, read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)
    section_name_en = serializers.CharField(source='section.name_en', read_only=True)
    section_name_ar = serializers.CharField(source='section.name_ar', read_only=True)
    api_name = serializers.CharField(source='api_config.name', read_only=True)
    is_favorite = serializers.SerializerMethodField()
    
    # Pricing information
    price_info = serializers.SerializerMethodField()
    user_final_price = serializers.SerializerMethodField()
    external_product_info = serializers.SerializerMethodField()
    available_external_products = serializers.SerializerMethodField(read_only=True)
    query_enabled = serializers.SerializerMethodField()
    
    # For amount-based products
    calculated_price_examples = serializers.SerializerMethodField()
    
    # For customization-based products
    customization_data = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        provided_quote = self.context.get("exchange_rate_quote")
        self._display_quote = provided_quote if provided_quote is not None else (ExchangeRateQuoteService.get_active_quote() or False)
        self._price_info_cache = {}
    
    class Meta:
        model = Product
        fields = [
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "section", "section_name_en", "section_name_ar", "api_config", "api_name",
            "product_type", "min_amount", "max_amount", "base_price",
            "product_profit_percentage",
            "customization_options", "requirements", "image", "is_active", "is_favorite",
            "currency", "price_info", "user_final_price", "external_product", 
            "external_product_info", "available_external_products", "query_enabled",
            "calculated_price_examples", "customization_data", "image_url", "image_source",
            "image_available", "image_is_fallback", "created_at", "updated_at"
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_is_favorite(self, obj):
        """Check if current user has favorited this product"""
        request = self.context.get("request")
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            prefetched = getattr(obj, "current_user_favorites", None)
            if prefetched is not None:
                return bool(prefetched)
            return obj.favorited_by.filter(user=request.user).exists()
        return False

    def _get_cached_price_info(self, obj):
        if obj.pk not in self._price_info_cache:
            self._price_info_cache[obj.pk] = self.get_price_info(obj)
        return self._price_info_cache[obj.pk]

    def get_price_info(self, obj):
        """Get comprehensive price information"""
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        
        try:
            return PriceService.get_product_prices(obj, user, quote=self._display_quote)
        except Exception as e:
            logger.error(f"Error getting price info for product {obj.id}: {str(e)}")
            return {
                "base_currency": obj.currency,
                "base_price": float(obj.base_price),
                "converted_prices": {"USD": float(obj.base_price), "SYP": None},
                "price_conversions": {},
                "user_final_prices": None,
                "exchange_rates": {"rate_available": False, "error_code": "FX_RATE_UNAVAILABLE"},
            }

    def get_user_final_price(self, obj):
        """Get user's final price in product's base currency"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                price_info = self._get_cached_price_info(obj)
                user_final_prices = price_info.get('user_final_prices')
                if user_final_prices:
                    # Return price in product's base currency
                    return user_final_prices.get(obj.currency, obj.base_price)
            except Exception as e:
                logger.error(f"Error getting user final price: {str(e)}")
        return obj.base_price

    def get_external_product_info(self, obj):
        """Get information about linked external product"""
        if obj.external_product:
            external_data = obj.external_product.external_data or {}
            return {
                'id': obj.external_product.id,
                'name': obj.external_product.name,
                'external_id': obj.external_product.external_id,
                'provider': obj.external_product.api_config.provider,
                'base_price': float(obj.external_product.base_price),
                'required_fields': obj.external_product.required_fields_json,
                'is_active': obj.external_product.is_active,
                'inquiry_enabled': normalize_inquiry_enabled(external_data),
                'quantity_options': external_data.get('quantity_options'),
                'quantity_min': external_data.get('quantity_min'),
                'quantity_max': external_data.get('quantity_max')
            }
        return None

    def get_query_enabled(self, obj):
        """Expose inquiry flag for frontend query button."""
        external = obj.external_product
        if not external:
            return False
        external_data = external.external_data or {}
        return normalize_inquiry_enabled(external_data)

    def get_available_external_products(self, obj):
        """Get available external products for the selected API"""
        if obj.api_config:
            external_products = ExternalProduct.objects.filter(
                api_config=obj.api_config,
                is_active=True
            )[:50]  # Limit to avoid performance issues
            return ExternalProductSerializer(external_products, many=True).data
        return []

    def get_calculated_price_examples(self, obj):
        """Provide price calculation examples for amount-based products"""
        if obj.product_type != "amount_based":
            return None
        
        try:
            examples = []
            if obj.min_amount:
                # Example 1: Minimum amount
                min_price = obj.calculate_price(amount=float(obj.min_amount))
                examples.append({
                    "amount": float(obj.min_amount),
                    "price": float(min_price),
                    "description": "Minimum amount"
                })
            
            if obj.max_amount:
                # Example 2: Maximum amount
                max_price = obj.calculate_price(amount=float(obj.max_amount))
                examples.append({
                    "amount": float(obj.max_amount),
                    "price": float(max_price),
                    "description": "Maximum amount"
                })
            
            if obj.min_amount and obj.max_amount:
                # Example 3: Middle amount
                middle_amount = (float(obj.min_amount) + float(obj.max_amount)) / 2
                middle_price = obj.calculate_price(amount=middle_amount)
                examples.append({
                    "amount": middle_amount,
                    "price": float(middle_price),
                    "description": "Average amount"
                })
            
            return examples
            
        except Exception as e:
            logger.error(f"Error calculating price examples: {str(e)}")
            return []

    def get_customization_data(self, obj):
        """Get customization options for customization-based products"""
        if obj.product_type != "customization_based":
            return None
        
        return obj.get_customization_data()


# ==================== PRODUCT CREATE/UPDATE SERIALIZER ====================

class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    requirements = ProductRequirementSerializer(many=True, required=False)
    image = serializers.ImageField(required=False, allow_null=True)
    
    # Make external_product optional for creation
    external_product = serializers.PrimaryKeyRelatedField(
        queryset=ExternalProduct.objects.filter(is_active=True),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Product
        fields = [
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "section", "api_config", "external_product",
            "product_type", "currency", "base_price",
            "product_profit_percentage",
            "min_amount", "max_amount", "customization_options", 
            "image", "is_active", "requirements"
        ]

    def validate(self, data):
        """Validate product data based on type"""
        # If the request used multipart/form-data the `requirements` field
        # may arrive as a JSON string in `initial_data`. Normalize it here
        # so nested serializer validation receives a proper list.
        try:
            raw_requirements = self.initial_data.get('requirements')
        except Exception:
            raw_requirements = None

        if raw_requirements and isinstance(raw_requirements, str):
            try:
                parsed = json.loads(raw_requirements)
                # ensure we place the parsed value into `data` so downstream
                # validation and create/update see it
                data['requirements'] = parsed
            except Exception:
                # leave as-is; actual serializer validation will raise if needed
                pass
        product_profit = data.get(
            "product_profit_percentage",
            getattr(self.instance, "product_profit_percentage", Decimal("0")),
        )
        if product_profit is None or product_profit < Decimal("0"):
            raise serializers.ValidationError({
                "product_profit_percentage": {
                    "message": "Product profit must be non-negative.",
                    "code": "PRODUCT_PROFIT_INVALID",
                }
            })
        if product_profit > Decimal("999.99"):
            raise serializers.ValidationError({
                "product_profit_percentage": {
                    "message": "Product profit cannot exceed 999.99%.",
                    "code": "PRODUCT_PROFIT_OUT_OF_RANGE",
                }
            })
        product_type = data.get("product_type", getattr(self.instance, "product_type", "amount_based"))
        
        if product_type == "amount_based":
            min_amount = data.get("min_amount", getattr(self.instance, "min_amount", None))
            max_amount = data.get("max_amount", getattr(self.instance, "max_amount", None))
            base_price = data.get("base_price", getattr(self.instance, "base_price", None))
            
            if not all([min_amount, max_amount, base_price]):
                raise serializers.ValidationError({
                    "error": "Amount-based products require min_amount, max_amount, and base_price (price per unit)"
                })
            
            min_amount_decimal = safe_decimal(min_amount)
            max_amount_decimal = safe_decimal(max_amount)
            base_price_decimal = safe_decimal(base_price)
            
            if min_amount_decimal <= 0:
                raise serializers.ValidationError({
                    "min_amount": "Min amount must be greater than 0"
                })
            
            if min_amount_decimal > max_amount_decimal:
                raise serializers.ValidationError({
                    "min_amount": "Min amount must be less than or equal to max amount"
                })
            
            if base_price_decimal <= 0:
                raise serializers.ValidationError({
                    "base_price": "Base price (price per unit) must be greater than 0"
                })
                
        elif product_type == "customization_based":
            customization_options = data.get("customization_options", getattr(self.instance, "customization_options", None))
            base_price = data.get("base_price", getattr(self.instance, "base_price", None))
            if not customization_options:
                raise serializers.ValidationError({
                    "customization_options": "Customization-based products require customization_options"
                })
            
            try:
                raw_values = [v.strip() for v in str(customization_options).split(",") if v.strip()]
                if len(raw_values) == 0:
                    raise serializers.ValidationError({
                        "customization_options": "Customization options cannot be empty"
                    })

                for value in raw_values:
                    price = safe_decimal(value)
                    if price <= 0:
                        raise serializers.ValidationError({
                            "customization_options": f"Value must be greater than 0: {value}"
                        })
            except Exception:
                raise serializers.ValidationError({
                    "customization_options": "Invalid customization values. Use comma-separated numbers."
                })

            base_price_decimal = safe_decimal(base_price)
            if base_price_decimal <= 0:
                raise serializers.ValidationError({
                    "base_price": "Base price (price per unit) must be greater than 0"
                })

        # Validate external product if provided
        external_product = data.get("external_product")
        if external_product and external_product.api_config:
            api_config = data.get("api_config")
            if api_config and external_product.api_config != api_config:
                raise serializers.ValidationError({
                    "external_product": "External product must belong to the selected API"
                })

        return data

    def create(self, validated_data):
        """Create a new product with requirements"""
        requirements_data = validated_data.pop('requirements', [])
        
        # Create the product instance
        product = Product.objects.create(**validated_data)
        
        # Create requirements
        for req_data in requirements_data:
            ProductRequirement.objects.create(product=product, **req_data)
        
        return product

    def update(self, instance, validated_data):
        """Update an existing product"""
        requirements_data = validated_data.pop('requirements', None)
        
        # Update product fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Save the instance (validation happens in model clean method)
        instance.save()
        
        # Update requirements if provided
        if requirements_data is not None:
            # Delete existing requirements
            instance.requirements.all().delete()
            
            # Create new requirements
            for req_data in requirements_data:
                ProductRequirement.objects.create(product=instance, **req_data)
                
        return instance

    def to_representation(self, instance):
        """Return full product representation after create/update"""
        return ProductSerializer(instance, context=self.context).data


# ==================== USER PRODUCT SERIALIZER ====================

class UserProductSerializer(ProductImageMetadataMixin, serializers.ModelSerializer):
    """Simplified serializer for user-facing API"""
    section_name_en = serializers.CharField(source='section.name_en', read_only=True)
    section_name_ar = serializers.CharField(source='section.name_ar', read_only=True)
    image = serializers.ImageField(read_only=True)
    requirements = ProductRequirementSerializer(many=True, read_only=True)
    is_favorite = serializers.SerializerMethodField()
    
    # Pricing information
    price_info = serializers.SerializerMethodField()
    user_final_price = serializers.SerializerMethodField()
    
    # Product type specific fields
    calculated_price_examples = serializers.SerializerMethodField()
    customization_data = serializers.SerializerMethodField()
    query_enabled = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        provided_quote = self.context.get("exchange_rate_quote")
        self._display_quote = provided_quote if provided_quote is not None else (ExchangeRateQuoteService.get_active_quote() or False)
        self._price_info_cache = {}
    
    class Meta:
        model = Product
        fields = [
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "section", "section_name_en", "section_name_ar", 
            "product_type", "min_amount", "max_amount", "base_price",
            "customization_options", "image", "requirements", "is_favorite",
            "currency", "price_info", "user_final_price",
            "calculated_price_examples", "customization_data", "query_enabled",
            "image_url", "image_source", "image_available", "image_is_fallback"
        ]
        read_only_fields = fields

    def get_is_favorite(self, obj):
        """Check if current user has favorited this product"""
        request = self.context.get("request")
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            prefetched = getattr(obj, "current_user_favorites", None)
            if prefetched is not None:
                return bool(prefetched)
            return obj.favorited_by.filter(user=request.user).exists()
        return False

    def _get_cached_price_info(self, obj):
        if obj.pk not in self._price_info_cache:
            self._price_info_cache[obj.pk] = self.get_price_info(obj)
        return self._price_info_cache[obj.pk]

    def get_price_info(self, obj):
        """Get comprehensive price information for users"""
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        
        try:
            price_data = PriceService.get_product_prices(obj, user, quote=self._display_quote)
            
            # Add product-specific information
            if obj.product_type == "amount_based":
                price_data.update({
                    "price_per_unit": float(obj.base_price),
                    "min_amount": float(obj.min_amount) if obj.min_amount else None,
                    "max_amount": float(obj.max_amount) if obj.max_amount else None
                })
            elif obj.product_type == "customization_based":
                price_data.update({
                    "price_per_unit": float(obj.base_price),
                    "customization_options": obj.get_customization_data()
                })
            
            return price_data
            
        except Exception as e:
            logger.error(f"Error getting price info for user product {obj.id}: {str(e)}")
            return {
                "base_currency": obj.currency,
                "base_price": float(obj.base_price),
                "converted_prices": {"USD": float(obj.base_price), "SYP": None},
                "price_conversions": {},
                "user_final_prices": None,
                "exchange_rates": {"rate_available": False, "error_code": "FX_RATE_UNAVAILABLE"},
            }

    def get_user_final_price(self, obj):
        """Get user's final price in product's base currency"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                price_info = self._get_cached_price_info(obj)
                user_final_prices = price_info.get('user_final_prices')
                if user_final_prices:
                    return user_final_prices.get(obj.currency, obj.base_price)
            except Exception:
                pass
        return obj.base_price

    def get_calculated_price_examples(self, obj):
        """Provide price calculation examples for amount-based products"""
        if obj.product_type != "amount_based":
            return None
        
        try:
            examples = []
            
            if obj.min_amount:
                # Calculate minimum price
                min_price = obj.calculate_price(amount=float(obj.min_amount))
                request = self.context.get('request')
                user_final_min_price = None
                
                if request and request.user.is_authenticated:
                    user_final_min_price = PriceService.calculate_pricing(
                        amount=min_price, source_currency=obj.currency, user=request.user,
                        product=obj,
                    ).native_final_amount
                
                examples.append({
                    "amount": float(obj.min_amount),
                    "calculated_price": float(min_price),
                    "user_final_price": float(user_final_min_price) if user_final_min_price else None,
                    "description": "Minimum amount"
                })
            
            return examples
            
        except Exception as e:
            logger.error(f"Error calculating price examples: {str(e)}")
            return []

    def get_customization_data(self, obj):
        """Get customization options for customization-based products"""
        if obj.product_type != "customization_based":
            return None
        
        try:
            options = obj.get_customization_data()
            
            # Calculate user final prices for each option
            request = self.context.get('request')
            if request and request.user.is_authenticated:
                user = request.user
                for option in options:
                    option_price = safe_decimal(option['price'])
                    user_final_price = PriceService.calculate_pricing(
                        amount=option_price, source_currency=obj.currency, user=user,
                        product=obj,
                    ).native_final_amount
                    option['user_final_price'] = float(user_final_price)
            
            return options
            
        except Exception as e:
            logger.error(f"Error getting customization data: {str(e)}")
            return []

    def get_query_enabled(self, obj):
        """Expose inquiry flag for frontend query button."""
        external = obj.external_product
        if not external:
            return False
        external_data = external.external_data or {}
        return normalize_inquiry_enabled(external_data)


# ==================== FAVORITE SERIALIZER ====================

class FavoriteSerializer(serializers.ModelSerializer):
    product = UserProductSerializer(read_only=True)
    added_at = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Favorite
        fields = ["id", "product", "added_at"]
        read_only_fields = fields


# ==================== PURCHASE SERIALIZER ====================

class PurchaseSerializer(serializers.Serializer):
    store_product_id = serializers.IntegerField(required=False)
    product_id = serializers.IntegerField(required=False)
    user_inputs = serializers.JSONField()
    wallet_currency = serializers.ChoiceField(choices=[("USD", "USD"), ("SYP", "SYP")], required=False)
    amount = serializers.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        required=False, 
        allow_null=True
    )
    selected_option = serializers.CharField(
        required=False, 
        allow_null=True,
        allow_blank=True
    )
    idempotency_key = serializers.CharField(required=False, allow_blank=False, max_length=128)
    
    def validate_store_product_id(self, value):
        """Validate that store product exists and is active"""
        if value is None:
            return value
        try:
            product = StoreProduct.objects.get(id=value, is_active=True)
            if not product.is_available_for_purchase:
                raise serializers.ValidationError("Product is not available for purchase")
            return value
        except StoreProduct.DoesNotExist:
            raise serializers.ValidationError("Product not found or inactive")
    
    def validate_user_inputs(self, value):
        """Validate user inputs structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("User inputs must be a JSON object")
        return value
    
    def validate(self, data):
        """Additional validation based on product type"""
        store_product_id = data.get('store_product_id')
        product_id = data.get('product_id')

        if not store_product_id and not product_id:
            raise serializers.ValidationError(
                "Either store_product_id or product_id is required"
            )

        if store_product_id and product_id:
            raise serializers.ValidationError(
                "Only one of store_product_id or product_id should be provided"
            )

        # Resolve product_id -> store_product_id when needed
        product = None
        if product_id and not store_product_id:
            try:
                product = Product.objects.get(id=product_id, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({
                    "product_id": "Product not found or inactive"
                })

            if not product.external_product:
                raise serializers.ValidationError({
                    "product_id": "Product is not linked to a store product"
                })

            store_product = StoreProduct.objects.filter(
                external_product=product.external_product,
                is_active=True
            ).first()

            if not store_product:
                raise serializers.ValidationError({
                    "product_id": "No active store product found for this product"
                })

            data['store_product_id'] = store_product.id
            store_product_id = store_product.id
        
        try:
            store_product = StoreProduct.objects.get(id=store_product_id)

            # Check if it's linked to a product
            if store_product.external_product:
                external_product = store_product.external_product
                if product is None:
                    product = Product.objects.filter(
                        external_product=external_product,
                        is_active=True
                    ).first()
                
                # For amount-based products, validate amount
                if external_product.required_fields_json:
                    # Check if any field indicates it's amount-based
                    amount_fields = ['amount', 'quantity', 'count']
                    has_amount_field = any(
                        any(amount_field in str(field).lower() for amount_field in amount_fields)
                        for field in external_product.required_fields_json
                    )
                    
                    if has_amount_field and not data.get('amount'):
                        raise serializers.ValidationError({
                            "amount": "Amount is required for this product"
                        })

            if product:
                if product.product_type == "amount_based" and not data.get('amount'):
                    raise serializers.ValidationError({
                        "amount": "Amount is required for amount-based products"
                    })
                if product.product_type == "customization_based":
                    selected_option = data.get('selected_option')
                    if not selected_option:
                        raise serializers.ValidationError({
                            "selected_option": "Selected option is required for customization-based products"
                        })
                    allowed_values = {str(opt.get('value')) for opt in product.get_customization_data()}
                    if allowed_values and str(selected_option) not in allowed_values:
                        raise serializers.ValidationError({
                            "selected_option": "Selected option is not valid for this product"
                        })
            
        except StoreProduct.DoesNotExist:
            pass  # Already validated in store_product_id field
        
        return data


class UserPurchaseListSerializer(serializers.ModelSerializer):
    amount = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    store_product_name = serializers.SerializerMethodField()
    store_product_id = serializers.SerializerMethodField()
    user_inputs = serializers.SerializerMethodField()
    final_price = serializers.SerializerMethodField()
    wallet_currency = serializers.SerializerMethodField()
    paid_currency = serializers.SerializerMethodField()
    external_transaction_id = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    selected_option = serializers.SerializerMethodField()
    recipient_id = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    recipient_phone = serializers.SerializerMethodField()
    wallet_id = serializers.IntegerField(read_only=True)
    image_url = serializers.SerializerMethodField()
    image_source = serializers.SerializerMethodField()
    image_available = serializers.SerializerMethodField()
    image_is_fallback = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "transaction_type",
            "status",
            "created_at",
            "processed_at",
            "amount",
            "paid_amount",
            "currency",
            "note",
            "wallet_id",
            "store_product_id",
            "store_product_name",
            "user_inputs",
            "final_price",
            "wallet_currency",
            "paid_currency",
            "external_transaction_id",
            "payment_status",
            "selected_option",
            "recipient_id",
            "recipient_name",
            "recipient_phone",
            "image_url",
            "image_source",
            "image_available",
            "image_is_fallback",
        ]

    def get_amount(self, obj):
        if obj.amount is None:
            return None
        try:
            return float(abs(obj.amount))
        except Exception:
            try:
                return float(abs(Decimal(str(obj.amount))))
            except Exception:
                return None

    def get_paid_amount(self, obj):
        """Explicit paid amount for UI; same as abs(amount) with safe fallback."""
        return self.get_amount(obj)

    def get_store_product_name(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and getattr(payment, "store_product", None):
            return payment.store_product.name
        return extract_purchase_product_name(obj.note)

    def get_store_product_id(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and getattr(payment, "store_product_id", None):
            return payment.store_product_id
        return None

    def get_user_inputs(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and isinstance(getattr(payment, "user_inputs", None), dict):
            return payment.user_inputs
        return {}

    def get_final_price(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and payment.final_price is not None:
            try:
                return float(payment.final_price)
            except Exception:
                return payment.final_price
        if obj.amount is None:
            return None
        try:
            return float(abs(obj.amount))
        except Exception:
            try:
                return float(abs(Decimal(str(obj.amount))))
            except Exception:
                return None

    def get_wallet_currency(self, obj):
        return obj.currency

    def get_paid_currency(self, obj):
        return obj.currency

    def get_external_transaction_id(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and getattr(payment, "external_transaction_id", None):
            return payment.external_transaction_id
        return obj.external_reference or None

    def get_payment_status(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and getattr(payment, "status", None):
            return payment.status
        return None

    def get_recipient_id(self, obj):
        if obj.recipient:
            return obj.recipient.id
        return None

    def get_recipient_name(self, obj):
        if obj.recipient:
            return obj.recipient.name
        return None

    def get_recipient_phone(self, obj):
        if obj.recipient:
            return obj.recipient.phone
        return None

    def get_selected_option(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and isinstance(getattr(payment, "user_inputs", None), dict):
            val = payment.user_inputs.get("selected_option")
            if val is not None:
                return val
        # Fallback to transaction-level if present
        if hasattr(obj, "selected_option"):
            return obj.selected_option
        return None

    def _image_snapshot(self, obj):
        payment = getattr(obj, "payment", None)
        context = getattr(payment, "operation_context", None) or getattr(obj, "operation_context", None) or {}
        image = context.get("image") if isinstance(context, dict) else None
        if isinstance(image, dict) and "image_source" in image:
            return image
        if payment and getattr(payment, "image_source", None):
            return {
                "image_url": payment.image_url,
                "image_source": payment.image_source,
                "image_available": payment.image_available,
                "image_is_fallback": payment.image_is_fallback,
            }
        if getattr(obj, "image_source", None):
            return {
                "image_url": obj.image_url,
                "image_source": obj.image_source,
                "image_available": obj.image_available,
                "image_is_fallback": obj.image_is_fallback,
            }
        if payment and getattr(payment, "store_product", None):
            return ProductImageResolver.resolve(payment.store_product, self.context.get("request"))
        return {"image_url": None, "image_source": "none", "image_available": False, "image_is_fallback": False}

    def get_image_url(self, obj):
        return self._image_snapshot(obj)["image_url"]

    def get_image_source(self, obj):
        return self._image_snapshot(obj)["image_source"]

    def get_image_available(self, obj):
        return self._image_snapshot(obj)["image_available"]

    def get_image_is_fallback(self, obj):
        return self._image_snapshot(obj)["image_is_fallback"]


# ==================== STORE PRODUCT SERIALIZERS ====================

class StoreProductSerializer(ProductImageMetadataMixin, serializers.ModelSerializer):
    """Serializer for viewing store products"""
    external_product_info = serializers.SerializerMethodField()
    section_name_en = serializers.CharField(source='section.name_en', read_only=True)
    section_name_ar = serializers.CharField(source='section.name_ar', read_only=True)
    user_final_price = serializers.SerializerMethodField()
    price_info = serializers.SerializerMethodField()
    is_available = serializers.BooleanField(source='is_available_for_purchase', read_only=True)
    query_enabled = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        provided_quote = self.context.get("exchange_rate_quote")
        self._display_quote = provided_quote if provided_quote is not None else (ExchangeRateQuoteService.get_active_quote() or False)
    
    class Meta:
        model = StoreProduct
        fields = [
            "id", "name", "description", "price", "currency", "section", "section_name_en", 
            "section_name_ar", "external_product", "external_product_info", 
            "is_active", "user_final_price", "price_info", "is_available", "query_enabled",
            "image_url", "image_source", "image_available", "image_is_fallback",
            "created_at", "updated_at"
        ]
        read_only_fields = ["external_product", "external_product_info", "created_at", "updated_at"]

    def get_external_product_info(self, obj):
        """Get information about the linked external product"""
        if obj.external_product:
            external_data = obj.external_product.external_data or {}
            inquiry_enabled = external_data.get('inquiry_enabled')
            if inquiry_enabled is None and isinstance(external_data.get('original_data'), dict):
                inquiry_enabled = external_data['original_data'].get('inquiry_enabled')
            normalized_inquiry_enabled = str(inquiry_enabled).lower() in {"1", "true", "yes"}
            return {
                'id': obj.external_product.id,
                'original_name': obj.external_product.name,
                'external_id': obj.external_product.external_id,
                'provider': obj.external_product.api_config.provider if obj.external_product.api_config else None,
                'base_price': float(obj.external_product.base_price),
                'required_fields': obj.external_product.required_fields_json,
                'is_active': obj.external_product.is_active,
                'inquiry_enabled': bool(normalized_inquiry_enabled),
                'quantity_options': external_data.get('quantity_options'),
                'quantity_min': external_data.get('quantity_min'),
                'quantity_max': external_data.get('quantity_max')
            }
        return None

    def get_user_final_price(self, obj):
        """Calculate final price with user's category profit percentage"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                base_price = safe_decimal(obj.price)
                final_price = PriceService.calculate_pricing(
                    amount=base_price, source_currency=obj.currency, user=request.user,
                    product=obj,
                ).native_final_amount
                return float(final_price)
            except Exception as e:
                logger.error(f"Error calculating user final price: {str(e)}")
        return float(obj.price)

    def get_price_info(self, obj):
        """Get comprehensive price information"""
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None
        
        try:
            # Create a mock product for price calculation
            class MockProduct:
                def __init__(self, price, currency="USD"):
                    self.base_price = price
                    self.currency = currency
            
            mock_product = MockProduct(obj.price, obj.currency)
            price_data = PriceService.get_product_prices(mock_product, user, quote=self._display_quote)
            
            # Add store product specific info
            price_data.update({
                "store_price": float(obj.price),
                "original_external_price": float(obj.external_product.base_price) if obj.external_product else None,
                "price_difference": float(obj.price - obj.external_product.base_price) if obj.external_product else None
            })
            
            return price_data
            
        except Exception as e:
            logger.error(f"Error getting store product price info: {str(e)}")
            return {
                "store_price": float(obj.price),
                "converted_prices": {"USD": float(obj.price), "SYP": None},
                "price_conversions": {},
                "user_final_prices": None
            }

    def get_query_enabled(self, obj):
        """Expose inquiry flag for store products."""
        return bool(getattr(obj, "query_enabled", False))


class StoreProductCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating store products"""
    external_product = serializers.PrimaryKeyRelatedField(
        queryset=ExternalProduct.objects.filter(is_active=True),
        required=True
    )
    
    class Meta:
        model = StoreProduct
        fields = [
            'id', 'section', 'external_product', 'name', 'description', 
            'price', 'currency', 'is_active'
        ]
    
    def validate(self, attrs):
        """Validate store product data"""
        external_product = attrs.get('external_product')
        price = attrs.get('price')
        
        if external_product and not external_product.is_active:
            raise serializers.ValidationError({
                "external_product": "External product is not active"
            })
        
        if external_product and external_product.api_config and not external_product.api_config.is_active:
            raise serializers.ValidationError({
                "external_product": "API for this external product is not active"
            })
        
        if price is not None:
            price_decimal = safe_decimal(price)
            if price_decimal <= 0:
                raise serializers.ValidationError({
                    "price": "Price must be greater than 0"
                })
            
            # Optional: Check if price is reasonable compared to external product
            if external_product and price_decimal < safe_decimal(external_product.base_price):
                # Allow but warn - could add a warning field instead of error
                pass
        
        return attrs
    
    def to_representation(self, instance):
        """Return full representation after create/update"""
        return StoreProductSerializer(instance, context=self.context).data


# ==================== PRICE CALCULATION SERIALIZER ====================

class PriceCalculationSerializer(serializers.Serializer):
    """Serializer for calculating prices"""
    product_id = serializers.IntegerField(required=False)
    store_product_id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        required=False, 
        allow_null=True
    )
    selected_option = serializers.CharField(
        required=False, 
        allow_null=True,
        allow_blank=True
    )
    
    def validate(self, data):
        """Validate that we have either product_id or store_product_id"""
        product_id = data.get('product_id')
        store_product_id = data.get('store_product_id')
        
        if not product_id and not store_product_id:
            raise serializers.ValidationError(
                "Either product_id or store_product_id is required"
            )
        
        if product_id and store_product_id:
            raise serializers.ValidationError(
                "Only one of product_id or store_product_id should be provided"
            )
        
        # Validate that product exists if provided
        if product_id:
            try:
                Product.objects.get(id=product_id, is_active=True)
            except Product.DoesNotExist:
                raise serializers.ValidationError({
                    "product_id": "Product not found or inactive"
                })
        
        # Validate that store product exists if provided
        if store_product_id:
            try:
                StoreProduct.objects.get(id=store_product_id, is_active=True)
            except StoreProduct.DoesNotExist:
                raise serializers.ValidationError({
                    "store_product_id": "Store product not found or inactive"
                })
        
        return data


# ==================== CURRENCY CONVERSION SERIALIZER ====================

class CurrencyConversionSerializer(serializers.Serializer):
    """Serializer for currency conversion"""
    amount = serializers.DecimalField(max_digits=20, decimal_places=6)
    from_currency = serializers.ChoiceField(choices=[('USD', 'USD'), ('SYP', 'SYP')])
    to_currency = serializers.ChoiceField(choices=[('USD', 'USD'), ('SYP', 'SYP')])
    
    def validate_amount(self, value):
        """Validate amount is positive"""
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0")
        return value
