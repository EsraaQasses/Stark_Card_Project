from django.db import models
from django.conf import settings
from wallets.models import Wallet
from django.core.exceptions import ValidationError
from third_party_apis.models import ThirdPartyAPI 
import logging

logger = logging.getLogger(__name__)
User = settings.AUTH_USER_MODEL

class Section(models.Model):
    name_en = models.CharField(max_length=255)
    name_ar = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to="sections/", blank=True, null=True)
    father_section = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name="subsections"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name_en']

    def __str__(self):
        return f"{self.name_en} / {self.name_ar}"

    @property
    def active_products_count(self):
        """Count of active products in this section"""
        return self.products.filter(is_active=True).count()

    @property
    def active_store_products_count(self):
        """Count of active store products in this section"""
        return self.store_products.filter(is_active=True).count()


class ProductRequirement(models.Model):
    FIELD_TYPES = (
        ('text', 'Text'),
        ('number', 'Number'),
        ('email', 'Email'),
        ('phone', 'Phone'),
        ('id', 'ID'),
    )
    
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='requirements')
    field_name = models.CharField(max_length=255)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES)
    is_required = models.BooleanField(default=True)
    placeholder = models.CharField(max_length=255, blank=True, null=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.field_name} ({self.field_type}) - {self.product.name_en}"


class Product(models.Model):
    PRODUCT_TYPES = (
        ("amount_based", "Amount Based"),
        ("customization_based", "Customization Based"),
    )
    
    CURRENCY_CHOICES = (
        ("USD", "US Dollar"),
        ("SYP", "Syrian Pound"),
    )
    
    section = models.ForeignKey(Section, related_name="products", on_delete=models.CASCADE)
    api_config = models.ForeignKey(ThirdPartyAPI, on_delete=models.SET_NULL, null=True, blank=True)
    external_product = models.ForeignKey(
        'ExternalProduct', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='connected_products',
        help_text="Link to external product from API"
    )
    name_en = models.CharField(max_length=255)
    name_ar = models.CharField(max_length=255)
    
    description_en = models.TextField(blank=True, null=True)
    description_ar = models.TextField(blank=True, null=True)
    
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default="amount_based")
    
    # Currency fields
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default="USD")
    base_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Price in the selected currency"
    )
    
    min_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    max_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    min_amount_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Price for the minimum amount in the selected currency"
    )
    price_per_unit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True, 
        blank=True,
        editable=False,
        help_text="Automatically calculated: min_amount_price / min_amount"
    )
    
    customization_options = models.TextField(blank=True, null=True, help_text="Comma-separated values: option1,option2,option3")
    customization_prices = models.TextField(blank=True, null=True, help_text="Comma-separated prices in selected currency: 10,15,20")
    
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name_en']
        indexes = [
            models.Index(fields=['is_active', 'section']),
            models.Index(fields=['external_product']),
            models.Index(fields=['api_config']),
        ]

    def __str__(self):
        return f"{self.name_en} / {self.name_ar}"

    def save(self, *args, **kwargs):
        if self.product_type == "amount_based" and self.min_amount and self.min_amount_price:
            if self.min_amount > 0:
                self.price_per_unit = self.min_amount_price / self.min_amount
            else:
                self.price_per_unit = 0
        elif self.product_type == "customization_based":
            self.price_per_unit = None
        
        super().save(*args, **kwargs)

    def clean(self):
        if self.product_type == "amount_based":
            if self.min_amount and self.max_amount and self.min_amount >= self.max_amount:
                raise ValidationError("Min amount must be less than max amount")
            if self.min_amount and self.min_amount <= 0:
                raise ValidationError("Min amount must be greater than 0")
                
        elif self.product_type == "customization_based":
            if self.customization_options and self.customization_prices:
                options = [opt.strip() for opt in self.customization_options.split(',') if opt.strip()]
                prices = [price.strip() for price in self.customization_prices.split(',') if price.strip()]
                
                if len(options) != len(prices):
                    raise ValidationError("Number of options must match number of prices")
                
                try:
                    [float(price) for price in prices]
                except ValueError:
                    raise ValidationError("All prices must be valid numbers")

    def get_customization_data(self):
        """Returns customization options with prices as list of tuples"""
        if self.product_type != "customization_based":
            return []
        
        options = [opt.strip() for opt in self.customization_options.split(',') if opt.strip()]
        prices = [price.strip() for price in self.customization_prices.split(',') if price.strip()]
        
        return list(zip(options, prices))

    def calculate_price(self, amount=None, selected_option=None):
        """Calculate price based on amount or selected option in base currency"""
        if self.product_type == "amount_based" and amount is not None:
            if amount < self.min_amount or amount > self.max_amount:
                raise ValueError(f"Amount must be between {self.min_amount} and {self.max_amount}")
            return float(amount) * float(self.price_per_unit)
        
        elif self.product_type == "customization_based" and selected_option is not None:
            customization_data = self.get_customization_data()
            for option, price in customization_data:
                if option == selected_option:
                    return float(price)
            raise ValueError(f"Invalid option: {selected_option}")
        
        return None

    def get_converted_prices(self, exchange_rates):
        """
        Calculate converted prices based on current exchange rates
        Returns: base_price_usd, base_price_syp, converted_price_usd, converted_price_syp
        """
        usd_to_syp = exchange_rates.get("usd_to_syp", {}).get("value", 1)
        syp_to_usd = exchange_rates.get("syp_to_usd", {}).get("value", 1)
        
        if self.currency == "USD":
            base_price_usd = float(self.base_price)
            base_price_syp = float(self.base_price) * float(usd_to_syp)
            converted_price_usd = base_price_usd
            converted_price_syp = base_price_syp
        else:  # SYP
            base_price_syp = float(self.base_price)
            base_price_usd = float(self.base_price) * float(syp_to_usd)
            converted_price_usd = base_price_usd
            converted_price_syp = base_price_syp
            
        return {
            "base_currency": self.currency,
            "base_price": float(self.base_price),
            "converted_prices": {
                "USD": converted_price_usd,
                "SYP": converted_price_syp
            }
        }

    @property
    def has_external_product(self):
        """Check if product is linked to external API product"""
        return self.external_product is not None and self.external_product.is_active

    @property
    def is_available_for_purchase(self):
        """Check if product can be purchased"""
        return (self.is_active and 
                (self.has_external_product or self.api_config is not None))


class Package(models.Model):
    product = models.ForeignKey("Product", related_name="packages", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.product.name})"

    @property
    def image(self):
        return self.product.image.url if self.product.image else None

    @property
    def is_available(self):
        """Check if package is available for purchase"""
        return self.is_active and self.product.is_active


class PackagePrice(models.Model):
    CURRENCY_CHOICES = Wallet.CURRENCY_CHOICES
    package = models.ForeignKey(Package, related_name="prices", on_delete=models.CASCADE)
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = ("package", "currency")
        indexes = [
            models.Index(fields=['package', 'currency']),
        ]

    def __str__(self):
        return f"{self.package.name} - {self.currency}: {self.amount}"


class Favorite(models.Model):
    user = models.ForeignKey(User, related_name="favorites", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, related_name="favorited_by", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.product.name}"


class ExternalProduct(models.Model):
    """Read-only cache of products from external APIs"""
    api_config = models.ForeignKey(ThirdPartyAPI, on_delete=models.CASCADE, related_name='external_products')
    external_id = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, blank=True)
    required_fields_json = models.JSONField(default=list)
    external_data = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    last_synced = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['api_config', 'external_id']
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['api_config', 'is_active']),
            models.Index(fields=['external_id']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.api_config.provider})"

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


class StoreProduct(models.Model):
    """Custom product with admin-defined name and price"""
    section = models.ForeignKey('Section', on_delete=models.CASCADE, related_name='store_products')
    external_product = models.ForeignKey(ExternalProduct, on_delete=models.CASCADE, related_name='store_products')
    
    # Admin-defined fields
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['section', 'is_active']),
            models.Index(fields=['external_product']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} (Based on: {self.external_product.name})"

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
        return (self.is_active and 
                self.external_product and 
                self.external_product.is_active and
                self.external_product.api_config and
                self.external_product.api_config.is_active)

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