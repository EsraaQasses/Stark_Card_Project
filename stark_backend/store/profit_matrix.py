"""Admin configuration of per-category product overrides used by PricingPolicy."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Q
from rest_framework import serializers
from rest_framework.exceptions import APIException
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import CustomerCategory
from users.permissions import IsAdminUser
from users.utils.audit_logger import AuditLogger
from .models import Product, ProductCategoryProfit


class RateConflict(APIException):
    status_code = 409
    default_detail = 'A rate changed since it was loaded. Reload before saving.'
    default_code = 'PROFIT_RATE_CONFLICT'


class MatrixFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=200)
    section_id = serializers.IntegerField(required=False, min_value=1)
    api_id = serializers.IntegerField(required=False, min_value=1)
    currency = serializers.ChoiceField(required=False, choices=['USD', 'SYP'])
    is_active = serializers.BooleanField(required=False)


class RatePercentageField(serializers.DecimalField):
    def validate_empty_values(self, data):
        if data == '':
            self.fail('invalid')
        return super().validate_empty_values(data)


class RateChangeSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    category_id = serializers.IntegerField(min_value=1)
    profit_percentage = RatePercentageField(
        max_digits=5, decimal_places=2, min_value=Decimal('0'),
        max_value=Decimal('999.99'), allow_null=True,
    )
    expected_revision = serializers.IntegerField(min_value=0)


class RateBatchSerializer(serializers.Serializer):
    changes = RateChangeSerializer(many=True, allow_empty=False, max_length=500)

    def validate_changes(self, changes):
        pairs = [(row['product_id'], row['category_id']) for row in changes]
        if len(set(pairs)) != len(pairs):
            raise serializers.ValidationError('Each product/category cell may occur only once.')
        return changes


class MatrixPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


def rate_data(rate):
    return {
        'product_id': rate.product_id,
        'category_id': rate.customer_category_id,
        'profit_percentage': None if rate.profit_percentage is None else str(rate.profit_percentage),
        'revision': rate.revision,
    }


class ProductProfitMatrixView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        filters = MatrixFilterSerializer(data=request.query_params.dict())
        filters.is_valid(raise_exception=True)
        values = filters.validated_data
        categories = list(CustomerCategory.objects.filter(is_active=True).order_by('name', 'id'))
        rates = ProductCategoryProfit.objects.filter(customer_category_id__in=[row.id for row in categories])
        products = Product.objects.select_related('section', 'api_config', 'external_product').prefetch_related(
            Prefetch('category_profit_rates', queryset=rates, to_attr='matrix_rates')
        ).order_by('name_en', 'id')
        for key in ('section_id', 'currency', 'is_active'):
            if key in values:
                products = products.filter(**{key: values[key]})
        if 'api_id' in values:
            products = products.filter(api_config_id=values['api_id'])
        search = values.get('search', '').strip()
        if search:
            condition = Q(name_en__icontains=search) | Q(name_ar__icontains=search)
            if search.isascii() and search.isdigit():
                condition |= Q(pk=int(search))
            products = products.filter(condition)
        pagination = MatrixPagination()
        page = pagination.paginate_queryset(products, request, view=self)
        rows = [{
            'id': product.id, 'name_en': product.name_en, 'name_ar': product.name_ar,
            'section_id': product.section_id,
            'section_name_en': product.section.name_en, 'section_name_ar': product.section.name_ar,
            'api_id': product.api_config_id,
            'provider_name': product.api_config.name if product.api_config_id else None,
            'currency': product.currency, 'is_active': product.is_active,
            'provider_active': product.api_config.is_active if product.api_config_id else None,
            'external_active': product.external_product.is_active if product.external_product_id else None,
            # Product.base_price is a selling basis, not an authenticated provider-cost snapshot.
            'cost': None, 'cost_status': 'unavailable',
            'product_profit_percentage': str(product.product_profit_percentage),
            'rates': [rate_data(rate) for rate in product.matrix_rates],
        } for product in page]
        response = pagination.get_paginated_response(rows)
        response.data['categories'] = [{
            'id': category.id, 'name': category.name, 'display_name': category.display_name,
            'profit_percentage': str(category.profit_percentage), 'is_active': category.is_active,
        } for category in categories]
        response.data['pricing_policy'] = {
            'mode': 'product_override', 'max_percentage': '999.99', 'decimal_places': 2,
            'message': 'Non-null cell replaces the product base profit; category and agent policies remain applicable.',
        }
        return response

    @transaction.atomic
    def patch(self, request):
        serializer = RateBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        changes = serializer.validated_data['changes']
        product_ids = sorted({row['product_id'] for row in changes})
        category_ids = sorted({row['category_id'] for row in changes})
        # Lock existing parents to serialize first insertion too, in a stable order.
        products = list(Product.objects.select_for_update().filter(id__in=product_ids).order_by('id'))
        categories = list(CustomerCategory.objects.select_for_update().filter(id__in=category_ids).order_by('id'))
        if len(products) != len(product_ids):
            raise serializers.ValidationError({'product_id': 'One or more products do not exist.'})
        if len(categories) != len(category_ids) or any(not category.is_active for category in categories):
            raise serializers.ValidationError({'category_id': 'All categories must exist and be active.'})
        existing = {(rate.product_id, rate.customer_category_id): rate for rate in
                    ProductCategoryProfit.objects.select_for_update().filter(
                        product_id__in=product_ids, customer_category_id__in=category_ids)}
        # Check the entire batch before writing anything.
        for row in changes:
            previous = existing.get((row['product_id'], row['category_id']))
            if row['expected_revision'] != (previous.revision if previous else 0):
                raise RateConflict()
        updated = []
        for row in changes:
            rate = existing.get((row['product_id'], row['category_id']))
            old = None if rate is None or rate.profit_percentage is None else str(rate.profit_percentage)
            if rate is None:
                rate = ProductCategoryProfit(product_id=row['product_id'], customer_category_id=row['category_id'])
            rate.profit_percentage = row['profit_percentage']
            rate.revision += 1
            rate.updated_by = request.user
            rate.save()
            AuditLogger.log(
                strict=True, request=request, action='USER_UPDATE', resource_type='product_category_profit',
                resource_id=rate.pk, details={
                    'product_id': rate.product_id, 'category_id': rate.customer_category_id,
                    'previous_percentage': old,
                    'new_percentage': None if rate.profit_percentage is None else str(rate.profit_percentage),
                    'revision': rate.revision, 'pricing_mode': 'product_override',
                },
            )
            updated.append(rate_data(rate))
        return Response({'saved_count': len(updated), 'updated': updated, 'pricing_mode': 'product_override'})
