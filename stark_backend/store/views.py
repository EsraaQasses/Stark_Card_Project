# store/views.py
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Count, Prefetch, Q
from django.db import transaction
from decimal import Decimal, InvalidOperation
import time
import logging

from .models import (
    Favorite, Section, Product, StoreProduct, 
    ExternalProduct, ProductRequirement
)
from .serializers import (
    SectionSerializer,
    ProductSerializer,
    ProductCreateUpdateSerializer,
    ProductRequirementSerializer,
    FavoriteSerializer,
    PurchaseSerializer,
    UserPurchaseListSerializer,
    StoreProductSerializer,
    StoreProductCreateSerializer,
    ExternalProductSerializer,
    UserProductSerializer
)
from users.permissions import IsAdminUser, IsRegularUser
from users.utils.audit_logger import AuditLogger
from transactions.services.purchase_service import PurchaseService
from transactions.models import Transaction
from store.services.currency_service import CurrencyService
from store.services.price_service import PriceService
from wallets.rate_quotes import ExchangeRateQuoteService
from third_party_apis.utils.connectors import ConnectorFactory
from drf_spectacular.utils import OpenApiResponse, extend_schema

logger = logging.getLogger(__name__)


def _product_display_conversion(product, amount, target_currency, quote):
    return PriceService.convert_product_price(
        amount=amount, source_currency=product.currency,
        target_currency=target_currency, quote=quote if quote is not None else False,
    )


# ==================== ADMIN VIEWSETS ====================

class SectionViewSet(viewsets.ModelViewSet):
    """
    Admin viewset for managing sections.
    Only accessible by admin users.
    """
    queryset = Section.objects.all()
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = SectionSerializer

    def get_queryset(self):
        """Optimize queries with related data."""
        return Section.objects.select_related(
            'father_section'
        ).prefetch_related(
            Prefetch(
                'subsections',
                queryset=Section.objects.filter(is_active=True)
                .annotate(
                    active_products_count_optimized=Count(
                        'products', filter=Q(products__is_active=True), distinct=True
                    ),
                    active_store_products_count_optimized=Count(
                        'store_products', filter=Q(store_products__is_active=True), distinct=True
                    ),
                )
                .order_by('name_en'),
                to_attr='active_subsections',
            ),
            'products'
        ).annotate(
            active_products_count_optimized=Count(
                'products', filter=Q(products__is_active=True), distinct=True
            ),
            active_store_products_count_optimized=Count(
                'store_products', filter=Q(store_products__is_active=True), distinct=True
            ),
        ).order_by('name_en')

    def get_serializer_context(self):
        """Add request context to serializer."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def update(self, request, *args, **kwargs):
        """Handle file uploads properly during updates."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(
            instance, 
            data=request.data, 
            partial=partial
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Handle file uploads properly during creation."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        return Response(
            serializer.data, 
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def main_sections(self, request):
        """Get only main sections (without parent sections)."""
        main_sections = Section.objects.filter(
            father_section__isnull=True,
            is_active=True
        ).order_by('name_en')
        
        serializer = self.get_serializer(main_sections, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get statistics for a section."""
        section = self.get_object()
        
        return Response({
            'id': section.id,
            'name': section.name_en,
            'active_products_count': section.active_products_count,
            'active_store_products_count': section.active_store_products_count,
            'total_sub_sections': section.subsections.filter(is_active=True).count()
        })


class ProductViewSet(viewsets.ModelViewSet):
    """
    Admin viewset for managing products.
    Only accessible by admin users.
    """
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        """Use different serializer for create/update operations."""
        if self.action in ['create', 'update', 'partial_update']:
            return ProductCreateUpdateSerializer
        return ProductSerializer

    def get_queryset(self):
        """Optimize queries with related data."""
        queryset = Product.objects.select_related(
            'section',
            'section__father_section',
            'api_config',
            'external_product'
        ).prefetch_related('requirements')
        if self.request.user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'favorited_by',
                    queryset=Favorite.objects.filter(user=self.request.user),
                    to_attr='current_user_favorites',
                )
            )
        queryset = queryset.order_by('name_en')
        
        # Apply filters if provided
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
            
        section_id = self.request.query_params.get('section_id')
        if section_id:
            queryset = queryset.filter(section_id=section_id)
            
        return queryset

    def get_serializer_context(self):
        """Add request context to serializer."""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def create(self, request, *args, **kwargs):
        """Create a new product with requirements."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        store_product = None
        with transaction.atomic():
            product = serializer.save()
            AuditLogger.log(
                request, "PRODUCT_PROFIT_CHANGE", "product", product.id,
                {"previous_percentage": None, "new_percentage": str(product.product_profit_percentage),
                 "reason": request.data.get("reason")},
            )
            if product.external_product:
                store_product, created = StoreProduct.objects.get_or_create(
                    external_product=product.external_product,
                    section=product.section,
                    defaults={
                        "name": product.name_en or product.name_ar or product.external_product.name,
                        "description": product.description_en or product.description_ar or "",
                        "price": product.base_price,
                        "currency": product.currency,
                        "is_active": product.is_active,
                    },
                )
                if not created:
                    store_product.name = product.name_en or product.name_ar or store_product.name
                    store_product.description = product.description_en or product.description_ar or store_product.description
                    store_product.price = product.base_price
                    store_product.currency = product.currency
                    store_product.is_active = product.is_active
                    store_product.save()

        return Response(
            {
                "success": True,
                "id": product.id,
                "store_product_id": store_product.id if store_product else None,
                "product_profit_percentage": str(product.product_profit_percentage),
                "message": "Product created successfully",
            },
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        """Update an existing product."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        previous_product_profit = instance.product_profit_percentage
        
        serializer = self.get_serializer(
            instance, 
            data=request.data, 
            partial=partial
        )
        serializer.is_valid(raise_exception=True)
        store_product = None
        with transaction.atomic():
            product = serializer.save()
            if previous_product_profit != product.product_profit_percentage:
                AuditLogger.log(
                    request, "PRODUCT_PROFIT_CHANGE", "product", product.id,
                    {"previous_percentage": str(previous_product_profit),
                     "new_percentage": str(product.product_profit_percentage),
                     "reason": request.data.get("reason")},
                )
            if product.external_product:
                store_product, created = StoreProduct.objects.get_or_create(
                    external_product=product.external_product,
                    section=product.section,
                    defaults={
                        "name": product.name_en or product.name_ar or product.external_product.name,
                        "description": product.description_en or product.description_ar or "",
                        "price": product.base_price,
                        "currency": product.currency,
                        "is_active": product.is_active,
                    },
                )
                if not created:
                    store_product.name = product.name_en or product.name_ar or store_product.name
                    store_product.description = product.description_en or product.description_ar or store_product.description
                    store_product.price = product.base_price
                    store_product.currency = product.currency
                    store_product.is_active = product.is_active
                    store_product.save()

        return Response(
            {
                "success": True,
                "id": product.id,
                "store_product_id": store_product.id if store_product else None,
                "product_profit_percentage": str(product.product_profit_percentage),
                "message": "Product updated successfully",
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get', 'post', 'delete'])
    def requirements(self, request, pk=None):
        """
        Manage product requirements.
        
        GET: List all requirements
        POST: Create a new requirement
        DELETE: Delete a requirement (requires requirement_id in request body)
        """
        product = self.get_object()
        
        if request.method == 'GET':
            requirements = product.requirements.all().order_by('order')
            serializer = ProductRequirementSerializer(requirements, many=True)
            return Response(serializer.data)
            
        elif request.method == 'POST':
            serializer = ProductRequirementSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(product=product)
                return Response(
                    serializer.data, 
                    status=status.HTTP_201_CREATED
                )
            return Response(
                serializer.errors, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        elif request.method == 'DELETE':
            requirement_id = request.data.get('requirement_id')
            
            if not requirement_id:
                return Response(
                    {"error": "requirement_id is required in request body"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                requirement = product.requirements.get(id=requirement_id)
                requirement.delete()
                return Response(
                    {"message": "Requirement deleted successfully"},
                    status=status.HTTP_204_NO_CONTENT
                )
            except ProductRequirement.DoesNotExist:
                return Response(
                    {"error": "Requirement not found for this product"},
                    status=status.HTTP_404_NOT_FOUND
                )

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle product active status."""
        product = self.get_object()
        product.is_active = not product.is_active
        product.administrator_disabled = not product.is_active
        product.save()
        
        return Response({
            "id": product.id,
            "name": product.name_en,
            "is_active": product.is_active,
            "message": f"Product {'activated' if product.is_active else 'deactivated'}"
        })

    @action(detail=False, methods=['post'])
    def bulk_toggle(self, request):
        """
        Bulk enable/disable products.
        
        Required in request body:
        - product_ids: List of product IDs
        - is_active: Boolean (true/false)
        """
        product_ids = request.data.get('product_ids', [])
        is_active = request.data.get('is_active')
        
        if not product_ids:
            return Response(
                {"error": "product_ids array is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if is_active is None:
            return Response(
                {"error": "is_active boolean is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate that all product IDs exist
        existing_ids = set(
            Product.objects.filter(id__in=product_ids).values_list('id', flat=True)
        )
        invalid_ids = set(product_ids) - existing_ids
        
        if invalid_ids:
            return Response(
                {
                    "error": "Some product IDs not found",
                    "invalid_ids": list(invalid_ids)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updated_count = Product.objects.filter(
            id__in=product_ids
        ).update(is_active=is_active)
        
        return Response({
            "message": f"Updated {updated_count} products",
            "is_active": is_active,
            "updated_count": updated_count,
            "updated_ids": product_ids
        })

    @action(detail=False, methods=['post'], url_path='bulk-update-profit')
    def bulk_update_profit(self, request):
        """Set one additive product-profit percentage for selected products."""
        product_ids = request.data.get("product_ids", [])
        raw_percentage = request.data.get("product_profit_percentage")
        if not product_ids or raw_percentage is None:
            return Response(
                {"error": "product_ids and product_profit_percentage are required",
                 "error_code": "PRODUCT_PROFIT_INVALID"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            percentage = Decimal(str(raw_percentage))
        except (InvalidOperation, ValueError):
            return Response(
                {"error": "Product profit must be a decimal percentage",
                 "error_code": "PRODUCT_PROFIT_INVALID"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if percentage < 0:
            return Response({"error": "Product profit must be non-negative",
                             "error_code": "PRODUCT_PROFIT_INVALID"}, status=status.HTTP_400_BAD_REQUEST)
        if percentage > Decimal("999.99"):
            return Response({"error": "Product profit cannot exceed 999.99%",
                             "error_code": "PRODUCT_PROFIT_OUT_OF_RANGE"}, status=status.HTTP_400_BAD_REQUEST)
        products = list(Product.objects.filter(id__in=product_ids))
        if len(products) != len(set(product_ids)):
            return Response({"error": "Some product IDs not found"}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            for product in products:
                previous = product.product_profit_percentage
                product.product_profit_percentage = percentage
                product.save(update_fields=["product_profit_percentage", "updated_at"])
                if previous != percentage:
                    AuditLogger.log(
                        request, "PRODUCT_PROFIT_CHANGE", "product", product.id,
                        {"previous_percentage": str(previous), "new_percentage": str(percentage),
                         "reason": request.data.get("reason"), "bulk": True},
                    )
        return Response({"updated_count": len(products), "product_profit_percentage": str(percentage)})

    @action(detail=True, methods=['get'])
    def price_calculator(self, request, pk=None):
        """Calculate price for different amounts/options."""
        product = self.get_object()
        amount = request.query_params.get('amount')
        selected_option = request.query_params.get('selected_option')
        wallet_currency = request.query_params.get('wallet_currency')

        if wallet_currency:
            wallet_currency = wallet_currency.upper()
            if wallet_currency not in ["USD", "SYP"]:
                return Response(
                    {"error": "Invalid wallet_currency. Use USD or SYP"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            if product.product_type == "amount_based" and amount:
                calculated_price = product.calculate_price(amount=float(amount))
                user_final_price = PriceService.calculate_pricing(
                    amount=calculated_price, source_currency=product.currency, user=request.user,
                    product=product,
                ).native_final_amount
                response_data = {
                    "amount": float(amount),
                    "price_per_unit": float(product.base_price),
                    "calculated_price": float(calculated_price),
                    "user_final_price": float(user_final_price),
                    "currency": product.currency
                }
            elif product.product_type == "customization_based" and selected_option:
                calculated_price = product.calculate_price(selected_option=selected_option)
                user_final_price = PriceService.calculate_pricing(
                    amount=calculated_price, source_currency=product.currency, user=request.user,
                    product=product,
                ).native_final_amount
                response_data = {
                    "selected_option": selected_option,
                    "selected_units": float(selected_option),
                    "price_per_unit": float(product.base_price),
                    "calculated_price": float(calculated_price),
                    "user_final_price": float(user_final_price),
                    "currency": product.currency
                }
            else:
                return Response({
                    "error": "Invalid parameters for product type",
                    "product_type": product.product_type,
                    "required_params": {
                        "amount_based": ["amount"],
                        "customization_based": ["selected_option"]
                    }
                }, status=status.HTTP_400_BAD_REQUEST)

            if wallet_currency:
                quote = ExchangeRateQuoteService.get_active_quote()
                unit_meta = _product_display_conversion(product, product.base_price, wallet_currency, quote)
                calculated_meta = _product_display_conversion(product, calculated_price, wallet_currency, quote)
                final_meta = _product_display_conversion(product, user_final_price, wallet_currency, quote)
                response_data.update({
                    "wallet_currency": wallet_currency,
                    "wallet_price_per_unit": unit_meta["converted_amount"],
                    "wallet_calculated_price": calculated_meta["converted_amount"],
                    "wallet_user_final_price": final_meta["converted_amount"],
                    "price_conversions": {
                        "price_per_unit": unit_meta,
                        "calculated_price": calculated_meta,
                        "user_final_price": final_meta,
                    },
                })

            return Response(response_data)
                
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


# ==================== USER VIEWSETS ====================

class UserSectionListView(viewsets.ReadOnlyModelViewSet):
    """
    User view for browsing sections.
    Only shows active sections with products.
    """
    permission_classes = [IsRegularUser]
    serializer_class = SectionSerializer
    
    def get_queryset(self):
        """Return only active sections that have active products."""
        return Section.objects.filter(
            is_active=True,
            father_section__isnull=True  # Only main sections
        ).prefetch_related(
            Prefetch(
                'subsections',
                queryset=Section.objects.filter(is_active=True)
                .annotate(
                    active_products_count_optimized=Count(
                        'products', filter=Q(products__is_active=True), distinct=True
                    ),
                    active_store_products_count_optimized=Count(
                        'store_products', filter=Q(store_products__is_active=True), distinct=True
                    ),
                )
                .order_by('name_en'),
                to_attr='active_subsections',
            ),
            'products'
        ).annotate(
            active_products_count_optimized=Count(
                'products', filter=Q(products__is_active=True), distinct=True
            ),
            active_store_products_count_optimized=Count(
                'store_products', filter=Q(store_products__is_active=True), distinct=True
            ),
        ).order_by('name_en').distinct()


class UserProductListView(viewsets.ReadOnlyModelViewSet):
    """
    User view for browsing products.
    Shows products with real-time pricing and currency conversion.
    """
    permission_classes = [IsRegularUser]
    serializer_class = UserProductSerializer
    
    def get_queryset(self):
        """
        Get products with efficient filtering.
        Only returns active products.
        """
        section_id = self.request.query_params.get('section_id')
        search = self.request.query_params.get('search')
        product_type = self.request.query_params.get('product_type')
        
        # Base queryset with optimization
        queryset = Product.objects.filter(
            is_active=True
        ).select_related(
            'section',
            'section__father_section',
            'api_config',
            'external_product'
        ).prefetch_related('requirements')
        if self.request.user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'favorited_by',
                    queryset=Favorite.objects.filter(user=self.request.user),
                    to_attr='current_user_favorites',
                )
            )
        queryset = queryset.order_by('name_en')
        
        # Apply filters
        if section_id:
            # Get products from this section and all its subsections
            queryset = queryset.filter(
                Q(section_id=section_id) | 
                Q(section__father_section_id=section_id)
            )
            
        if search:
            queryset = queryset.filter(
                Q(name_en__icontains=search) | 
                Q(name_ar__icontains=search) |
                Q(description_en__icontains=search) |
                Q(description_ar__icontains=search)
            )
            
        if product_type and product_type in ['amount_based', 'customization_based']:
            queryset = queryset.filter(product_type=product_type)
            
        return queryset

    @action(detail=True, methods=['get'])
    def requirements(self, request, pk=None):
        """Get product requirements for users."""
        try:
            product = Product.objects.get(
                id=pk, 
                is_active=True
            )
            requirements_qs = product.requirements.all().order_by('order')
            if requirements_qs.exists():
                serializer = ProductRequirementSerializer(requirements_qs, many=True)
                return Response(serializer.data)

            external_product = product.external_product
            external_requirements = (
                external_product.required_fields_json
                if external_product and external_product.required_fields_json
                else []
            )

            normalized = []
            for index, field in enumerate(external_requirements):
                if isinstance(field, dict):
                    field_name = (
                        field.get('field_name')
                        or field.get('name')
                        or field.get('field')
                        or field.get('key')
                    )
                    field_type = field.get('field_type') or field.get('type') or 'text'
                    is_required = field.get('required', field.get('is_required', True))
                    placeholder = field.get('placeholder') or field_name
                    options = field.get('options') or field.get('values')
                else:
                    field_name = str(field) if field is not None else None
                    field_type = 'text'
                    is_required = True
                    placeholder = field_name
                    options = None

                if not field_name:
                    continue

                if options is None:
                    options_list = []
                elif isinstance(options, list):
                    options_list = options
                else:
                    options_list = [str(options)]

                normalized.append({
                    "id": None,
                    "field_name": field_name,
                    "field_type": field_type,
                    "is_required": bool(is_required),
                    "placeholder": placeholder,
                    "order": index,
                    "options": options_list
                })

            return Response(normalized)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def price_calculator(self, request, pk=None):
        """Calculate price for different amounts/options (user endpoint)."""
        try:
            product = Product.objects.get(id=pk, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        amount = request.query_params.get('amount')
        selected_option = request.query_params.get('selected_option')
        wallet_currency = request.query_params.get('wallet_currency')

        if wallet_currency:
            wallet_currency = wallet_currency.upper()
            if wallet_currency not in ["USD", "SYP"]:
                return Response(
                    {"error": "Invalid wallet_currency. Use USD or SYP"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            if product.product_type == "amount_based" and amount:
                calculated_price = product.calculate_price(amount=float(amount))
                user_final_price = PriceService.calculate_pricing(
                    amount=calculated_price, source_currency=product.currency, user=request.user,
                    product=product,
                ).native_final_amount
                response_data = {
                    "amount": float(amount),
                    "price_per_unit": float(product.base_price),
                    "calculated_price": float(calculated_price),
                    "user_final_price": float(user_final_price),
                    "currency": product.currency,
                }
            elif product.product_type == "customization_based" and selected_option:
                calculated_price = product.calculate_price(selected_option=selected_option)
                user_final_price = PriceService.calculate_pricing(
                    amount=calculated_price, source_currency=product.currency, user=request.user,
                    product=product,
                ).native_final_amount
                response_data = {
                    "selected_option": selected_option,
                    "selected_units": float(selected_option),
                    "price_per_unit": float(product.base_price),
                    "calculated_price": float(calculated_price),
                    "user_final_price": float(user_final_price),
                    "currency": product.currency,
                }
            else:
                return Response({
                    "error": "Invalid parameters for product type",
                    "product_type": product.product_type,
                    "required_params": {
                        "amount_based": ["amount"],
                        "customization_based": ["selected_option"],
                    },
                }, status=status.HTTP_400_BAD_REQUEST)

            if wallet_currency:
                quote = ExchangeRateQuoteService.get_active_quote()
                unit_meta = _product_display_conversion(product, product.base_price, wallet_currency, quote)
                calculated_meta = _product_display_conversion(product, calculated_price, wallet_currency, quote)
                final_meta = _product_display_conversion(product, user_final_price, wallet_currency, quote)
                response_data.update({
                    "wallet_currency": wallet_currency,
                    "wallet_price_per_unit": unit_meta["converted_amount"],
                    "wallet_calculated_price": calculated_meta["converted_amount"],
                    "wallet_user_final_price": final_meta["converted_amount"],
                    "price_conversions": {
                        "price_per_unit": unit_meta,
                        "calculated_price": calculated_meta,
                        "user_final_price": final_meta,
                    },
                })

            return Response(response_data)

        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def query(self, request, pk=None):
        """Run inquiry/query for products that support it."""
        try:
            product = Product.objects.get(id=pk, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        if not product.external_product or not product.external_product.api_config:
            return Response(
                {"error": "Product is not linked to an external API"},
                status=status.HTTP_400_BAD_REQUEST
            )

        external_data = product.external_product.external_data or {}
        inquiry_enabled = external_data.get('inquiry_enabled')
        if inquiry_enabled is None and isinstance(external_data.get('original_data'), dict):
            inquiry_enabled = external_data['original_data'].get('inquiry_enabled')

        normalized_inquiry_enabled = str(inquiry_enabled).lower() in {"1", "true", "yes"}
        if not normalized_inquiry_enabled:
            return Response(
                {
                    "error": "Query is not supported for this product.",
                    "details": {
                        "product_id": product.id,
                        "external_product_id": product.external_product.external_id,
                        "inquiry_enabled": bool(normalized_inquiry_enabled),
                        "hint": "This product requires a direct order. Use the purchase endpoint or resync products if this seems incorrect."
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user_inputs = request.data.get("user_inputs")
        if not isinstance(user_inputs, dict):
            return Response(
                {"error": "user_inputs must be a JSON object"},
                status=status.HTTP_400_BAD_REQUEST
            )

        required_fields = product.external_product.required_fields_json or []
        missing_fields = []
        for field in required_fields:
            if isinstance(field, dict):
                field_name = (
                    field.get('field_name')
                    or field.get('name')
                    or field.get('field')
                    or field.get('key')
                )
                is_required = field.get('required', field.get('is_required', True))
            else:
                field_name = str(field) if field is not None else None
                is_required = True

            if not field_name or not is_required:
                continue
            if field_name not in user_inputs:
                missing_fields.append(field_name)

        if missing_fields:
            return Response(
                {"error": f"Missing required fields: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        connector = ConnectorFactory.get_connector(product.external_product.api_config)
        if not hasattr(connector, "create_inquiry"):
            return Response(
                {"error": "Query is not supported for this provider"},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = connector.create_inquiry(
            product_data={"external_id": product.external_product.external_id},
            user_inputs=user_inputs
        )

        # Return provider response as-is
        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='query-wait')
    def query_wait(self, request, pk=None):
        """Run inquiry/query and long-poll until final or timeout."""
        try:
            product = Product.objects.get(id=pk, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        if not product.external_product or not product.external_product.api_config:
            return Response(
                {"error": "Product is not linked to an external API"},
                status=status.HTTP_400_BAD_REQUEST
            )

        external_data = product.external_product.external_data or {}
        inquiry_enabled = external_data.get('inquiry_enabled')
        if inquiry_enabled is None and isinstance(external_data.get('original_data'), dict):
            inquiry_enabled = external_data['original_data'].get('inquiry_enabled')

        normalized_inquiry_enabled = str(inquiry_enabled).lower() in {"1", "true", "yes"}
        if not normalized_inquiry_enabled:
            return Response(
                {
                    "error": "Query is not supported for this product.",
                    "details": {
                        "product_id": product.id,
                        "external_product_id": product.external_product.external_id,
                        "inquiry_enabled": bool(normalized_inquiry_enabled),
                        "hint": "This product requires a direct order. Use the purchase endpoint or resync products if this seems incorrect."
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        user_inputs = request.data.get("user_inputs")
        if not isinstance(user_inputs, dict):
            return Response(
                {"error": "user_inputs must be a JSON object"},
                status=status.HTTP_400_BAD_REQUEST
            )

        required_fields = product.external_product.required_fields_json or []
        missing_fields = []
        for field in required_fields:
            if isinstance(field, dict):
                field_name = (
                    field.get('field_name')
                    or field.get('name')
                    or field.get('field')
                    or field.get('key')
                )
                is_required = field.get('required', field.get('is_required', True))
            else:
                field_name = str(field) if field is not None else None
                is_required = True

            if not field_name or not is_required:
                continue
            if field_name not in user_inputs:
                missing_fields.append(field_name)

        if missing_fields:
            return Response(
                {"error": f"Missing required fields: {', '.join(missing_fields)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        connector = ConnectorFactory.get_connector(product.external_product.api_config)
        if not hasattr(connector, "create_inquiry"):
            return Response(
                {"error": "Query is not supported for this provider"},
                status=status.HTTP_400_BAD_REQUEST
            )

        create_result = connector.create_inquiry(
            product_data={"external_id": product.external_product.external_id},
            user_inputs=user_inputs
        )

        def _unwrap_data(payload):
            data = payload
            for _ in range(3):
                if not isinstance(data, dict):
                    return None
                if isinstance(data.get("data"), dict):
                    data = data["data"]
                else:
                    break
            return data

        def extract_local_id(payload):
            if not isinstance(payload, dict):
                return None
            data = _unwrap_data(payload)
            if isinstance(data, dict) and isinstance(data.get("query"), dict):
                return data["query"].get("local_id")
            if isinstance(payload.get("query"), dict):
                return payload["query"].get("local_id")
            return payload.get("local_id")

        def extract_status(payload):
            if not isinstance(payload, dict):
                return None
            data = _unwrap_data(payload)
            if isinstance(data, dict) and isinstance(data.get("query"), dict):
                return data["query"].get("status")
            if isinstance(payload.get("query"), dict):
                return payload["query"].get("status")
            return payload.get("status")

        def is_pending_status(value):
            if value is None:
                return False
            status_str = str(value).strip().lower()
            pending_keywords = {
                "pending",
                "processing",
                "in_progress",
                "in-progress",
                "queued",
                "running",
            }
            if status_str in pending_keywords:
                return True
            # Arabic pending-like phrases
            if "قيد" in status_str:
                return True
            if "انتظار" in status_str:
                return True
            if "معالجة" in status_str:
                return True
            return False

        local_id = extract_local_id(create_result)
        if not local_id:
            return Response(create_result)

        if not hasattr(connector, "get_query_by_local"):
            return Response(create_result)

        timeout_seconds = 90
        poll_delay = 2
        deadline = time.time() + timeout_seconds
        last_result = create_result

        while time.time() < deadline:
            status_result = connector.get_query_by_local(local_id)
            last_result = status_result
            status_value = extract_status(status_result)
            if status_value and not is_pending_status(status_value):
                if isinstance(status_result, dict):
                    status_result["final"] = True
                return Response(status_result)
            time.sleep(poll_delay)

        if isinstance(last_result, dict):
            last_result["timeout"] = True
            last_result["final"] = False
        return Response(last_result)

    @action(detail=True, methods=['get'], permission_classes=[IsAuthenticated], url_path='query-status')
    def query_status(self, request, pk=None):
        """Fetch inquiry status/result by local_id."""
        local_id = request.query_params.get('local_id')
        if not local_id:
            return Response(
                {"error": "local_id query param is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(id=pk, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        if not product.external_product or not product.external_product.api_config:
            return Response(
                {"error": "Product is not linked to an external API"},
                status=status.HTTP_400_BAD_REQUEST
            )

        external_data = product.external_product.external_data or {}
        inquiry_enabled = external_data.get('inquiry_enabled')
        if inquiry_enabled is None and isinstance(external_data.get('original_data'), dict):
            inquiry_enabled = external_data['original_data'].get('inquiry_enabled')

        normalized_inquiry_enabled = str(inquiry_enabled).lower() in {"1", "true", "yes"}
        if not normalized_inquiry_enabled:
            return Response(
                {
                    "error": "Query is not supported for this product.",
                    "details": {
                        "product_id": product.id,
                        "external_product_id": product.external_product.external_id,
                        "inquiry_enabled": bool(normalized_inquiry_enabled),
                        "hint": "This product does not support inquiries."
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        connector = ConnectorFactory.get_connector(product.external_product.api_config)
        if not hasattr(connector, "get_query_by_local"):
            return Response(
                {"error": "Query status is not supported for this provider"},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = connector.get_query_by_local(local_id)
        return Response(result)

    @action(detail=True, methods=['get'])
    def calculate_price(self, request, pk=None):
        """Calculate price for a specific amount or option."""
        try:
            product = Product.objects.get(id=pk, is_active=True)
            
            if product.product_type == "amount_based":
                amount = request.query_params.get('amount')
                if not amount:
                    return Response(
                        {"error": "Amount is required for amount-based products"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    amount_float = float(amount)
                    calculated_price = product.calculate_price(amount=amount_float)
                    
                    # Get user-specific final price
                    user = request.user
                    final_price = PriceService.calculate_pricing(
                        amount=calculated_price, source_currency=product.currency, user=user,
                        product=product,
                    ).native_final_amount
                    
                    return Response({
                        "product_id": product.id,
                        "product_type": product.product_type,
                        "amount": amount_float,
                        "price_per_unit": float(product.base_price),
                        "calculated_price": float(calculated_price),
                        "user_final_price": float(final_price),
                        "currency": product.currency,
                        "min_amount": float(product.min_amount) if product.min_amount else None,
                        "max_amount": float(product.max_amount) if product.max_amount else None
                    })
                except ValueError as e:
                    return Response(
                        {"error": str(e)},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
            elif product.product_type == "customization_based":
                selected_option = request.query_params.get('selected_option')
                if not selected_option:
                    return Response(
                        {"error": "Selected option is required for customization-based products"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    calculated_price = product.calculate_price(selected_option=selected_option)
                    
                    # Get user-specific final price
                    user = request.user
                    final_price = PriceService.calculate_pricing(
                        amount=calculated_price, source_currency=product.currency, user=user,
                        product=product,
                    ).native_final_amount
                    
                    return Response({
                        "product_id": product.id,
                        "product_type": product.product_type,
                        "selected_option": selected_option,
                        "selected_units": float(selected_option),
                        "price_per_unit": float(product.base_price),
                        "calculated_price": float(calculated_price),
                        "user_final_price": float(final_price),
                        "currency": product.currency,
                        "available_options": product.get_customization_data()
                    })
                except ValueError as e:
                    return Response(
                        {"error": str(e)},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured products (random 10 active products)."""
        featured_products = self.get_queryset().order_by('?')[:10]
        serializer = self.get_serializer(featured_products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Enhanced search with filters."""
        query = request.query_params.get('q', '')
        section_id = request.query_params.get('section_id')
        product_type = request.query_params.get('product_type')
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        
        queryset = self.get_queryset()
        
        # Apply search query
        if query:
            queryset = queryset.filter(
                Q(name_en__icontains=query) | 
                Q(name_ar__icontains=query) |
                Q(description_en__icontains=query) |
                Q(description_ar__icontains=query)
            )
            
        # Apply section filter
        if section_id:
            queryset = queryset.filter(
                Q(section_id=section_id) | 
                Q(section__father_section_id=section_id)
            )
            
        # Apply product type filter
        if product_type and product_type in ['amount_based', 'customization_based']:
            queryset = queryset.filter(product_type=product_type)
            
        # Apply price filters
        if min_price:
            try:
                min_price_float = float(min_price)
                queryset = queryset.filter(base_price__gte=min_price_float)
            except ValueError:
                pass
                
        if max_price:
            try:
                max_price_float = float(max_price)
                queryset = queryset.filter(base_price__lte=max_price_float)
            except ValueError:
                pass
        
        # Get total count before pagination
        total_count = queryset.count()
        
        # Apply pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': total_count,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'])
    def by_section(self, request):
        """Get all products by section (including subsections)."""
        section_id = request.query_params.get('section_id')
        
        if not section_id:
            return Response(
                {"error": "section_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Verify section exists and is active
            section = Section.objects.get(id=section_id, is_active=True)
            
            # Get products from this section and all subsections
            queryset = self.get_queryset().filter(
                Q(section_id=section_id) | 
                Q(section__father_section_id=section_id)
            )
            
            serializer = self.get_serializer(queryset, many=True)
            
            return Response({
                'section': {
                    'id': section.id,
                    'name_en': section.name_en,
                    'name_ar': section.name_ar
                },
                'count': queryset.count(),
                'products': serializer.data
            })
            
        except Section.DoesNotExist:
            return Response(
                {"error": "Section not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )


# ==================== FAVORITES ====================

class FavoriteViewSet(viewsets.ViewSet):
    """
    Viewset for managing user favorites.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Get all favorites for the current user."""
        favorites = Favorite.objects.filter(
            user=request.user
        ).select_related(
            "product",
            "product__section"
        ).order_by('-created_at')
        
        serializer = FavoriteSerializer(favorites, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def add(self, request):
        """Add a product to favorites."""
        product_id = request.data.get("product_id")
        
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )

        favorite, created = Favorite.objects.get_or_create(
            user=request.user, 
            product=product
        )
        
        if not created:
            return Response(
                {"message": "Product already in favorites"},
                status=status.HTTP_200_OK
            )

        return Response(
            {
                "message": "Added to favorites",
                "favorite_id": favorite.id,
                "product_id": product.id,
                "product_name": product.name_en
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"])
    def remove(self, request):
        """Remove a product from favorites."""
        product_id = request.data.get("product_id")
        
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            favorite = Favorite.objects.get(
                user=request.user, 
                product_id=product_id
            )
            favorite.delete()
            
            return Response(
                {"message": "Removed from favorites"},
                status=status.HTTP_200_OK
            )
            
        except Favorite.DoesNotExist:
            return Response(
                {"error": "Product not in favorites"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        """Toggle favorite status for a product."""
        product_id = request.data.get("product_id")
        
        if not product_id:
            return Response(
                {"error": "product_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response(
                {"error": "Product not found or inactive"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if already favorited
        favorite = Favorite.objects.filter(
            user=request.user, 
            product=product
        ).first()
        
        if favorite:
            # Remove from favorites
            favorite.delete()
            action = "removed"
            is_favorite = False
        else:
            # Add to favorites
            Favorite.objects.create(user=request.user, product=product)
            action = "added"
            is_favorite = True
        
        return Response({
            "message": f"Product {action} from favorites",
            "product_id": product.id,
            "is_favorite": is_favorite
        })


# ==================== PURCHASES ====================

class PurchaseViewSet(viewsets.ViewSet):
    """
    Viewset for handling product purchases.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List the current user's purchase transactions."""
        try:
            page = int(request.query_params.get("page", 1))
        except Exception:
            page = 1
        try:
            page_size = int(request.query_params.get("page_size", request.query_params.get("limit", 20)))
        except Exception:
            page_size = 20
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 20
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        status_param = request.query_params.get("status")

        queryset = (
            Transaction.objects.filter(user=request.user, transaction_type="purchase")
            .select_related("payment", "payment__store_product", "wallet", "recipient")
            .order_by("-created_at")
        )

        if status_param and status_param.lower() != "all":
            queryset = queryset.filter(status__iexact=status_param)

        total_count = queryset.count()
        page_items = queryset[offset:offset + page_size]
        results = []
        try:
            serializer = UserPurchaseListSerializer(page_items, many=True)
            results = serializer.data or []
        except Exception as e:
            logger.error("Purchase list serialization failed: %s", e, exc_info=True)

        if not results and page_items:
            for item in page_items:
                try:
                    results.append(UserPurchaseListSerializer(item).data)
                except Exception as e2:
                    logger.error("Purchase list item failed (tx=%s): %s", getattr(item, "id", "?"), e2, exc_info=True)
                    # Fallback minimal payload to avoid empty list
                    try:
                        results.append({
                            "id": getattr(item, "id", None),
                            "transaction_type": getattr(item, "transaction_type", None),
                            "status": getattr(item, "status", None),
                            "created_at": getattr(item, "created_at", None),
                            "processed_at": getattr(item, "processed_at", None),
                            "amount": float(abs(Decimal(str(getattr(item, "amount", 0))))),
                            "paid_amount": float(abs(Decimal(str(getattr(item, "amount", 0))))),
                            "currency": getattr(item, "currency", None),
                            "note": getattr(item, "note", None),
                            "wallet_id": getattr(item, "wallet_id", None),
                            "store_product_id": getattr(getattr(item, "payment", None), "store_product_id", None),
                            "store_product_name": getattr(getattr(getattr(item, "payment", None), "store_product", None), "name", None),
                            "user_inputs": getattr(getattr(item, "payment", None), "user_inputs", {}) or {},
                            "final_price": getattr(getattr(item, "payment", None), "final_price", None),
                            "wallet_currency": getattr(item, "currency", None),
                            "paid_currency": getattr(item, "currency", None),
                            "external_transaction_id": getattr(getattr(item, "payment", None), "external_transaction_id", None) or getattr(item, "external_reference", None),
                            "payment_status": getattr(getattr(item, "payment", None), "status", None),
                            "selected_option": getattr(getattr(item, "payment", None), "user_inputs", {}).get("selected_option") if getattr(getattr(item, "payment", None), "user_inputs", None) else None,
                            "gamer_id": getattr(getattr(item, "payment", None), "user_inputs", {}).get("gamer_id") if getattr(getattr(item, "payment", None), "user_inputs", None) else None,
                        })
                    except Exception:
                        pass

        return Response(
            {
                "count": total_count,
                "results": results,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total_count,
                    "has_next": (offset + page_size) < total_count,
                },
            },
            status=status.HTTP_200_OK,
        )
    
    @action(detail=False, methods=['post'])
    def purchase(self, request):
        """Process a product purchase."""
        serializer = PurchaseSerializer(data=request.data)
        
        if not serializer.is_valid():
            payload = {
                "success": False,
                "error": "Validation failed",
                "error_code": "VALIDATION_ERROR",
                "errors": serializer.errors,
            }
            if isinstance(serializer.errors, dict):
                payload.update(serializer.errors)
            return Response(
                payload,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        store_product_id = serializer.validated_data['store_product_id']
        user_inputs = serializer.validated_data['user_inputs']
        wallet_currency = serializer.validated_data.get('wallet_currency')
        product_id = serializer.validated_data.get('product_id')
        amount = serializer.validated_data.get('amount')
        selected_option = serializer.validated_data.get('selected_option')
        idempotency_key = (
            request.headers.get('Idempotency-Key')
            or serializer.validated_data.get('idempotency_key')
            or (request.data or {}).get('idempotency_key')
        )

        # Ensure selected_option is also persisted inside user_inputs for later display/filter
        if selected_option is not None:
            if not isinstance(user_inputs, dict):
                user_inputs = {}
            user_inputs['selected_option'] = str(selected_option)

        logger.warning(
            "[Purchase] request user_inputs keys=%s",
            list((request.data or {}).get('user_inputs', {}).keys())
            if isinstance((request.data or {}).get('user_inputs'), dict)
            else type((request.data or {}).get('user_inputs')),
        )
        logger.warning(
            "[Purchase] validated user_inputs keys=%s",
            list(user_inputs.keys()) if isinstance(user_inputs, dict) else type(user_inputs),
        )
        
        try:
            result = PurchaseService.process_purchase(
                store_product_id=store_product_id,
                user=request.user,
                user_inputs=user_inputs,
                wallet_currency=wallet_currency,
                product_id=product_id,
                amount=amount,
                selected_option=selected_option,
                idempotency_key=idempotency_key,
            )
            
            if result['success']:
                return Response(result, status=status.HTTP_200_OK)
            else:
                error_code = result.get("error_code") or "PURCHASE_FAILED"
                error = result.get("error") or "Purchase failed"
                detail = result.get("detail") or result.get("message")
                response_data = {
                    "success": False,
                    "error": error,
                    "error_code": error_code,
                }
                if detail:
                    response_data["detail"] = detail
                if result.get("errors"):
                    response_data["errors"] = result.get("errors")
                if result.get("transaction_id"):
                    response_data["transaction_id"] = result.get("transaction_id")
                return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Purchase processing error: {str(e)}")
            return Response(
                {
                    "success": False,
                    "error": "An error occurred during purchase processing",
                    "error_code": "PURCHASE_EXCEPTION",
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================== CURRENCY CONVERSION ====================

class PriceConversionView(APIView):
    """
    API for converting prices between currencies.
    """
    permission_classes = [IsAuthenticated]
    @extend_schema(
        responses={
            200: OpenApiResponse(description="Decimal-string product display conversion metadata; cross-currency may be unavailable."),
            400: OpenApiResponse(description="Invalid conversion parameters."),
        },
        description="Display-only product price conversion. It is not checkout authority and never accepts a client rate.",
    )
    def get(self, request):
        """Convert amount from one currency to another."""
        amount = request.query_params.get('amount')
        from_currency = request.query_params.get('from_currency')
        to_currency = request.query_params.get('to_currency')
        
        # Validate required parameters
        if not all([amount, from_currency, to_currency]):
            return Response(
                {
                    "error": "Missing required parameters",
                    "required": ["amount", "from_currency", "to_currency"]
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate currencies
        if from_currency not in ['USD', 'SYP'] or to_currency not in ['USD', 'SYP']:
            return Response(
                {
                    "error": "Invalid currency. Use USD or SYP",
                    "supported_currencies": ["USD", "SYP"]
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            amount_decimal = Decimal(str(amount))
            quote = ExchangeRateQuoteService.get_active_quote()
            conversion = PriceService.convert_product_price(
                amount=amount_decimal,
                source_currency=from_currency,
                target_currency=to_currency,
                quote=quote if quote is not None else False,
            )
            native_final = PriceService.calculate_pricing(
                amount=amount_decimal, source_currency=from_currency, user=request.user,
            ).native_final_amount
            final_conversion = PriceService.convert_product_price(
                amount=native_final,
                source_currency=from_currency,
                target_currency=to_currency,
                quote=quote if quote is not None else False,
            )
            return Response({
                "original_amount": str(amount_decimal),
                "original_currency": from_currency,
                "converted_amount": conversion["converted_amount"],
                "converted_currency": to_currency,
                "user_final_amount": final_conversion["converted_amount"],
                "exchange_rate": conversion["rate_used"],
                "exchange_rates": CurrencyService.get_display_rates(quote=quote),
                "price_conversion": conversion,
                "user_final_price_conversion": final_conversion,
                "rate_available": conversion["rate_available"],
                "quote_id": conversion["quote_id"],
                "quote_version": conversion["quote_version"],
                "display_only": True,
            })
            
        except (ValueError, InvalidOperation):
            return Response(
                {"error": "Invalid amount format. Must be a number"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Price conversion error: {str(e)}")
            return Response(
                {"error": "Conversion failed. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==================== EXTERNAL PRODUCTS ====================

class ExternalProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin viewset for browsing external products from APIs.
    """
    permission_classes = [IsAdminUser]
    serializer_class = ExternalProductSerializer
    
    def get_queryset(self):
        """Get external products with filtering."""
        api_id = self.request.query_params.get('api_id')
        is_active = self.request.query_params.get('is_active')
        category = self.request.query_params.get('category')
        
        queryset = ExternalProduct.objects.select_related('api_config')
        
        if api_id:
            queryset = queryset.filter(api_config_id=api_id)
        
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        if category:
            queryset = queryset.filter(category__icontains=category)
        
        return queryset.order_by('category', 'name')


# ==================== STORE PRODUCTS ====================

class StoreProductViewSet(viewsets.ModelViewSet):
    """
    Admin viewset for managing store products.
    """
    permission_classes = [IsAdminUser]
    queryset = StoreProduct.objects.all()
    
    def get_serializer_class(self):
        """Use different serializer for create/update operations."""
        if self.action in ['create', 'update', 'partial_update']:
            return StoreProductCreateSerializer
        return StoreProductSerializer
    
    def get_queryset(self):
        """Optimize queries with related data."""
        return StoreProduct.objects.select_related(
            'section',
            'section__father_section',
            'external_product',
            'external_product__api_config'
        ).order_by('name')
    
    @action(detail=False, methods=['get'])
    def by_section(self, request):
        """Get store products by section."""
        section_id = request.query_params.get('section_id')
        
        if not section_id:
            return Response(
                {"error": "section_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        products = StoreProduct.objects.filter(
            section_id=section_id,
            is_active=True
        ).select_related(
            'section',
            'section__father_section',
            'external_product',
            'external_product__api_config'
        ).order_by('name')
        
        serializer = self.get_serializer(products, many=True)
        
        return Response({
            'section_id': section_id,
            'count': products.count(),
            'products': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle store product active status."""
        store_product = self.get_object()
        store_product.is_active = not store_product.is_active
        store_product.administrator_disabled = not store_product.is_active
        store_product.save()
        
        return Response({
            "id": store_product.id,
            "name": store_product.name,
            "is_active": store_product.is_active,
            "message": f"Store product {'activated' if store_product.is_active else 'deactivated'}"
        })
