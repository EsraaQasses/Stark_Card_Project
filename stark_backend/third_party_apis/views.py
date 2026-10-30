# third_party_apis/views.py - OPTIMIZED VERSION
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
import logging

from .models import ThirdPartyAPI, APITransaction
from .serializers import (
    ThirdPartyAPISerializer, 
    ThirdPartyAPICreateSerializer,
    APITransactionSerializer
)
from .services.api_service import APIService
from users.permissions import IsAdminUser

logger = logging.getLogger(__name__)


class ThirdPartyAPIViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        return ThirdPartyAPI.objects.all().prefetch_related('transactions')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ThirdPartyAPICreateSerializer
        return ThirdPartyAPISerializer
    
    def destroy(self, request, *args, **kwargs):
        api = self.get_object()

        from store.models import Product, ExternalProduct
        from .models import ProductSyncRun

        linked = {
            "products": Product.objects.filter(api_config=api).exists(),
            "external_products": ExternalProduct.objects.filter(api_config=api).exists(),
            "transactions": api.transactions.exists(),
            "sync_runs": ProductSyncRun.objects.filter(api_config=api).exists(),
        }

        if any(linked.values()):
            return Response(
                {
                    "error": "Cannot delete API with linked data.",
                    "linked": linked,
                    "suggestion": "Disable this API instead.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='deletion-preview')
    def deletion_preview(self, request, pk=None):
        """Read-only snapshot of provider products and historic links."""
        from store.models import Product, ExternalProduct, StoreProduct
        from .models import ProductSyncRun
        api = self.get_object()
        products = list(Product.objects.filter(api_config=api).values('id', 'name_ar', 'name_en', 'is_active'))
        external = list(ExternalProduct.objects.filter(api_config=api).values('id', 'name', 'is_active'))
        store = list(StoreProduct.objects.filter(external_product__api_config=api).values('id', 'name', 'is_active'))
        return Response({
            'api_id': api.id,
            'products': [{'kind': 'product', 'id': p['id'], 'name': p['name_ar'] or p['name_en'], 'active': p['is_active']} for p in products],
            'external_products': [{'kind': 'external', 'id': p['id'], 'name': p['name'], 'active': p['is_active']} for p in external],
            'store_products': [{'kind': 'store', 'id': p['id'], 'name': p['name'], 'active': p['is_active']} for p in store],
            'historical': {
                'api_transactions': api.transactions.count(),
                'sync_runs': ProductSyncRun.objects.filter(api_config=api).count(),
            },
        })

    @action(detail=True, methods=['post'], url_path='retire')
    def retire(self, request, pk=None):
        """Atomically disable API + hide products, preserving orders and audit history.

        Selected items are flagged removed; other products are only hidden.
        No physical product rows are deleted, even when not referenced by orders.
        """
        from django.db import transaction
        from rest_framework.exceptions import ValidationError
        from store.models import Product, ExternalProduct, StoreProduct
        from .models import ProductSyncRun

        raw = request.data.get('selected', [])
        if not isinstance(raw, list) or len(raw) > 10000:
            raise ValidationError({'selected': 'Expected a list of at most 10000 products.'})
        selected = {'product': set(), 'external': set(), 'store': set()}
        for item in raw:
            if not isinstance(item, dict) or item.get('kind') not in selected:
                raise ValidationError({'selected': 'Invalid product entry.'})
            value = item.get('id')
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                raise ValidationError({'selected': 'Invalid product ID.'})
            selected[item['kind']].add(value)

        with transaction.atomic():
            api = ThirdPartyAPI.objects.select_for_update().get(pk=self.get_object().pk)
            product_qs = Product.objects.filter(api_config=api)
            external_qs = ExternalProduct.objects.filter(api_config=api)
            store_qs = StoreProduct.objects.filter(external_product__api_config=api)
            valid = {
                'product': set(product_qs.values_list('id', flat=True)),
                'external': set(external_qs.values_list('id', flat=True)),
                'store': set(store_qs.values_list('id', flat=True)),
            }
            for kind, ids in selected.items():
                if not ids.issubset(valid[kind]):
                    raise ValidationError({'selected': 'Products changed; reload the deletion preview.'})

            # Hide every related product before switching off the provider.
            store_qs.update(is_active=False)
            product_qs.update(is_active=False)
            external_qs.update(is_active=False)
            for kind, ids in selected.items():
                if not ids:
                    continue
                {'product': product_qs, 'external': external_qs, 'store': store_qs}[kind].filter(id__in=ids).update(
                    provider_status='removed', administrator_disabled=True,
                ) if kind != 'external' else external_qs.filter(id__in=ids).update(provider_status='removed', administrator_disabled=True)
            api.is_active = False
            api.save(update_fields=['is_active'])

        return Response({'success': True, 'action': 'retired', 'api_id': api.pk,
                         'selected_count': sum(len(ids) for ids in selected.values()),
                         'message': 'API disabled and products hidden. Historical records retained.'})

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test connection to external API"""
        result = APIService.test_api_connection(pk)
        return Response(result)
    
    @action(detail=True, methods=['post'])
    def sync_products(self, request, pk=None):
        """Sync products from external API"""
        result = APIService.sync_products_from_api(pk)
        if not result.get('success'):
            api = self.get_object()
            return Response(
                {
                    'success': False,
                    'error': result.get('error', 'Sync failed'),
                    'details': result.get('details'),
                    'api_id': api.id,
                    'api_name': api.name,
                    'provider': api.provider,
                    'base_url': api.base_url,
                },
                status=status.HTTP_502_BAD_GATEWAY
            )
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def active_apis(self, request):
        """Get active APIs with stats"""
        provider = request.query_params.get('provider')
        apis = APIService.get_active_apis(provider)
        
        # Add statistics to each API
        api_data = []
        for api in apis:
            serializer = self.get_serializer(api)
            api_dict = serializer.data
            
            # Add statistics
            today = timezone.now().date()
            week_ago = today - timedelta(days=7)
            
            stats = {
                'transactions_today': APITransaction.objects.filter(
                    api_config=api,
                    request_timestamp__date=today
                ).count(),
                'transactions_week': APITransaction.objects.filter(
                    api_config=api,
                    request_timestamp__gte=week_ago
                ).count(),
                'success_rate': self._calculate_success_rate(api),
                'last_transaction': APITransaction.objects.filter(
                    api_config=api
                ).order_by('-request_timestamp').first().request_timestamp if APITransaction.objects.filter(api_config=api).exists() else None
            }
            
            api_dict['stats'] = stats
            api_data.append(api_dict)
        
        return Response(api_data)
    
    def _calculate_success_rate(self, api):
        """Calculate API success rate"""
        transactions = APITransaction.objects.filter(api_config=api)
        if not transactions.exists():
            return 0
        
        successful = transactions.filter(success=True).count()
        return round((successful / transactions.count()) * 100, 2)
    
    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        """Get transactions for a specific API with pagination"""
        api = self.get_object()
        page = int(request.query_params.get('page', 1))
        limit = min(int(request.query_params.get('limit', 50)), 100)
        offset = (page - 1) * limit
        
        transactions = api.transactions.all().order_by('-request_timestamp')
        total = transactions.count()
        
        transactions_page = transactions[offset:offset + limit]
        serializer = APITransactionSerializer(transactions_page, many=True)
        
        return Response({
            'transactions': serializer.data,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'has_more': offset + limit < total
            }
        })
    
    @action(detail=True, methods=['get'])
    def health(self, request, pk=None):
        """Get API health status"""
        api = self.get_object()
        
        # Check recent transactions
        hour_ago = timezone.now() - timedelta(hours=1)
        recent_txs = APITransaction.objects.filter(
            api_config=api,
            request_timestamp__gte=hour_ago
        )
        
        if recent_txs.exists():
            recent_success = recent_txs.filter(success=True).count()
            success_rate = (recent_success / recent_txs.count()) * 100 if recent_txs.count() > 0 else 0
        else:
            success_rate = 0
        
        # Determine health status
        if success_rate >= 95:
            status = 'healthy'
        elif success_rate >= 80:
            status = 'degraded'
        else:
            status = 'unhealthy'
        
        return Response({
            'api_id': api.id,
            'api_name': api.name,
            'status': status,
            'success_rate': round(success_rate, 2),
            'recent_transactions': recent_txs.count(),
            'last_hour_success': recent_txs.filter(success=True).count(),
            'last_hour_failures': recent_txs.filter(success=False).count()
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get dashboard statistics for all APIs"""
        # Overall stats
        total_apis = ThirdPartyAPI.objects.count()
        active_apis = ThirdPartyAPI.objects.filter(is_active=True).count()
        
        # Transaction stats
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        
        today_txs = APITransaction.objects.filter(request_timestamp__date=today)
        week_txs = APITransaction.objects.filter(request_timestamp__gte=week_ago)
        
        # Success rates
        today_success = today_txs.filter(success=True).count()
        week_success = week_txs.filter(success=True).count()
        
        today_rate = (today_success / today_txs.count() * 100) if today_txs.count() > 0 else 0
        week_rate = (week_success / week_txs.count() * 100) if week_txs.count() > 0 else 0
        
        # Provider breakdown
        providers = []
        for provider_choice in ThirdPartyAPI.PROVIDER_CHOICES:
            provider_code = provider_choice[0]
            provider_apis = ThirdPartyAPI.objects.filter(provider=provider_code, is_active=True)
            provider_txs = APITransaction.objects.filter(api_config__provider=provider_code)
            
            providers.append({
                'provider': provider_choice[1],
                'code': provider_code,
                'active_apis': provider_apis.count(),
                'transactions': provider_txs.count(),
                'success_rate': round((provider_txs.filter(success=True).count() / provider_txs.count() * 100) if provider_txs.count() > 0 else 0, 2)
            })
        
        return Response({
            'total_apis': total_apis,
            'active_apis': active_apis,
            'today': {
                'transactions': today_txs.count(),
                'success_rate': round(today_rate, 2)
            },
            'week': {
                'transactions': week_txs.count(),
                'success_rate': round(week_rate, 2)
            },
            'providers': providers
        })


class APITransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing API transactions"""
    permission_classes = [IsAuthenticated]
    serializer_class = APITransactionSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == "admin":
            return APITransaction.objects.all().select_related(
                'api_config', 
                'internal_transaction',
                'internal_transaction__user'
            ).order_by('-request_timestamp')
        
        # For regular users and agents, show their transactions only
        return APITransaction.objects.filter(
            internal_transaction__user=user
        ).select_related(
            'api_config', 
            'internal_transaction'
        ).order_by('-request_timestamp')
    
    @action(detail=False, methods=['get'])
    def my_transactions(self, request):
        """Get current user's API transactions"""
        transactions = self.get_queryset().filter(
            internal_transaction__user=request.user
        )[:50]  # Limit to 50 most recent
        
        serializer = self.get_serializer(transactions, many=True)
        
        # Add summary
        summary = {
            'total': transactions.count(),
            'successful': transactions.filter(success=True).count(),
            'failed': transactions.filter(success=False).count(),
            'success_rate': round((transactions.filter(success=True).count() / transactions.count() * 100) if transactions.count() > 0 else 0, 2)
        }
        
        return Response({
            'transactions': serializer.data,
            'summary': summary
        })
    
    @action(detail=False, methods=['get'])
    def recent_failures(self, request):
        """Get recent failed API transactions (admin only)"""
        if request.user.role != "admin":
            return Response(
                {"error": "Not authorized"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        failures = APITransaction.objects.filter(
            success=False,
            request_timestamp__gte=timezone.now() - timedelta(days=1)
        ).select_related(
            'api_config', 
            'internal_transaction',
            'internal_transaction__user'
        ).order_by('-request_timestamp')[:20]
        
        serializer = self.get_serializer(failures, many=True)
        return Response(serializer.data)
