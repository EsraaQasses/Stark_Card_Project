# shipping/views.py - FIXED VERSION
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction as db_transaction
from django.db.models import Case, F, IntegerField, When, Q
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
import logging

from system.models import Notification
from .models import (
    Shipping,
    StandardShippingRequest,
    AgentShippingRequest,
    AgentAdminShippingRequest,
)
from .serializers import (
    ShippingSerializer,
    ShippingStatusUpdateSerializer,
    StandardShippingRequestSerializer,
    AgentShippingRequestSerializer,
    AgentAdminShippingRequestSerializer,
)
from all_requests.serializers import CreatePaymentRequestSerializer, RequestSerializer
from users.permissions import IsRegularUser
from users.permissions import IsAdminUser
from wallets.models import Wallet
from wallets.services import ExchangeService, WalletService
from transactions.models import Transaction
from finance.services import FinanceService
from .financial_service import ShippingFinanceService
from agents.models import AgentProfile
from django.core.exceptions import ValidationError
from all_requests.filtering import (
    SecureFilterBackend, ShippingFilterSet, StandardShippingFilterSet,
    AgentShippingFilterSet, AgentAdminShippingFilterSet,
)
from all_requests.pagination import RequestPagination
from all_requests.openapi import SHIPPING_FILTER_PARAMETERS
from all_requests.pagination_serializers import PaginatedRequestResponseSerializer
from all_requests.schema_serializers import FilterValidationErrorSerializer
from drf_spectacular.utils import extend_schema, extend_schema_view

logger = logging.getLogger(__name__)

@extend_schema_view(
    list=extend_schema(parameters=SHIPPING_FILTER_PARAMETERS, responses={200: ShippingSerializer, 400: FilterValidationErrorSerializer}),
)
class ShippingViewSet(viewsets.ModelViewSet):
    queryset = Shipping.objects.none()
    serializer_class = ShippingSerializer
    filter_backends = [SecureFilterBackend]
    filterset_class = ShippingFilterSet
    pagination_class = RequestPagination
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        """Get total count of shipping requests"""
        try:
            pending_count = Shipping.objects.filter(status='pending').count()
            total_count = Shipping.objects.count()
            
            return Response({
                'total_count': total_count,
                'pending_count': pending_count,
                'approved_count': Shipping.objects.filter(status='approved').count(),
                'rejected_count': Shipping.objects.filter(status='rejected').count()
            })
        except Exception as e:
            logger.error(f"Error getting shipping counts: {str(e)}")
            return Response({
                'error': 'Database error',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return (
                Shipping.objects.all()
                .select_related('user', 'request')
                .annotate(
                    request_priority=Case(
                        When(user__role='agent', then=0),
                        When(user__agent__isnull=True, then=1),
                        default=2,
                        output_field=IntegerField(),
                    )
                )
                .order_by('-created_at', '-id')
            )
        if user.role == 'agent':
            return Shipping.objects.filter(user__agent=user).select_related('user', 'request')
        return Shipping.objects.filter(user=user).select_related('user', 'request')
    
    def get_serializer_class(self):
        if self.action in ['update_status', 'partial_update']:
            return ShippingStatusUpdateSerializer
        return ShippingSerializer

    def _can_update_shipping(self, user, shipping):
        if user.role == 'admin':
            return True
        if user.role == 'agent' and getattr(shipping.user, "agent_id", None) == user.id:
            return True
        return False
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        """Update shipping status with proper transaction handling - FIXED VERSION"""
        try:
            shipping = self.get_object()
            if not self._can_update_shipping(request.user, shipping):
                return Response({
                    "error": "You do not have permission to update this shipping request",
                    "error_code": "FORBIDDEN"
                }, status=status.HTTP_403_FORBIDDEN)

            new_status = request.data.get('status')
            old_status = shipping.status
            
            # Validate status transition
            if new_status not in ['pending', 'approved', 'rejected', 'processing']:
                return Response({
                    "error": "Invalid status. Must be one of: pending, approved, rejected, processing",
                    "error_code": "INVALID_STATUS"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if already approved
            if new_status == 'approved' and old_status == 'approved':
                return Response({
                    "error": "Shipping is already approved",
                    "error_code": "ALREADY_APPROVED"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate approval conditions
            if new_status == 'approved':
                is_valid, error_msg = self._validate_shipping_approval(shipping)
                if not is_valid:
                    return Response({
                        "error": error_msg,
                        "error_code": "INVALID_APPROVAL"
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            with db_transaction.atomic():
                # ✅ CRITICAL FIX: Create serializer with ALL data
                data = request.data.copy()
                data['status'] = new_status  # Force include status
                
                serializer = ShippingStatusUpdateSerializer(shipping, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                updated_shipping = serializer.save()
                
                # ✅ CRITICAL FIX: Update the original request status
                if new_status == 'approved':
                    default_note = 'Approved by admin' if request.user.role == 'admin' else 'Approved by agent'
                    approval_note = (
                        request.data.get('admin_notes')
                        or request.data.get('agent_notes')
                        or default_note
                    )
                    shipping.request.status = 'completed'
                    shipping.request.admin_notes = approval_note
                    shipping.request.save()
                    
                    # ✅ FIX: Process payment INSIDE transaction
                    payment_result = self._process_payment(shipping, approver=request.user)
                    if not payment_result.get("success"):
                        db_transaction.set_rollback(True)
                        return Response({
                            "success": False,
                            "error": payment_result.get("error") or "Payment processing failed",
                            "error_code": payment_result.get("error_code") or "PAYMENT_PROCESSING_FAILED",
                            "detail": payment_result.get("detail"),
                        }, status=status.HTTP_400_BAD_REQUEST)
                    
                    # ✅ Update shipping with new status
                    updated_shipping.status = 'approved'
                    updated_shipping.approved_by = request.user
                    updated_shipping.save()
                    
                elif new_status == 'rejected':
                    default_reason = 'Rejected by admin' if request.user.role == 'admin' else 'Rejected by agent'
                    rejection_reason = (
                        request.data.get('admin_notes')
                        or request.data.get('agent_notes')
                        or default_reason
                    )
                    shipping.request.status = 'rejected'
                    shipping.request.rejection_reason = rejection_reason
                    shipping.request.save()
                    
                    # ✅ Update shipping notes
                    updated_shipping.admin_notes = rejection_reason
                    updated_shipping.save()
                
                elif new_status == 'processing':
                    shipping.request.status = 'processing'
                    shipping.request.save()
            
            # ✅ Send notifications only after successful transaction
            if new_status == 'approved':
                Notification.objects.create(
                    recipient=shipping.user,
                    title="تمت الموافقة على طلب الشحن",
                    message=f"تمت الموافقة على شحنتك رقم {shipping.id} بقيمة {shipping.amount} {shipping.currency.upper()}",
                    icon="check-circle"
                )
                
            elif new_status == 'rejected':
                reason = request.data.get('admin_notes', 'لم يتم تحديد السبب')
                Notification.objects.create(
                    recipient=shipping.user,
                    title="تم رفض طلب الشحن",
                    message=f"تم رفض شحنتك رقم {shipping.id}. السبب: {reason}",
                    icon="alert-circle"
                )
            
            elif new_status == 'processing':
                Notification.objects.create(
                    recipient=shipping.user,
                    title="جاري معالجة طلب الشحن",
                    message=f"طلب شحنتك رقم {shipping.id} قيد المعالجة",
                    icon="clock"
                )
            
            # Return updated shipping data
            serializer = ShippingSerializer(updated_shipping)
            
            return Response({
                "success": True,
                "message": f"Shipping status updated to {new_status}",
                "shipping": serializer.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error updating shipping status: {str(e)}", exc_info=True)
            return Response({
                "success": False,
                "error": "Failed to update shipping status",
                "error_code": "SHIPPING_UPDATE_FAILED",
                "detail": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def _legacy_process_payment(self, shipping, approver=None):
        """Add funds to user's wallet and create transactions."""
        try:
            logger.info(f"Processing payment: {shipping.amount} {shipping.currency} for {shipping.user.name}")
            req_data = shipping.request.user_input_data or {}
            channel = (req_data.get("shipping_channel") or "").lower().strip()
            force_admin = channel == "admin"
            force_agent = channel == "agent"
            is_agent_cashout = (
                force_admin
                and (req_data.get("cashout_type") or "").lower().strip() == "agent"
            )

            if force_agent and not shipping.user.agent_id:
                return {
                    "success": False,
                    "error": "User has no agent assigned for agent shipping",
                    "error_code": "AGENT_NOT_ASSIGNED",
                }

            # Get user's wallet
            try:
                wallet_currency = (getattr(shipping, "wallet_currency", None) or shipping.currency)
                user_wallet = WalletService.get_or_create_wallet(shipping.user, wallet_currency)
            except Wallet.DoesNotExist:
                wallet_currency = (getattr(shipping, "wallet_currency", None) or shipping.currency)
                user_wallet = WalletService.get_or_create_wallet(shipping.user, wallet_currency)

            # Get exchange rates
            rates = ExchangeService.get_exchange_rates()
            if not rates or 'usd_to_syp' not in rates:
                raise ValueError("No legacy exchange rate is available")
            else:
                usd_to_syp = rates["usd_to_syp"]["value"]
                syp_to_usd = rates["syp_to_usd"]["value"]

            if shipping.currency == 'SYP':
                amount_in_usd = (shipping.amount * syp_to_usd).quantize(Decimal('0.01'))
                amount_in_syp = shipping.amount.quantize(Decimal('0.01'))
            else:
                amount_in_usd = shipping.amount.quantize(Decimal('0.01'))
                amount_in_syp = (shipping.amount * usd_to_syp).quantize(Decimal('0.01'))

            # Agent cashout via admin (deduct from agent on approval)
            if is_agent_cashout:
                cashout_tx_id = req_data.get("cashout_tx_id")
                tx = Transaction.objects.filter(
                    id=cashout_tx_id,
                    user=shipping.user,
                    wallet=user_wallet,
                    transaction_type="cashout",
                ).first() if cashout_tx_id else None
                if tx is None:
                    tx = FinanceService.withdraw(
                        wallet_id=user_wallet.id,
                        amount=shipping.amount,
                        transaction_type="cashout",
                        note=f"Agent cashout via admin (Shipping #{shipping.id})",
                        idempotency_key=f"shipping-cashout:{shipping.id}",
                        amount_usd=-amount_in_usd,
                        amount_syp=-amount_in_syp,
                        exchange_rate_used=usd_to_syp,
                    )
                tx = FinanceService.approve(tx.id)
                shipping.transaction_ref = f"TXN_{tx.id}"
                shipping.processed_at = tx.created_at
                shipping.save()

                Notification.objects.create(
                    recipient=shipping.user,
                    title="Cashout approved",
                    message=(
                        f"تمت الموافقة على طلب السحب بقيمة {shipping.amount} {shipping.currency}."
                    ),
                    icon="check-circle"
                )

                return {"success": True}

            # Agent-funded flow (default for users with agent, unless forced to admin)
            if shipping.user.agent_id and not force_admin:
                agent_user = shipping.user.agent
                agent_profile, _ = AgentProfile.objects.get_or_create(user=agent_user)
                agent_wallet = WalletService.get_or_create_wallet(agent_user, shipping.currency)
                if shipping.currency == "SYP":
                    coverage_limit = Decimal(str(getattr(agent_profile, "coverage_limit_syp", 0) or "0"))
                else:
                    coverage_limit = Decimal(str(getattr(agent_profile, "coverage_limit_usd", 0) or "0"))

                if agent_wallet.available_balance + coverage_limit < shipping.amount:
                    logger.warning("Agent credit limit exceeded for shipping %s", shipping.id)
                    return {
                        "success": False,
                        "error": "Agent credit limit exceeded",
                        "error_code": "AGENT_CREDIT_LIMIT_EXCEEDED",
                    }
                sender_tx = FinanceService.transfer(
                    sender_wallet_id=agent_wallet.id,
                    recipient_wallet_id=user_wallet.id,
                    amount=shipping.amount,
                    note=f"Shipping #{shipping.id} transfer to {shipping.user.name}",
                    idempotency_key=f"shipping-agent-transfer:{shipping.id}",
                    allow_overdraft=True,
                    overdraft_limit=coverage_limit,
                )
                shipping.transaction_ref = f"TXN_{sender_tx.id}"
                shipping.processed_at = sender_tx.created_at
                shipping.save()

                Notification.objects.create(
                    recipient=shipping.user,
                    title="Wallet funded",
                    message=(
                        f"Added {shipping.amount} {shipping.currency} to your wallet. "
                        f"Current balance: {user_wallet.available_balance} {user_wallet.currency}"
                    ),
                    icon="dollar-sign"
                )

                return {"success": True}

            # Admin-funded flow (no agent)
            transaction_obj = FinanceService.deposit(
                wallet_id=user_wallet.id,
                amount=shipping.amount,
                amount_usd=amount_in_usd,
                amount_syp=amount_in_syp,
                exchange_rate_used=usd_to_syp,
                transaction_type="deposit",
                note=f"Shipping #{shipping.id} payment - {shipping.amount} {shipping.currency}",
                idempotency_key=f"shipping-admin-deposit:{shipping.id}",
            )
            transaction_obj = FinanceService.approve(transaction_obj.id, admin_user=approver)

            shipping.transaction_ref = f"TXN_{transaction_obj.id}"
            shipping.processed_at = transaction_obj.created_at
            shipping.save()

            Notification.objects.create(
                recipient=shipping.user,
                title="Wallet funded",
                message=(
                    f"Added {shipping.amount} {shipping.currency} to your wallet. "
                    f"Current balance: {user_wallet.available_balance} {user_wallet.currency}"
                ),
                icon="dollar-sign"
            )

            return {"success": True}

        except Exception as e:
            logger.error(
                "Payment failed for shipping %s: %s", shipping.id, str(e), exc_info=True
            )

            try:
                admin_users = shipping.user.__class__.objects.filter(role='admin', is_active=True)
                for admin in admin_users:
                    Notification.objects.create(
                        recipient=admin,
                        title="Payment processing failed",
                        message=(
                            f"Shipping #{shipping.id} failed. Error: {str(e)}"
                        ),
                        icon="alert-triangle"
                    )
            except Exception as notify_error:
                logger.error("Failed to send admin notification: %s", notify_error)

            return {
                "success": False,
                "error": "Payment processing failed",
                "error_code": "PAYMENT_PROCESSING_FAILED",
                "detail": str(e),
            }

    def _process_payment(self, shipping, approver=None):
        """Canonical adapter for every linked shipping approval path."""
        from .financial_service import ShippingFinanceService, RateUnavailable
        try:
            transaction_obj = ShippingFinanceService.process_shipping(shipping, approver=approver)
            return {
                "success": True,
                "transaction_id": getattr(transaction_obj, "id", None),
                "credited_amount": None if getattr(transaction_obj, "target_amount", None) is None else str(transaction_obj.target_amount),
                "credited_currency": getattr(transaction_obj, "target_currency", None),
            }
        except RateUnavailable:
            return {"success": False, "error": "No active USD/SYP quote is available.", "error_code": "FX_RATE_UNAVAILABLE"}
        except Exception as exc:
            logger.exception("Canonical shipping processing failed for %s", shipping.id)
            return {"success": False, "error": str(exc), "error_code": getattr(exc, "code", "SHIPPING_STATE_CONFLICT")}

    def _validate_shipping_approval(self, shipping):
        """Validate if shipping can be approved"""
        if shipping.status == 'approved':
            return False, "Shipping is already approved"
        
        if shipping.amount <= Decimal('0'):
            return False, "Shipping amount must be greater than zero"
        
        if not shipping.user.is_active:
            return False, "User account is not active"
        
        # Check if shipping is linked to a valid request
        if not shipping.request:
            return False, "Shipping is not linked to a valid request"
        
        # Check request status
        if shipping.request.status == 'completed':
            return False, "Request is already completed"
        
        return True, "Valid for approval"

    @action(detail=True, methods=['get'], permission_classes=[IsAdminUser])
    def payment_status(self, request, pk=None):
        """Get detailed payment status for a shipping"""
        try:
            shipping = self.get_object()
            
            payment_data = {
                "shipping_id": shipping.id,
                "status": shipping.status,
                "amount": float(shipping.amount),
                "currency": shipping.currency.upper(),
                "transaction_ref": shipping.transaction_ref,
                "processed_at": shipping.processed_at,
                "created_at": shipping.created_at,
                "user": {
                    "id": shipping.user.id,
                    "name": shipping.user.name,
                    "email": shipping.user.email,
                    "is_active": shipping.user.is_active
                },
                "request": {
                    "id": shipping.request.id,
                    "status": shipping.request.status,
                    "type": shipping.request.request_type
                }
            }
            
            # Add wallet information if payment was processed
            if shipping.transaction_ref:
                try:
                    transaction_id = shipping.transaction_ref.replace("TXN_", "")
                    transaction = Transaction.objects.get(id=transaction_id)
                    wallet = transaction.wallet
                    
                    payment_data.update({
                        "wallet": {
                            "id": wallet.id,
                            "available_balance": float(wallet.available_balance),
                            "pending_balance": float(wallet.pending_balance),
                            "total_balance": float(wallet.total_balance)
                        },
                        "transaction": {
                            "id": transaction.id,
                            "amount": float(transaction.amount),
                            "amount_syp": float(transaction.amount_syp) if transaction.amount_syp else None,
                            "exchange_rate": float(transaction.exchange_rate_used) if transaction.exchange_rate_used else None,
                            "status": transaction.status,
                            "created_at": transaction.created_at,
                            "note": transaction.note
                        }
                    })
                except ObjectDoesNotExist:
                    payment_data["transaction_info"] = "Transaction not found"
            
            return Response(payment_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting payment status: {str(e)}")
            return Response({
                "error": "Failed to get payment status"
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def pending_payments(self, request):
        """Get all pending shipping payments with summary"""
        try:
            pending_shippings = Shipping.objects.filter(status='pending').select_related('user')
            
            total_pending_amount = Decimal('0')
            shippings_data = []
            
            for shipping in pending_shippings:
                total_pending_amount += shipping.amount
                shippings_data.append({
                    'id': shipping.id,
                    'user': {
                        'id': shipping.user.id,
                        'name': shipping.user.name,
                        'email': shipping.user.email
                    },
                    'amount': float(shipping.amount),
                    'currency': shipping.currency.upper(),
                    'created_at': shipping.created_at
                })
            
            return Response({
                'total_pending_amount': float(total_pending_amount),
                'pending_count': len(shippings_data),
                'shippings': shippings_data
            })
            
        except Exception as e:
            logger.error(f"Error getting pending payments: {str(e)}")
            return Response({
                'error': 'Failed to get pending payments'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def agent_requests(self, request):
        """List shipping requests for users assigned to agents"""
        queryset = Shipping.objects.filter(
            Q(user__agent__isnull=False) | Q(user__role="agent")
        ).select_related('user', 'request')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ShippingSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ShippingSerializer(queryset, many=True)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        """Override list to include payment statistics for admins"""
        try:
            queryset = self.filter_queryset(self.get_queryset())

            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = ShippingSerializer(page, many=True)
                response = self.get_paginated_response(serializer.data)
            else:
                serializer = ShippingSerializer(queryset, many=True)
                response = Response({"results": serializer.data})

            if request.user.role == 'admin':
                from django.db.models import Sum
                stats_queryset = Shipping.objects.all()
                approved_shippings = stats_queryset.filter(status='approved')
                total_amount = approved_shippings.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                pending_shippings = stats_queryset.filter(status='pending')
                pending_amount = pending_shippings.aggregate(total=Sum('amount'))['total'] or Decimal('0')
                usd_approved = approved_shippings.filter(currency='USD').aggregate(total=Sum('amount'))['total'] or Decimal('0')
                syp_approved = approved_shippings.filter(currency='SYP').aggregate(total=Sum('amount'))['total'] or Decimal('0')
                response.data['payment_statistics'] = {
                    'total_approved_amount': float(total_amount),
                    'total_pending_amount': float(pending_amount),
                    'usd_approved': float(usd_approved),
                    'syp_approved': float(syp_approved),
                    'approved_shippings_count': approved_shippings.count(),
                    'pending_shippings_count': pending_shippings.count(),
                    'rejected_shippings_count': stats_queryset.filter(status='rejected').count()
                }

            return response

        except Exception as e:
            logger.error(f"Error in shipping list: {str(e)}")
            return super().list(request, *args, **kwargs)


class AgentShippingRequestView(APIView):
    permission_classes = [IsRegularUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        data = request.data or {}
        amount = data.get("amount")
        currency = data.get("currency")
        note = data.get("note") or ""
        payment_method = data.get("payment_method")
        wallet_currency = data.get("wallet_currency")
        user_input_data = data.get("user_input_data") or {}
        if isinstance(user_input_data, str):
            try:
                import json
                user_input_data = json.loads(user_input_data)
            except Exception:
                user_input_data = {}

        # Merge explicit fields into user_input_data (explicit wins)
        user_input_data = {
            **(user_input_data or {}),
            "shipping_channel": "agent",
            "wallet_currency": wallet_currency,
            "note": note,
        }

        payload = {
            "request_type": "cashout",
            "amount": amount,
            "currency": currency,
            "payment_method": payment_method,
            "user_input_data": user_input_data,
        }
        if request.FILES.get("receipt_image"):
            payload["receipt_image"] = request.FILES.get("receipt_image")

        serializer = CreatePaymentRequestSerializer(
            data=payload,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request_obj = serializer.save()

        # Keep status as pending so it appears in admin Requests page
        try:
            agent_user = getattr(request.user, "agent", None)
            if agent_user:
                Notification.objects.create(
                    recipient=agent_user,
                    title="New agent shipping request",
                    message=f"{request.user.name} requested shipping of {amount} {currency}.",
                    icon="inbox",
                )
        except Exception:
            pass

        response = {
            "success": True,
            "request": RequestSerializer(request_obj).data,
        }
        if hasattr(request_obj, "shipping"):
            response["shipping_id"] = request_obj.shipping.id

        return Response(response, status=status.HTTP_201_CREATED)


class AgentCashoutRequestView(APIView):
    permission_classes = [IsRegularUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        # Only agents can request cashout from admin
        if request.user.role != "agent":
            return Response(
                {"error": "Only agents can request cashout from admin"},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data or {}
        amount = data.get("amount")
        currency = data.get("currency")
        note = data.get("note") or ""
        wallet_currency = data.get("wallet_currency")
        user_input_data = data.get("user_input_data") or {}
        if isinstance(user_input_data, str):
            try:
                import json
                user_input_data = json.loads(user_input_data)
            except Exception:
                user_input_data = {}

        user_input_data = {
            **(user_input_data or {}),
            "shipping_channel": "admin",
            "wallet_currency": wallet_currency,
            "note": note,
            "cashout_type": "agent",
        }

        payload = {
            "request_type": "cashout",
            "title": f"Agent Cashout Request - {amount} {currency}",
            "description": f"Agent cashout request. Note: {note}",
            "amount": amount,
            "currency": currency,
            "user_input_data": user_input_data,
        }

        serializer = CreatePaymentRequestSerializer(
            data=payload,
            context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        request_obj = serializer.save()

        # Reserve funds immediately so they appear as pending until admin approves/rejects
        try:
            wallet_currency = (wallet_currency or "").upper()
            if wallet_currency not in {"USD", "SYP"}:
                raise ValidationError("wallet_currency is required and must be USD or SYP.")

            agent_wallet = Wallet.objects.get(user=request.user, currency=wallet_currency)
            agent_profile = AgentProfile.objects.filter(user=request.user).first()
            overdraft_limit = Decimal("0")
            if agent_profile:
                if wallet_currency == "SYP":
                    overdraft_limit = Decimal(str(agent_profile.coverage_limit_syp or 0))
                else:
                    overdraft_limit = Decimal(str(agent_profile.coverage_limit_usd or 0))

            cashout_tx, cashout_context = ShippingFinanceService.reserve_cashout(
                user=request.user, wallet=agent_wallet, amount=Decimal(str(amount)),
                payout_currency=str(user_input_data.get("payout_currency") or wallet_currency).upper(),
                recipient=getattr(request.user, "agent", None),
                note=f"Agent cashout pending (Request #{request_obj.id})",
                operation_key=request.headers.get("Idempotency-Key") or f"request-cashout:{request_obj.id}",
                coverage_limit=overdraft_limit,
            )
            request_obj.user_input_data = {
                **(request_obj.user_input_data or {}),
                "cashout_tx_id": cashout_tx.id,
                "financial_snapshot": cashout_context.snapshot,
            }
            request_obj.save(update_fields=["user_input_data"])
        except Exception as e:
            request_obj.delete()
            return Response(
                {"error": f"Failed to reserve funds: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        response = {
            "success": True,
            "request": RequestSerializer(request_obj).data,
        }
        if hasattr(request_obj, "shipping"):
            response["shipping_id"] = request_obj.shipping.id

        return Response(response, status=status.HTTP_201_CREATED)


def _normalize_user_input(raw):
    if raw is None:
        return {}
    if isinstance(raw, str):
        try:
            import json
            return json.loads(raw)
        except Exception:
            return {}
    if isinstance(raw, dict):
        return raw
    return {}


@extend_schema_view(
    list=extend_schema(parameters=SHIPPING_FILTER_PARAMETERS, responses={200: StandardShippingRequestSerializer, 400: FilterValidationErrorSerializer}),
)
class StandardShippingRequestViewSet(viewsets.ModelViewSet):
    queryset = StandardShippingRequest.objects.none()
    serializer_class = StandardShippingRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SecureFilterBackend]
    filterset_class = StandardShippingFilterSet
    pagination_class = RequestPagination

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            queryset = StandardShippingRequest.objects.all()
        elif user.role == 'agent':
            queryset = StandardShippingRequest.objects.filter(user__agent=user)
        else:
            queryset = StandardShippingRequest.objects.filter(user=user)
        return queryset.select_related('user', 'payment_method', 'approved_by').order_by('-created_at', '-id')

    def perform_create(self, serializer):
        if self.request.user.role == 'admin':
            raise ValidationError("Admins cannot create standard shipping requests.")
        user_input_data = _normalize_user_input(self.request.data.get("user_input_data"))
        wallet_currency = (user_input_data.get("wallet_currency") or self.request.data.get("wallet_currency") or "").upper()
        if wallet_currency not in {"USD", "SYP"}:
            raise ValidationError("wallet_currency is required and must be USD or SYP.")
        currency = (serializer.validated_data.get("currency") or "").upper()
        wallet = Wallet.objects.filter(user=self.request.user, currency=wallet_currency).first()
        if wallet is None:
            raise ValidationError("Target wallet does not exist.")
        try:
            context = ShippingFinanceService.prepare(
                flow_type="shipping", user_id=self.request.user.id,
                amount=serializer.validated_data["amount"], submitted_currency=currency,
                target_currency=wallet_currency, credited_wallet_id=wallet.id,
                operation_key=self.request.headers.get("Idempotency-Key"),
            )
        except Exception as exc:
            raise ValidationError(getattr(exc, "code", str(exc)))
        user_input_data = ShippingFinanceService.write_snapshot(user_input_data, context)
        pm = serializer.validated_data.get("payment_method")
        if pm:
            requires_receipt = getattr(pm, "requires_receipt", True)
            if requires_receipt and not self.request.FILES.get("receipt_image") and not serializer.validated_data.get("receipt_image"):
                raise ValidationError("Receipt image is required for this method.")
        serializer.save(
            user=self.request.user,
            wallet_currency=wallet_currency,
            user_input_data=user_input_data,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_status(self, request, pk=None):
        shipping = self.get_object()
        new_status = request.data.get('status')
        if new_status not in ['pending', 'approved', 'rejected', 'processing']:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'approved' and shipping.status == 'approved':
            return Response({"error": "Already approved"}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'approved':
            with db_transaction.atomic():
                transaction_obj = ShippingFinanceService.process_shipping(shipping, approver=request.user)

                shipping.status = 'approved'
                shipping.admin_notes = request.data.get('admin_notes', shipping.admin_notes)
                shipping.approved_by = request.user
                shipping.transaction_ref = f"TXN_{transaction_obj.id}"
                shipping.processed_at = transaction_obj.created_at
                shipping.save()

            Notification.objects.create(
                recipient=shipping.user,
                title="تمت الموافقة على طلب الشحن",
                message=f"تمت الموافقة على طلب الشحن بقيمة {shipping.amount} {shipping.currency}.",
                icon="check-circle"
            )
        elif new_status == 'rejected':
            shipping.status = 'rejected'
            shipping.admin_notes = request.data.get('admin_notes', shipping.admin_notes)
            shipping.save()
            note = shipping.admin_notes or "لا يوجد سبب محدد"
            Notification.objects.create(
                recipient=shipping.user,
                title="تم رفض طلب الشحن",
                message=f"تم رفض طلب الشحن بقيمة {shipping.amount} {shipping.currency}. السبب: {note}",
                icon="x-circle"
            )
        else:
            shipping.status = new_status
            shipping.admin_notes = request.data.get('admin_notes', shipping.admin_notes)
            shipping.save()

        return Response({"success": True, "shipping": StandardShippingRequestSerializer(shipping).data})


@extend_schema_view(
    list=extend_schema(parameters=SHIPPING_FILTER_PARAMETERS, responses={200: AgentShippingRequestSerializer, 400: FilterValidationErrorSerializer}),
)
class AgentShippingRequestViewSet(viewsets.ModelViewSet):
    queryset = AgentShippingRequest.objects.none()
    serializer_class = AgentShippingRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SecureFilterBackend]
    filterset_class = AgentShippingFilterSet
    pagination_class = RequestPagination

    def get_queryset(self):
        user = self.request.user
        if user.role == 'agent':
            queryset = AgentShippingRequest.objects.filter(agent=user)
        elif user.role == 'admin':
            queryset = AgentShippingRequest.objects.all()
        else:
            queryset = AgentShippingRequest.objects.filter(user=user)
        return queryset.select_related('user', 'agent', 'approved_by').order_by('-created_at', '-id')

    def perform_create(self, serializer):
        if self.request.user.role == 'agent':
            raise ValidationError("Agents cannot create via-agent shipping for users.")
        if self.request.user.role == 'admin':
            raise ValidationError("Admins cannot create via-agent shipping requests.")
        agent_user = getattr(self.request.user, "agent", None)
        if not agent_user:
            raise ValidationError("User has no agent assigned.")

        user_input_data = _normalize_user_input(self.request.data.get("user_input_data"))
        wallet_currency = (user_input_data.get("wallet_currency") or self.request.data.get("wallet_currency") or "").upper()
        if wallet_currency not in {"USD", "SYP"}:
            raise ValidationError("wallet_currency is required and must be USD or SYP.")
        currency = (serializer.validated_data.get("currency") or "").upper()
        user_wallet = Wallet.objects.filter(user=self.request.user, currency=wallet_currency).first()
        agent_wallet = Wallet.objects.filter(user=agent_user, currency=currency).first()
        if not user_wallet or not agent_wallet:
            raise ValidationError("Source and target wallets must exist.")
        try:
            context = ShippingFinanceService.prepare(
                flow_type="agent_shipping", user_id=self.request.user.id,
                amount=serializer.validated_data["amount"], submitted_currency=currency,
                target_currency=wallet_currency, source_wallet_id=agent_wallet.id,
                credited_wallet_id=user_wallet.id,
                operation_key=self.request.headers.get("Idempotency-Key"),
            )
        except Exception as exc:
            raise ValidationError(getattr(exc, "code", str(exc)))
        user_input_data = ShippingFinanceService.write_snapshot(user_input_data, context)

        shipping = serializer.save(
            user=self.request.user,
            agent=agent_user,
            wallet_currency=wallet_currency,
            user_input_data=user_input_data,
        )
        # Notify agent about new via-agent shipping request
        try:
            Notification.objects.create(
                recipient=agent_user,
                title="New agent shipping request",
                message=(
                    f"{self.request.user.name} requested shipping of "
                    f"{shipping.amount} {shipping.currency}."
                ),
                icon="inbox",
            )
        except Exception as e:
            logger.error("Failed to notify agent for via-agent shipping %s: %s", shipping.id, e)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        shipping = self.get_object()
        if request.user.role != 'agent' or shipping.agent_id != request.user.id:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in ['pending', 'approved', 'rejected', 'processing']:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'approved' and shipping.status == 'approved':
            return Response({"error": "Already approved"}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'approved':
            sender_tx = ShippingFinanceService.process_shipping(shipping, approver=request.user)

            shipping.status = 'approved'
            shipping.agent_notes = request.data.get('agent_notes', shipping.agent_notes)
            shipping.approved_by = request.user
            shipping.agent_transaction_ref = f"TXN_{sender_tx.id}"
            shipping.user_transaction_ref = f"TXN_{sender_tx.id}"
            shipping.processed_at = sender_tx.created_at
            shipping.save()

            Notification.objects.create(
                recipient=shipping.user,
                title="تمت الموافقة على طلب الشحن عبر الوكيل",
                message=f"تمت إضافة {shipping.amount} {shipping.currency} إلى محفظتك.",
                icon="check-circle"
            )
        elif new_status == 'rejected':
            shipping.status = 'rejected'
            shipping.agent_notes = request.data.get('agent_notes', shipping.agent_notes)
            shipping.save()
            note = shipping.agent_notes or "No reason provided"
            Notification.objects.create(
                recipient=shipping.user,
                title="تم رفض طلب الشحن عبر الوكيل",
                message=f"تم رفض طلب الشحن بقيمة {shipping.amount} {shipping.currency}. السبب: {note}",
                icon="x-circle"
            )
        else:
            shipping.status = new_status
            shipping.agent_notes = request.data.get('agent_notes', shipping.agent_notes)
            shipping.save()

        return Response({"success": True, "shipping": AgentShippingRequestSerializer(shipping).data})


@extend_schema_view(
    list=extend_schema(parameters=SHIPPING_FILTER_PARAMETERS, responses={200: AgentAdminShippingRequestSerializer, 400: FilterValidationErrorSerializer}),
)
class AgentAdminShippingRequestViewSet(viewsets.ModelViewSet):
    queryset = AgentAdminShippingRequest.objects.none()
    serializer_class = AgentAdminShippingRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [SecureFilterBackend]
    filterset_class = AgentAdminShippingFilterSet
    pagination_class = RequestPagination

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            queryset = AgentAdminShippingRequest.objects.all()
        elif user.role == 'agent':
            queryset = AgentAdminShippingRequest.objects.filter(agent=user)
        else:
            queryset = AgentAdminShippingRequest.objects.none()
        return queryset.select_related('agent', 'approved_by').order_by('-created_at', '-id')

    def perform_create(self, serializer):
        if self.request.user.role != 'agent':
            raise ValidationError("Only agents can create admin-shipping requests.")
        user_input_data = _normalize_user_input(self.request.data.get("user_input_data"))
        wallet_currency = (user_input_data.get("wallet_currency") or self.request.data.get("wallet_currency") or "").upper()
        if wallet_currency not in {"USD", "SYP"}:
            raise ValidationError("wallet_currency is required and must be USD or SYP.")
        currency = (serializer.validated_data.get("currency") or "").upper()
        agent_wallet = Wallet.objects.filter(user=self.request.user, currency=wallet_currency).first()
        if not agent_wallet:
            raise ValidationError("Target wallet does not exist.")
        try:
            context = ShippingFinanceService.prepare(
                flow_type="agent_admin_shipping", user_id=self.request.user.id,
                amount=serializer.validated_data["amount"], submitted_currency=currency,
                target_currency=wallet_currency, credited_wallet_id=agent_wallet.id,
                operation_key=self.request.headers.get("Idempotency-Key"),
            )
        except Exception as exc:
            raise ValidationError(getattr(exc, "code", str(exc)))
        user_input_data = ShippingFinanceService.write_snapshot(user_input_data, context)
        serializer.save(
            agent=self.request.user,
            wallet_currency=wallet_currency,
            user_input_data=user_input_data,
        )

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def update_status(self, request, pk=None):
        shipping = self.get_object()
        new_status = request.data.get('status')
        if new_status not in ['pending', 'approved', 'rejected', 'processing']:
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'approved' and shipping.status == 'approved':
            return Response({"error": "Already approved"}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'approved':
            with db_transaction.atomic():
                transaction_obj = ShippingFinanceService.process_shipping(shipping, approver=request.user)

                shipping.status = 'approved'
                shipping.admin_notes = request.data.get('admin_notes', shipping.admin_notes)
                shipping.approved_by = request.user
                shipping.transaction_ref = f"TXN_{transaction_obj.id}"
                shipping.processed_at = transaction_obj.created_at
                shipping.save()

            Notification.objects.create(
                recipient=shipping.agent,
                title="تمت الموافقة على طلب شحن الوكيل",
                message=f"تمت إضافة {shipping.amount} {shipping.currency} إلى محفظتك.",
                icon="check-circle"
            )
        elif new_status == 'rejected':
            shipping.status = 'rejected'
            shipping.admin_notes = request.data.get('admin_notes', shipping.admin_notes)
            shipping.save()
            note = shipping.admin_notes or "لا يوجد سبب محدد"
            Notification.objects.create(
                recipient=shipping.agent,
                title="تم رفض طلب شحن الوكيل",
                message=f"تم رفض طلب الشحن بقيمة {shipping.amount} {shipping.currency}. السبب: {note}",
                icon="x-circle"
            )
        else:
            shipping.status = new_status
            shipping.admin_notes = request.data.get('admin_notes', shipping.admin_notes)
            shipping.save()

        return Response({"success": True, "shipping": AgentAdminShippingRequestSerializer(shipping).data})

