# store/models.py - COMPLETE UPDATED VERSION
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from third_party_apis.models import ThirdPartyAPI 
import logging
import json
from decimal import Decimal

logger = logging.getLogger(__name__)
User = settings.AUTH_USER_MODEL

# Define currency choices here to avoid dependency on Wallet
CURRENCY_CHOICES = (
    ("USD", "US Dollar"),
    ("SYP", "Syrian Pound"),
)


class Section(models.Model):
    """Category/section for organizing products"""
    name_en = models.CharField(max_length=255, verbose_name="Name (English)")
    name_ar = models.CharField(max_length=255, verbose_name="Name (Arabic)")
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    image = models.ImageField(upload_to="sections/", blank=True, null=True, verbose_name="Section Image")
    
    father_section = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name="subsections",
        verbose_name="Parent Section",
        help_text="Leave blank if this is a main section"
    )
    
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    class Meta:
        ordering = ['name_en']
        verbose_name = "Section"
        verbose_name_plural = "Sections"
        indexes = [
            models.Index(fields=['is_active']),
            models.Index(fields=['father_section', 'is_active']),
            models.Index(fields=['name_en']),
            models.Index(fields=['name_ar']),
        ]

    def __str__(self):
        return f"{self.name_en} / {self.name_ar}"

    def clean(self):
        """Validate section data"""
        if self.father_section and self.father_section.id == self.id:
            raise ValidationError("Section cannot be its own parent")
        
        # Prevent circular references
        if self.father_section:
            current = self.father_section
            while current:
                if current.id == self.id:
                    raise ValidationError("Circular reference detected in section hierarchy")
                current = current.father_section

    @property
    def active_products_count(self):
        """Count of active products in this section"""
        return self.products.filter(is_active=True).count()

    @property
    def active_store_products_count(self):
        """Count of active store products in this section"""
        return self.store_products.filter(is_active=True).count()

    @property
    def all_active_products_count(self):
        """Count of all active products in this section and subsections"""
        count = self.active_products_count
        for subsection in self.subsections.filter(is_active=True):
            count += subsection.all_active_products_count
        return count

    @property
    def is_main_section(self):
        """Check if this is a main section (no parent)"""
        return self.father_section is None


class ProductRequirement(models.Model):
    """Field requirements for products (e.g., username, email, etc.)"""
    FIELD_TYPES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('email', 'Email'),
        ('phone', 'Phone'),
        ('id', 'ID'),
        ('textarea', 'Text Area'),
        ('url', 'URL'),
        ('date', 'Date'),
        ('select', 'Select'),
    )
    
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='requirements')
    field_name = models.CharField(max_length=255, verbose_name="Field Name")
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES, default='text', verbose_name="Field Type")
    is_required = models.BooleanField(default=True, verbose_name="Is Required")
    placeholder = models.CharField(max_length=255, blank=True, null=True, verbose_name="Placeholder Text")
    order = models.IntegerField(default=0, verbose_name="Display Order")
    
    # For select fields
    options = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="Options (for select fields)",
        help_text="Comma-separated values for select fields"
    )

    class Meta:
        ordering = ['order', 'field_name']
        verbose_name = "Product Requirement"
        verbose_name_plural = "Product Requirements"
        indexes = [
            models.Index(fields=['product', 'order']),
            models.Index(fields=['field_type']),
        ]

    def __str__(self):
        return f"{self.field_name} ({self.field_type}) - {self.product.name_en}"

    def get_options_list(self):
        """Get options as list for select fields"""
        if self.field_type == 'select' and self.options:
            return [opt.strip() for opt in self.options.split(',') if opt.strip()]
        return []

    def clean(self):
        """Validate requirement data"""
        if self.field_type == 'select' and not self.options:
            raise ValidationError("Select fields must have options")
        
        if self.options and self.field_type != 'select':
            raise ValidationError("Options can only be set for select field type")


class Product(models.Model):
    """Main product model with two types: amount-based and customization-based"""
    PRODUCT_TYPES = (
        ("amount_based", "Amount Based"),
        ("customization_based", "Customization Based"),
    )
    
    # Basic Information
    section = models.ForeignKey(
        Section, 
        related_name="products", 
        on_delete=models.CASCADE,
        verbose_name="Section"
    )
    
    # API Integration
    api_config = models.ForeignKey(
        ThirdPartyAPI, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name="API Configuration",
        help_text="API configuration for external services"
    )
    
    external_product = models.ForeignKey(
        'ExternalProduct', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='connected_products',
        verbose_name="External Product",
        help_text="Link to external product from API (optional)"
    )
    
    # Multilingual Names
    name_en = models.CharField(max_length=255, verbose_name="Name (English)")
    name_ar = models.CharField(max_length=255, verbose_name="Name (Arabic)")
    
    # Multilingual Descriptions
    description_en = models.TextField(blank=True, null=True, verbose_name="Description (English)")
    description_ar = models.TextField(blank=True, null=True, verbose_name="Description (Arabic)")
    
    # Product Type
    product_type = models.CharField(
        max_length=20, 
        choices=PRODUCT_TYPES, 
        default="amount_based",
        verbose_name="Product Type"
    )
    
    # Currency and Pricing
    currency = models.CharField(
        max_length=3, 
        choices=CURRENCY_CHOICES, 
        default="USD",
        verbose_name="Currency"
    )
    
    base_price = models.DecimalField(
        max_digits=20, 
        decimal_places=8,
        verbose_name="Base Price",
        help_text="Price per unit for amount-based and customization-based products."
    )

    product_profit_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("999.99"))],
        verbose_name="Additional Product Profit Percentage",
        help_text="Additional markup on the native base price; zero means no additional profit.",
    )
    
    # Amount-based product fields
    min_amount = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        null=True, 
        blank=True,
        verbose_name="Minimum Amount",
        help_text="Minimum amount user can purchase (for amount-based products)"
    )
    
    max_amount = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        null=True, 
        blank=True,
        verbose_name="Maximum Amount",
        help_text="Maximum amount user can purchase (for amount-based products)"
    )
    
    # Customization-based product fields (stored as JSON)
    customization_options = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="Customization Options",
        help_text="Comma-separated values, e.g. '200,250,300'"
    )
    
    # Media
    image = models.ImageField(
        upload_to="products/", 
        blank=True, 
        null=True,
        verbose_name="Product Image"
    )
    
    # Status
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    administrator_disabled = models.BooleanField(default=False, verbose_name="Disabled by administrator")
    provider_status = models.CharField(
        max_length=20, default="active",
        choices=[("active", "Active"), ("inactive", "Inactive"), ("unavailable", "Unavailable"), ("removed", "Removed")],
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    class Meta:
        ordering = ['name_en']
        verbose_name = "Product"
        verbose_name_plural = "Products"
        indexes = [
            models.Index(fields=['is_active', 'section']),
            models.Index(fields=['external_product']),
            models.Index(fields=['api_config']),
            models.Index(fields=['product_type', 'is_active']),
            models.Index(fields=['currency', 'is_active']),
            models.Index(fields=['name_en']),
            models.Index(fields=['name_ar']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.name_en} / {self.name_ar}"

    def clean(self):
        """Validate product data based on type"""
        if self.product_profit_percentage is None or self.product_profit_percentage < 0:
            raise ValidationError({"product_profit_percentage": "Product profit must be non-negative."})
        if self.product_profit_percentage > Decimal("999.99"):
            raise ValidationError({"product_profit_percentage": "Product profit cannot exceed 999.99%."})
        if self.product_type == "amount_based":
            # Amount-based products must have min and max amounts
            if not self.min_amount or not self.max_amount:
                raise ValidationError({
                    "min_amount": "Amount-based products require min_amount",
                    "max_amount": "Amount-based products require max_amount"
                })
            
            min_amount_decimal = Decimal(str(self.min_amount))
            max_amount_decimal = Decimal(str(self.max_amount))
            
            if min_amount_decimal <= 0:
                raise ValidationError({
                    "min_amount": "Min amount must be greater than 0"
                })
            
            # FIXED: Allow min_amount to equal max_amount (fixed quantity products)
            if min_amount_decimal > max_amount_decimal:
                raise ValidationError({
                    "min_amount": "Min amount cannot be greater than max amount"
                })
            
            # Base price must be positive for amount-based products
            if not self.base_price or Decimal(str(self.base_price)) <= 0:
                raise ValidationError({
                    "base_price": "Base price (price per unit) must be greater than 0 for amount-based products"
                })
                
        elif self.product_type == "customization_based":
            # Customization-based products must have options
            if not self.customization_options:
                raise ValidationError({
                    "customization_options": "Customization-based products require customization options"
                })

            raw_values = [v.strip() for v in str(self.customization_options).split(",") if v.strip()]
            if not raw_values:
                raise ValidationError({
                    "customization_options": "Customization options cannot be empty"
                })

            for value in raw_values:
                try:
                    price = Decimal(str(value))
                    if price <= 0:
                        raise ValidationError({
                            "customization_options": "Customization values must be greater than 0"
                        })
                except (ValueError, TypeError):
                    raise ValidationError({
                        "customization_options": f"Invalid value format: {value}"
                    })

            if not self.base_price or Decimal(str(self.base_price)) <= 0:
                raise ValidationError({
                    "base_price": "Base price (price per unit) must be greater than 0 for customization-based products"
                })
        
        # Validate external product link
        if self.external_product and self.external_product.api_config:
            if self.api_config and self.external_product.api_config != self.api_config:
                raise ValidationError({
                    "external_product": "External product must belong to the selected API"
                })

    def get_customization_data(self):
        """Returns customization options as list of dictionaries"""
        if self.product_type != "customization_based" or not self.customization_options:
            return []
        
        try:
            values = [v.strip() for v in str(self.customization_options).split(",") if v.strip()]
            options = []
            unit_price = Decimal(str(self.base_price)) if self.base_price else Decimal('0')
            for value in values:
                units = Decimal(str(value))
                price = units * unit_price
                options.append({
                    "value": value,
                    "units": units,
                    "unit_price": unit_price,
                    "price": price
                })
            return options
        except Exception:
            return []

    def calculate_price(self, amount=None, selected_option=None):
        """
        Calculate price based on amount or selected option
        
        Args:
            amount: For amount-based products
            selected_option: For customization-based products
            
        Returns:
            Decimal: Calculated price
        """
        from store.services.currency_service import CurrencyService
        
        if self.product_type == "amount_based" and amount is not None:
            # For amount-based products, base_price is price per unit
            try:
                # FIXED: Handle the case where min_amount = max_amount (fixed quantity)
                if self.min_amount and self.max_amount and Decimal(str(self.min_amount)) == Decimal(str(self.max_amount)):
                    # If min and max are equal, user can only buy that exact amount
                    amount_decimal = Decimal(str(amount))
                    min_amount_decimal = Decimal(str(self.min_amount))
                    
                    if amount_decimal != min_amount_decimal:
                        raise ValueError(f"Amount must be exactly {self.min_amount} for this product")
                    
                    return amount_decimal * Decimal(str(self.base_price))
                else:
                    # Normal range validation
                    return CurrencyService.calculate_amount_based_price(
                        amount=amount,
                        price_per_unit=self.base_price,
                        min_amount=self.min_amount,
                        max_amount=self.max_amount
                    )
            except ValueError as e:
                raise ValueError(str(e))
        
        elif self.product_type == "customization_based" and selected_option is not None:
            customization_data = self.get_customization_data()
            selected_str = str(selected_option).strip()
            for option in customization_data:
                if str(option.get('value')) == selected_str:
                    unit_price = Decimal(str(option.get('unit_price', self.base_price)))
                    units = Decimal(str(option.get('units', option['value'])))
                    return units * unit_price
            raise ValueError(f"Invalid option: {selected_option}")
        
        return None

    def get_price_info(self, user=None):
        """Get comprehensive price information for this product"""
        from store.services.price_service import PriceService
        
        try:
            price_info = PriceService.get_product_prices(self, user)
            
            # Add product-specific pricing info
            price_info.update({
                "product_type": self.product_type,
                "min_amount": float(self.min_amount) if self.min_amount else None,
                "max_amount": float(self.max_amount) if self.max_amount else None,
                "price_per_unit": float(self.base_price) if self.product_type == "amount_based" else None,
                "customization_options": self.get_customization_data() if self.product_type == "customization_based" else None,
            })
            
            return price_info
            
        except Exception as e:
            logger.error(f"Error getting price info for product {self.id}: {str(e)}")
            # Return basic info as fallback
            return {
                "base_currency": self.currency,
                "base_price": float(self.base_price),
                "product_type": self.product_type,
                "min_amount": float(self.min_amount) if self.min_amount else None,
                "max_amount": float(self.max_amount) if self.max_amount else None,
            }

    @property
    def has_external_product(self):
        """Check if product is linked to external API product"""
        return self.external_product is not None and self.external_product.is_active

    @property
    def is_available_for_purchase(self):
        """Check if product can be purchased"""
        return (
            self.is_active and not self.administrator_disabled and
            (
                (self.has_external_product and self.provider_status == "active" and self.external_product.provider_status == "active") or
                self.api_config is not None or
                self.product_type == "customization_based"  # Custom products don't need external API
            )
        )

    @property
    def price_range(self):
        """Get price range for amount-based products"""
        if self.product_type != "amount_based":
            return None
        
        if not self.min_amount or not self.max_amount or not self.base_price:
            return None
        
        try:
            min_price = self.calculate_price(amount=self.min_amount)
            max_price = self.calculate_price(amount=self.max_amount)
            return {
                "min": float(min_price),
                "max": float(max_price),
                "currency": self.currency
            }
        except Exception:
            return None

    @property
    def has_requirements(self):
        """Check if product has any requirements"""
        return self.requirements.exists()

    @property
    def is_fixed_quantity(self):
        """Check if this is a fixed quantity product (min = max)"""
        if self.product_type != "amount_based":
            return False
        
        if not self.min_amount or not self.max_amount:
            return False
        
        return Decimal(str(self.min_amount)) == Decimal(str(self.max_amount))


class Favorite(models.Model):
    """User favorites for products"""
    user = models.ForeignKey(
        User, 
        related_name="favorites", 
        on_delete=models.CASCADE,
        verbose_name="User"
    )
    
    product = models.ForeignKey(
        Product, 
        related_name="favorited_by", 
        on_delete=models.CASCADE,
        verbose_name="Product"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    class Meta:
        unique_together = ("user", "product")
        ordering = ['-created_at']
        verbose_name = "Favorite"
        verbose_name_plural = "Favorites"
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['product', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user} - {self.product.name_en}"

    def clean(self):
        """Validate favorite data"""
        if not self.product.is_active:
            raise ValidationError("Cannot favorite an inactive product")


class ExternalProduct(models.Model):
    """Read-only cache of products from external APIs"""
    api_config = models.ForeignKey(
        ThirdPartyAPI, 
        on_delete=models.CASCADE, 
        related_name='external_products',
        verbose_name="API Configuration"
    )
    
    external_id = models.CharField(
        max_length=255, 
        verbose_name="External ID",
        help_text="ID from the external API"
    )
    
    name = models.CharField(max_length=255, verbose_name="Product Name")
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    
    base_price = models.DecimalField(
        max_digits=20, 
        decimal_places=8,
        verbose_name="Base Price",
        help_text="Price from the external API"
    )
    
    category = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        verbose_name="Category",
        help_text="Category from external API"
    )
    
    required_fields_json = models.JSONField(
        default=list,
        verbose_name="Required Fields",
        help_text="Fields required by the external API (JSON format)"
    )
    
    external_data = models.JSONField(
        default=dict,
        verbose_name="External Data",
        help_text="Additional data from external API (JSON format)"
    )
    
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    provider_status = models.CharField(
        max_length=20, default="active",
        choices=[("active", "Active"), ("inactive", "Inactive"), ("unavailable", "Unavailable"), ("removed", "Removed")],
    )
    last_sync_error_code = models.CharField(max_length=80, blank=True)
    last_sync_error = models.TextField(blank=True)
    last_synced = models.DateTimeField(auto_now=True, verbose_name="Last Synced")

    class Meta:
        unique_together = ['api_config', 'external_id']
        ordering = ['category', 'name']
        verbose_name = "External Product"
        verbose_name_plural = "External Products"
        indexes = [
            models.Index(fields=['api_config', 'is_active']),
            models.Index(fields=['external_id']),
            models.Index(fields=['category', 'is_active']),
            models.Index(fields=['is_active']),
            models.Index(fields=['last_synced']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.api_config.provider})"

    def clean(self):
        """Validate external product data"""
        if not self.api_config.is_active:
            raise ValidationError({
                "api_config": "Cannot link to inactive API configuration"
            })

    @property
    def provider_name(self):
        """Get API provider name"""
        return self.api_config.provider if self.api_config else "Unknown"

    @property
    def required_fields(self):
        """Get required fields as list"""
        return self.required_fields_json if self.required_fields_json else []

    def has_required_fields(self):
        """Check if product has required fields"""
        return bool(self.required_fields_json)

    @property
    def is_available(self):
        """Check if external product is available for linking"""
        return (
            self.is_active and 
            self.api_config and 
            self.api_config.is_active
        )


class StoreProduct(models.Model):
    """Custom product with admin-defined name and price, linked to external product"""
    section = models.ForeignKey(
        'Section', 
        on_delete=models.CASCADE, 
        related_name='store_products',
        verbose_name="Section"
    )
    
    external_product = models.ForeignKey(
        ExternalProduct, 
        on_delete=models.CASCADE, 
        related_name='store_products',
        verbose_name="External Product"
    )
    
    # Admin-defined fields (override external product)
    name = models.CharField(
        max_length=255, 
        verbose_name="Product Name",
        help_text="Custom name for this product"
    )
    
    description = models.TextField(
        blank=True,
        verbose_name="Description",
        help_text="Custom description for this product"
    )
    
    price = models.DecimalField(
        max_digits=20, 
        decimal_places=8,
        verbose_name="Price",
        help_text="Custom price for this product"
    )
    currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default="USD",
        verbose_name="Currency"
    )
    
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    administrator_disabled = models.BooleanField(default=False, verbose_name="Disabled by administrator")
    provider_status = models.CharField(
        max_length=20, default="active",
        choices=[("active", "Active"), ("inactive", "Inactive"), ("unavailable", "Unavailable"), ("removed", "Removed")],
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    class Meta:
        ordering = ['name']
        verbose_name = "Store Product"
        verbose_name_plural = "Store Products"
        indexes = [
            models.Index(fields=['section', 'is_active']),
            models.Index(fields=['external_product']),
            models.Index(fields=['is_active']),
            models.Index(fields=['created_at']),
            models.Index(fields=['name']),
        ]
    
    def __str__(self):
        return f"{self.name} (Based on: {self.external_product.name})"

    def clean(self):
        """Validate store product data"""
        if not self.external_product.is_active:
            raise ValidationError({
                "external_product": "Cannot link to inactive external product"
            })
        
        if not self.external_product.api_config.is_active:
            raise ValidationError({
                "external_product": "API for this external product is not active"
            })
        
        if self.price <= 0:
            raise ValidationError({
                "price": "Price must be greater than 0"
            })
        
        # Check if external product is already used in this section
        existing = StoreProduct.objects.filter(
            section=self.section,
            external_product=self.external_product
        ).exclude(id=self.id).exists()
        
        if existing:
            raise ValidationError({
                "external_product": "This external product is already used in this section"
            })

    @property
    def original_product_name(self):
        """Get the original external product name"""
        return self.external_product.name if self.external_product else "Unknown"

    @property
    def provider_name(self):
        """Get API provider name"""
        return self.external_product.api_config.provider if self.external_product and self.external_product.api_config else "Unknown"

    @property
    def external_id(self):
        """Get external product ID"""
        return self.external_product.external_id if self.external_product else None

    @property
    def required_fields(self):
        """Get required fields from external product"""
        return self.external_product.required_fields if self.external_product else []

    @property
    def is_available_for_purchase(self):
        """Check if store product can be purchased"""
        return (
            self.is_active and not self.administrator_disabled and
            self.external_product and 
            self.provider_status == "active" and self.external_product.provider_status == "active" and
            self.external_product.is_active and
            self.external_product.api_config and
            self.external_product.api_config.is_active
        )

    @property
    def query_enabled(self):
        """Expose inquiry flag based on external product data."""
        if not self.external_product:
            return False
        external_data = self.external_product.external_data or {}
        inquiry_enabled = external_data.get("inquiry_enabled")
        if inquiry_enabled is None and isinstance(external_data.get("original_data"), dict):
            inquiry_enabled = external_data["original_data"].get("inquiry_enabled")
        return str(inquiry_enabled).lower() in {"1", "true", "yes"}

    def get_price_info(self, user=None):
        """Get comprehensive price information"""
        from store.services.price_service import PriceService
        
        try:
            # Create a mock product for price calculation
            class MockProduct:
                def __init__(self, price, currency="USD"):
                    self.base_price = price
                    self.currency = currency
            
            mock_product = MockProduct(self.price, self.currency)
            price_info = PriceService.get_product_prices(mock_product, user)
            
            # Add store product specific info
            price_info.update({
                "store_price": float(self.price),
                "original_external_price": float(self.external_product.base_price) if self.external_product else None,
                "price_difference": float(self.price - self.external_product.base_price) if self.external_product else None,
                "is_custom_price": self.price != self.external_product.base_price if self.external_product else True
            })
            
            return price_info
            
        except Exception as e:
            logger.error(f"Error getting store product price info: {str(e)}")
            return {
                "store_price": float(self.price),
                "converted_prices": {
                    "USD": float(self.price) if self.currency == "USD" else None,
                    "SYP": float(self.price) if self.currency == "SYP" else None,
                },
                "rate_available": False,
                "error_code": "FX_RATE_UNAVAILABLE",
            }

    def validate_user_inputs(self, user_inputs):
        """Validate user inputs against required fields"""
        if not self.external_product:
            return False, "No external product linked"
        
        required_fields = self.external_product.required_fields
        
        for field in required_fields:
            if isinstance(field, dict):
                field_name = field.get('field_name', '')
            else:
                field_name = str(field)
                
            if field_name and field_name not in user_inputs:
                return False, f"Missing required field: {field_name}"
        
        return True, "Valid"
