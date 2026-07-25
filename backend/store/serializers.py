from rest_framework import serializers
from .models import (
    Section, Product, ProductRequirement, Package, PackagePrice, Favorite, 
    StoreProduct, ExternalProduct
)
from wallets.views import WalletService
import json

class SectionSerializer(serializers.ModelSerializer):
    subsections = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True)  # Make it writable
    products_count = serializers.SerializerMethodField()
    father_section_name = serializers.CharField(source='father_section.name_en', read_only=True, allow_null=True)

    class Meta:
        model = Section
        fields = [
            "id", "name_en", "name_ar", "description", "image", 
            "father_section", "father_section_name", "subsections", 
            "products_count", "created_at", "updated_at", "is_active"
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_subsections(self, obj):
        return SectionSerializer(
            obj.subsections.all(),
            many=True,
            context=self.context
        ).data

    def get_products_count(self, obj):
        return obj.products.count()


class ProductRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductRequirement
        fields = ["id", "field_name", "field_type", "is_required", "placeholder", "order"]

class ProductSerializer(serializers.ModelSerializer):
    requirements = ProductRequirementSerializer(many=True, read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)  # CHANGE THIS
    section_name_en = serializers.CharField(source='section.name_en', read_only=True)
    section_name_ar = serializers.CharField(source='section.name_ar', read_only=True)
    api_name = serializers.CharField(source='api_config.name', read_only=True)
    customization_data = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    calculated_price_per_unit = serializers.DecimalField(
        source='price_per_unit', 
        max_digits=10, 
        decimal_places=4, 
        read_only=True
    )
    
    # New currency fields
    prices = serializers.SerializerMethodField()
    base_currency = serializers.CharField(source='currency', read_only=True)
    base_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    external_product_info = serializers.SerializerMethodField()
    available_external_products = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = Product
        fields = [
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "section", "section_name_en", "section_name_ar", "api_config", "api_name",
            "product_type", "min_amount", "max_amount", "min_amount_price",
            "calculated_price_per_unit", "customization_options", "customization_prices", 
            "customization_data", "requirements", "image", "is_active", "is_favorite", 
            "base_currency", "base_price", "prices", "created_at",
            "external_product", "external_product_info", "available_external_products"  # ADD THESE
        ]
        read_only_fields = ['price_per_unit', 'created_at']

    def get_external_product_info(self, obj):
        if obj.external_product:
            return {
                'id': obj.external_product.id,
                'name': obj.external_product.name,
                'external_id': obj.external_product.external_id,
                'provider': obj.external_product.api_config.provider,
                'base_price': obj.external_product.base_price,
                'required_fields': obj.external_product.required_fields_json
            }
        return None

    def get_available_external_products(self, obj):
        """Get available external products for the selected API"""
        if obj.api_config:
            external_products = ExternalProduct.objects.filter(
                api_config=obj.api_config,
                is_active=True
            )[:50]  # Limit to 50 to avoid performance issues
            return ExternalProductSerializer(external_products, many=True).data
        return []
    def get_customization_data(self, obj):
        return obj.get_customization_data()

    def get_is_favorite(self, obj):
        request = self.context.get("request")
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.favorited_by.filter(user=request.user).exists()
        return False

    def get_prices(self, obj):
        """Calculate real-time converted prices using current exchange rates"""
        try:
            # Get current exchange rates
            exchange_rates = WalletService.get_exchange_rates()
            
            # Get converted prices
            price_data = obj.get_converted_prices(exchange_rates)
            
            return {
                "base_currency": price_data["base_currency"],
                "base_price": price_data["base_price"],
                "converted": price_data["converted_prices"],
                "exchange_rates": {
                    "usd_to_syp": exchange_rates.get("usd_to_syp", {}).get("value", 1),
                    "syp_to_usd": exchange_rates.get("syp_to_usd", {}).get("value", 1)
                }
            }
        except Exception as e:
            # Fallback in case of error
            return {
                "base_currency": obj.currency,
                "base_price": float(obj.base_price),
                "converted": {
                    "USD": float(obj.base_price) if obj.currency == "USD" else float(obj.base_price) * 0.000077,
                    "SYP": float(obj.base_price) if obj.currency == "SYP" else float(obj.base_price) * 13000
                },
                "exchange_rates": {
                    "usd_to_syp": 13000,
                    "syp_to_usd": 0.000077
                }
            }

    def validate(self, data):
        product_type = data.get("product_type")
        
        if product_type == "amount_based":
            min_amount = data.get("min_amount")
            max_amount = data.get("max_amount")
            price_per_unit = data.get("price_per_unit")
            
            if not all([min_amount, max_amount, price_per_unit]):
                raise serializers.ValidationError("Amount based products require min_amount, max_amount, and price_per_unit")
            if min_amount >= max_amount:
                raise serializers.ValidationError("Min amount must be less than max amount")
                
        elif product_type == "customization_based":
            customization_options = data.get("customization_options")
            customization_prices = data.get("customization_prices")
            
            if not customization_options or not customization_prices:
                raise serializers.ValidationError("Customization based products require both options and prices")
            
            options = [opt.strip() for opt in customization_options.split(',') if opt.strip()]
            prices = [price.strip() for price in customization_prices.split(',') if price.strip()]
            
            if len(options) != len(prices):
                raise serializers.ValidationError("Number of options must match number of prices")
            
            try:
                [float(price) for price in prices]
            except ValueError:
                raise serializers.ValidationError("All prices must be valid numbers")

        return data

class ProductCreateSerializer(serializers.ModelSerializer):
    requirements = ProductRequirementSerializer(many=True, required=False)
    calculated_price_per_unit = serializers.DecimalField(
        max_digits=10, 
        decimal_places=4, 
        read_only=True
    )
    image = serializers.ImageField(required=False, allow_null=True)  # ADD THIS
    
    # Add currency and base_price for creation
    currency = serializers.ChoiceField(choices=Product.CURRENCY_CHOICES)
    base_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    external_product_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = [
            "id", "name_en", "name_ar", "description_en", "description_ar",
            "section", "api_config", "external_product_id",  # ADD external_product_id
            "product_type", "currency", "base_price",
            "min_amount", "max_amount", "min_amount_price", 
            "calculated_price_per_unit",
            "customization_options", "customization_prices", "image", "is_active", 
            "requirements"
        ]

    def create(self, validated_data):
        external_product_id = validated_data.pop('external_product_id', None)
        requirements_data = validated_data.pop('requirements', [])
        
        # Set external_product if provided
        if external_product_id:
            try:
                external_product = ExternalProduct.objects.get(id=external_product_id)
                validated_data['external_product'] = external_product
            except ExternalProduct.DoesNotExist:
                raise serializers.ValidationError({"external_product_id": "External product not found"})
        
        # ✅ FIX: Create the product instance
        product = Product.objects.create(**validated_data)
        
        # ✅ FIX: Create requirements
        for req_data in requirements_data:
            ProductRequirement.objects.create(product=product, **req_data)
        
        # ✅ FIX: Return the created instance
        return product  # THIS WAS MISSING

    def update(self, instance, validated_data):
        requirements_data = validated_data.pop('requirements', None)
        
        # Update product fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Recalculate price_per_unit if amount-based fields changed
        if instance.product_type == "amount_based" and instance.min_amount and instance.min_amount_price:
            if instance.min_amount > 0:
                instance.price_per_unit = instance.min_amount_price / instance.min_amount
        
        instance.save()
        
        # Update requirements if provided
        if requirements_data is not None:
            instance.requirements.all().delete()
            for req_data in requirements_data:
                ProductRequirement.objects.create(product=instance, **req_data)
                
        return instance

    def to_internal_value(self, data):
        # Handle requirements JSON string from frontend
        if 'requirements' in data and isinstance(data['requirements'], str):
            try:
                data['requirements'] = json.loads(data['requirements'])
            except json.JSONDecodeError:
                pass
        return super().to_internal_value(data)

class PackagePriceSerializer(serializers.ModelSerializer):
    converted_prices = serializers.SerializerMethodField()
    
    class Meta:
        model = PackagePrice
        fields = ["id", "currency", "amount", "converted_prices"]

    def get_converted_prices(self, obj):
        """Calculate real-time converted prices for package"""
        try:
            exchange_rates = WalletService.get_exchange_rates()
            usd_to_syp = exchange_rates.get("usd_to_syp", {}).get("value", 1)
            syp_to_usd = exchange_rates.get("syp_to_usd", {}).get("value", 1)
            
            if obj.currency == "USD":
                return {
                    "USD": float(obj.amount),
                    "SYP": float(obj.amount) * float(usd_to_syp)
                }
            else:  # SYP
                return {
                    "USD": float(obj.amount) * float(syp_to_usd),
                    "SYP": float(obj.amount)
                }
        except Exception:
            # Fallback
            if obj.currency == "USD":
                return {
                    "USD": float(obj.amount),
                    "SYP": float(obj.amount) * 13000
                }
            else:
                return {
                    "USD": float(obj.amount) * 0.000077,
                    "SYP": float(obj.amount)
                }
class PackageSerializer(serializers.ModelSerializer):
    prices = PackagePriceSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = Package
        fields = ["id", "name", "is_active", "product", "image", "prices"]

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.product.image and request:
            return request.build_absolute_uri(obj.product.image.url)
        return obj.product.image.url if obj.product.image else None

class FavoriteSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "product"]
        

class PurchaseSerializer(serializers.Serializer):
    store_product_id = serializers.IntegerField()
    user_inputs = serializers.JSONField()
    
    def validate_store_product_id(self, value):
        try:
            product = StoreProduct.objects.get(id=value, is_active=True)
            return value
        except StoreProduct.DoesNotExist:
            raise serializers.ValidationError("Product not found or inactive")
    
    def validate_user_inputs(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("User inputs must be a JSON object")
        return value

class StoreProductSerializer(serializers.ModelSerializer):
    external_product_info = serializers.SerializerMethodField()
    section_name = serializers.CharField(source='section.name', read_only=True)
    
    class Meta:
        model = StoreProduct
        fields = [
            "id", "name", "description", "price", "section", "section_name",
            "external_product", "external_product_info", "is_active"
        ]
        read_only_fields = ["external_product", "external_product_info"]
    
    def get_external_product_info(self, obj):
        return {
            'original_name': obj.external_product.name,
            'provider': obj.external_product.api_config.provider,
            'base_price': obj.external_product.base_price,
            'required_fields': obj.external_product.required_fields_json
        }

class ExternalProductSerializer(serializers.ModelSerializer):
    api_name = serializers.CharField(source='api_config.name', read_only=True)
    provider = serializers.CharField(source='api_config.provider', read_only=True)
    
    class Meta:
        model = ExternalProduct
        fields = [
            'id', 'external_id', 'name', 'description', 'base_price',
            'category', 'required_fields_json', 'api_config', 'api_name',
            'provider', 'is_active', 'last_synced'
        ]

class StoreProductCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreProduct
        fields = [
            'id', 'section', 'external_product', 'name', 'description', 
            'price', 'is_active'
        ]
    
    def validate(self, attrs):
        # Validate that external_product belongs to selected API
        external_product = attrs.get('external_product')
        if external_product and not external_product.is_active:
            raise serializers.ValidationError("External product is not active")
        return attrs