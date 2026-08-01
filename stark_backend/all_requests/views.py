# requests/views.py
from rest_framework import viewsets, generics, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction as db_transaction
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Request, RequestComment
from .filtering import AllRequestFilterSet, SecureFilterBackend
from .pagination import RequestPagination
from .openapi import REQUEST_FILTER_PARAMETERS
from .pagination_serializers import PaginatedRequestResponseSerializer
from .schema_serializers import FilterValidationErrorSerializer
from .serializers import (
    RequestSerializer, CreatePaymentRequestSerializer, 
    RequestStatusUpdateSerializer, RequestCommentSerializer
)
from users.permissions import IsAdminUser, IsRegularUser
from shipping.views import ShippingViewSet
from shipping.financial_service import ShippingFinanceService

@extend_schema_view(
    list=extend_schema(parameters=REQUEST_FILTER_PARAMETERS, responses={200: RequestSerializer, 400: FilterValidationErrorSerializer}),
)
class RequestViewSet(viewsets.ModelViewSet):
    queryset = Request.objects.none()
    serializer_class = RequestSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SecureFilterBackend]
    filterset_class = AllRequestFilterSet
    pagination_class = RequestPagination
    
    def get_queryset(self):
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return Request.objects.none()
        if user.role == 'admin':
            queryset = Request.objects.all()
        elif user.role == 'agent':
            queryset = Request.objects.filter(user__agent=user)
        else:
            queryset = Request.objects.filter(user=user)
        return queryset.select_related('user', 'payment_method', 'shipping').prefetch_related('comments').order_by('-created_at', '-id')
    
    def get_serializer_class(self):
        if self.action == 'create' and self.request.data.get('request_type') == 'payment':
            return CreatePaymentRequestSerializer
        elif self.action in ['update_status', 'partial_update']:
            return RequestStatusUpdateSerializer
        return RequestSerializer
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_status(self, request, pk=None):
        try:
            request_obj = self.get_object()
            # Normalize incoming status (admin UI sends "approved")
            incoming = request.data.copy()
            if incoming.get("status") == "approved":
                incoming["status"] = "completed"
            serializer = RequestStatusUpdateSerializer(request_obj, data=incoming, partial=True)
            if not serializer.is_valid():
                payload = {
                    "success": False,
                    "error": "Validation failed",
                    "error_code": "VALIDATION_ERROR",
                    "errors": serializer.errors,
                }
                if isinstance(serializer.errors, dict):
                    payload.update(serializer.errors)
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)
            desired_status = serializer.validated_data.get("status")
            admin_notes = serializer.validated_data.get("admin_notes") or ""
            rejection_reason = serializer.validated_data.get("rejection_reason") or ""

            # If this is a payment/cashout request with a shipping record, sync shipping approval here
            if request_obj.request_type in {"payment", "cashout"} and hasattr(request_obj, "shipping"):
                shipping = request_obj.shipping
                ship_view = ShippingViewSet()
                # Mirror shipping approval/reject to keep wallet logic in one place
                with db_transaction.atomic():
                    if desired_status == "completed":
                        is_valid, error_msg = ship_view._validate_shipping_approval(shipping)
                        if not is_valid:
                            return Response({
                                "success": False,
                                "error": error_msg,
                                "error_code": "INVALID_APPROVAL",
                            }, status=status.HTTP_400_BAD_REQUEST)
                        payment_result = ship_view._process_payment(shipping, approver=request.user)
                        if not payment_result.get("success"):
                            return Response({
                                "success": False,
                                "error": payment_result.get("error") or "Payment processing failed",
                                "error_code": payment_result.get("error_code") or "PAYMENT_PROCESSING_FAILED",
                                "detail": payment_result.get("detail"),
                            }, status=status.HTTP_400_BAD_REQUEST)
                        shipping.status = "approved"
                        shipping.approved_by = request.user
                        shipping.admin_notes = admin_notes or shipping.admin_notes
                        shipping.save()
                    elif desired_status == "rejected":
                        # If agent cashout was reserved, release funds
                        try:
                            req_data = request_obj.user_input_data or {}
                            cashout_tx_id = req_data.get("cashout_tx_id")
                            if cashout_tx_id:
                                tx = request_obj.user.transactions.filter(id=cashout_tx_id).first()
                                if tx and tx.status == "pending":
                                    ShippingFinanceService.reject_cashout(
                                        transaction_id=tx.id,
                                        reason=rejection_reason or admin_notes,
                                    )
                        except Exception:
                            pass
                        shipping.status = "rejected"
                        shipping.admin_notes = rejection_reason or admin_notes or shipping.admin_notes
                        shipping.save()
                    elif desired_status == "processing":
                        shipping.status = "processing"
                        shipping.save()

            serializer.save(status=desired_status)

            return Response({
                "success": True,
                "message": f"Request status updated to {desired_status}",
                "request": RequestSerializer(request_obj).data
            })
        except Exception as exc:
            return Response({
                "success": False,
                "error": "Failed to update request status",
                "error_code": "REQUEST_STATUS_UPDATE_FAILED",
                "detail": str(exc),
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], permission_classes=[IsRegularUser | IsAdminUser])
    def add_comment(self, request, pk=None):
        try:
            request_obj = self.get_object()
            serializer = RequestCommentSerializer(data=request.data)
            if not serializer.is_valid():
                payload = {
                    "success": False,
                    "error": "Validation failed",
                    "error_code": "VALIDATION_ERROR",
                    "errors": serializer.errors,
                }
                if isinstance(serializer.errors, dict):
                    payload.update(serializer.errors)
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)
            serializer.save(request=request_obj, user=request.user)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response({
                "success": False,
                "error": "Failed to add comment",
                "error_code": "REQUEST_COMMENT_FAILED",
                "detail": str(exc),
            }, status=status.HTTP_400_BAD_REQUEST)

@extend_schema_view(
    list=extend_schema(parameters=REQUEST_FILTER_PARAMETERS, responses={200: RequestSerializer, 400: FilterValidationErrorSerializer}),
)
class AdminRequestViewSet(viewsets.ModelViewSet):
    queryset = Request.objects.all()
    serializer_class = RequestSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SecureFilterBackend]
    filterset_class = AllRequestFilterSet
    pagination_class = RequestPagination

    def get_queryset(self):
        return Request.objects.select_related('user', 'payment_method', 'shipping').prefetch_related('comments').order_by('-created_at', '-id')
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        stats = {
            'total': Request.objects.count(),
            'pending': Request.objects.filter(status='pending').count(),
            'shipping': Request.objects.filter(status='shipping').count(),
            'in_progress': Request.objects.filter(status='in_progress').count(),
            'objection': Request.objects.filter(status='objection').count(),
            'completed': Request.objects.filter(status='completed').count(),
            'rejected': Request.objects.filter(status='rejected').count(),
        }
        return Response(stats)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        try:
            request_obj = self.get_object()
            # Normalize incoming status (admin UI sends "approved")
            incoming = request.data.copy()
            if incoming.get("status") == "approved":
                incoming["status"] = "completed"
            serializer = RequestStatusUpdateSerializer(request_obj, data=incoming, partial=True)
            if not serializer.is_valid():
                payload = {
                    "success": False,
                    "error": "Validation failed",
                    "error_code": "VALIDATION_ERROR",
                    "errors": serializer.errors,
                }
                if isinstance(serializer.errors, dict):
                    payload.update(serializer.errors)
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)
            desired_status = serializer.validated_data.get("status")
            admin_notes = serializer.validated_data.get("admin_notes") or ""
            rejection_reason = serializer.validated_data.get("rejection_reason") or ""

            # If this is a payment/cashout request with a shipping record, sync shipping approval here
            if request_obj.request_type in {"payment", "cashout"} and hasattr(request_obj, "shipping"):
                shipping = request_obj.shipping
                ship_view = ShippingViewSet()
                # Mirror shipping approval/reject to keep wallet logic in one place
                with db_transaction.atomic():
                    if desired_status == "completed":
                        is_valid, error_msg = ship_view._validate_shipping_approval(shipping)
                        if not is_valid:
                            return Response({
                                "success": False,
                                "error": error_msg,
                                "error_code": "INVALID_APPROVAL",
                            }, status=status.HTTP_400_BAD_REQUEST)
                        payment_result = ship_view._process_payment(shipping, approver=request.user)
                        if not payment_result.get("success"):
                            return Response({
                                "success": False,
                                "error": payment_result.get("error") or "Payment processing failed",
                                "error_code": payment_result.get("error_code") or "PAYMENT_PROCESSING_FAILED",
                                "detail": payment_result.get("detail"),
                            }, status=status.HTTP_400_BAD_REQUEST)
                        shipping.status = "approved"
                        shipping.approved_by = request.user
                        shipping.admin_notes = admin_notes or shipping.admin_notes
                        shipping.save()
                    elif desired_status == "rejected":
                        # If agent cashout was reserved, release funds
                        try:
                            req_data = request_obj.user_input_data or {}
                            cashout_tx_id = req_data.get("cashout_tx_id")
                            if cashout_tx_id:
                                tx = request_obj.user.transactions.filter(id=cashout_tx_id).first()
                                if tx and tx.status == "pending":
                                    ShippingFinanceService.reject_cashout(
                                        transaction_id=tx.id,
                                        reason=rejection_reason or admin_notes,
                                    )
                        except Exception:
                            pass
                        shipping.status = "rejected"
                        shipping.admin_notes = rejection_reason or admin_notes or shipping.admin_notes
                        shipping.save()
                    elif desired_status == "processing":
                        shipping.status = "processing"
                        shipping.save()

            serializer.save(status=desired_status)

            return Response({
                "success": True,
                "message": f"Request status updated to {desired_status}",
                "request": RequestSerializer(request_obj).data
            })
        except Exception as exc:
            return Response({
                "success": False,
                "error": "Failed to update request status",
                "error_code": "REQUEST_STATUS_UPDATE_FAILED",
                "detail": str(exc),
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        try:
            request_obj = self.get_object()
            serializer = RequestCommentSerializer(data=request.data)
            if not serializer.is_valid():
                payload = {
                    "success": False,
                    "error": "Validation failed",
                    "error_code": "VALIDATION_ERROR",
                    "errors": serializer.errors,
                }
                if isinstance(serializer.errors, dict):
                    payload.update(serializer.errors)
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)
            serializer.save(request=request_obj, user=request.user)

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response({
                "success": False,
                "error": "Failed to add comment",
                "error_code": "REQUEST_COMMENT_FAILED",
                "detail": str(exc),
            }, status=status.HTTP_400_BAD_REQUEST)
