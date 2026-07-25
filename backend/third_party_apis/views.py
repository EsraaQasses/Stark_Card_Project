# third_party_apis/views.py - COMPLETE VERSION
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import ThirdPartyAPI, APITransaction
from .serializers import (
    ThirdPartyAPISerializer, 
    ThirdPartyAPICreateSerializer,
    APITransactionSerializer
)
from .services.api_service import APIService

class ThirdPartyAPIViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        return ThirdPartyAPI.objects.all().prefetch_related('transactions')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ThirdPartyAPICreateSerializer
        return ThirdPartyAPISerializer
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """Test connection to external API"""
        result = APIService.test_api_connection(pk)
        return Response(result)
    
    @action(detail=True, methods=['post'])
    def sync_products(self, request, pk=None):
        """Sync products from external API"""
        result = APIService.sync_products_from_api(pk)
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def active_apis(self, request):
        """Get active APIs"""
        provider = request.query_params.get('provider')
        apis = APIService.get_active_apis(provider)
        serializer = self.get_serializer(apis, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        """Get transactions for a specific API"""
        api = self.get_object()
        transactions = api.transactions.all()[:50]
        serializer = APITransactionSerializer(transactions, many=True)
        return Response(serializer.data)

class APITransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing API transactions"""
    permission_classes = [IsAuthenticated]
    serializer_class = APITransactionSerializer
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return APITransaction.objects.all().select_related('api_config', 'internal_transaction')
        return APITransaction.objects.filter(
            internal_transaction__user=self.request.user
        ).select_related('api_config', 'internal_transaction')
    
    @action(detail=False, methods=['get'])
    def my_transactions(self, request):
        """Get current user's API transactions"""
        transactions = self.get_queryset().filter(
            internal_transaction__user=request.user
        )[:100]
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)