# agents/views.py - UPDATED VERSION
from decimal import Decimal, ROUND_DOWN, getcontext
from django.db import transaction as db_transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from django.db.models import Sum
from system.models import Notification
from users.utils import generate_agent_code
from users.models import CustomerCategory
from .models import AgentProductAssignment, User
from users.permissions import IsAdminUser  
from wallets.models import Wallet
from transactions.models import Transaction
from store.models import Product
from store.services.price_service import PriceService
from store.services.pricing import PricingPolicy
from third_party_apis.services.api_service import APIService
from .models import AgentProfile
from agents.services.commission_service import credit_agent_commission
from finance.services import FinanceService
from finance.conversion import CurrencyConversionService, RateSide
from shipping.financial_service import ShippingFinanceService
from all_requests.filtering import CashoutFilterSet, SecureFilterBackend
from all_requests.pagination import RequestPagination
from all_requests.openapi import CASHOUT_FILTER_PARAMETERS
from all_requests.pagination_serializers import PaginatedRequestResponseSerializer
from all_requests.schema_serializers import CashoutListSerializer, FilterValidationErrorSerializer
from drf_spectacular.utils import extend_schema
from .serializers import AgentProductAssignmentSerializer, AgentProfileRegionSerializer, AgentProfileSerializer
from users.serializers import UserSerializer, SubordinateUserSerializer
from users.utils.audit_logger import AuditLogger
import logging
from django.core.exceptions import ValidationError
logger = logging.getLogger(__name__)
User = get_user_model()
getcontext().prec = 28

def serialize_cashout(tx: Transaction):
    return {
        "id": tx.id,
        "amount": float(abs(tx.amount)),
        "currency": tx.currency,
        "status": tx.status,
        "note": tx.note,
        "created_at": tx.created_at,
        "wallet_id": tx.wallet_id,
        "user_id": tx.user_id,
        "user_name": getattr(tx.user, "full_name", None) or getattr(tx.user, "name", None),
        "user_email": getattr(tx.user, "email", None),
        "user_phone": getattr(tx.user, "phone", None),
        "agent_id": tx.recipient_id,
        "agent_name": getattr(tx.recipient, "full_name", None) or getattr(tx.recipient, "name", None),
        "agent_email": getattr(tx.recipient, "email", None),
        "agent_phone": getattr(tx.recipient, "phone", None),
    }

# ------------------ Agent List ------------------
class AgentListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Ensure all agent users have AgentProfile objects
        agent_users = User.objects.filter(role='agent').select_related('category', 'category_assigned_by')
        for user in agent_users:
            AgentProfile.objects.get_or_create(user=user)

        agent_profiles = AgentProfile.objects.select_related('user', 'user__category', 'user__category_assigned_by').all()
        data = []

        for agent_profile in agent_profiles:
            agent_user = agent_profile.user
            if not request.user.is_authenticated:
                data.append({
                    "id": agent_user.id,
                    "full_name": agent_user.full_name or agent_user.name,
                    "region": agent_profile.region,
                })
                continue

            # 1. Username and full name
            username = agent_user.name
            full_name = agent_user.full_name or agent_user.name

            # 2. Number of clients (subordinates)
            clients_count = agent_user.subordinates.count()

            # 3. Wallet balance - use total_balance property
            wallets = Wallet.objects.filter(user=agent_user)
            total_balance = sum(float(wallet.total_balance) for wallet in wallets) if wallets else 0.0
            usd_wallet = next((w for w in wallets if w.currency == "USD"), None)
            syp_wallet = next((w for w in wallets if w.currency == "SYP"), None)

            # 4. Commission rate from AgentProfile
            commission_rate = float(agent_profile.commission_rate or 0)

            # 5. Number of assigned products
            products_count = AgentProductAssignment.objects.filter(agent=agent_user).count()

            # Use UserSerializer to get consistent category_details
            user_serializer = UserSerializer(agent_user, context={'request': request})
            user_data = user_serializer.data
            category_details = user_data.get('category_details')
            
            has_assigned_category = agent_user.category is not None
            
            if not category_details:
                # Use default category object to match UserSerializer behavior
                default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
                if default_cat:
                    category_details = {
                        "id": default_cat.id,
                        "name": default_cat.name,
                        "display_name": default_cat.display_name,
                        "profit_percentage": float(default_cat.profit_percentage),
                    }

            data.append({
                "id": agent_user.id,
                "username": username,
                "full_name": full_name,
                "avatar": agent_user.avatar.url if getattr(agent_user, 'avatar', None) else None,
                "region": agent_profile.region,
                "agent_code": agent_user.agent_code,
                "clients_count": clients_count,
                "balance": total_balance,
                "balance_usd": float(usd_wallet.available_balance) if usd_wallet else 0.0,
                "balance_syp": float(syp_wallet.available_balance) if syp_wallet else 0.0,
                "commission_rate": commission_rate,
                "coverage_limit_usd": float(agent_profile.coverage_limit_usd or 0),
                "coverage_limit_syp": float(agent_profile.coverage_limit_syp or 0),
                "total_earnings_usd": float(getattr(agent_profile, "total_earnings_usd", 0) or 0),
                "total_earnings_syp": float(getattr(agent_profile, "total_earnings_syp", 0) or 0),
                "products_count": products_count,
                "category": category_details,
                "category_details": category_details,
                "has_assigned_category": has_assigned_category
            })

        return Response(data)
    
# ------------------ Agent Connect ------------------
class AgentConnectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        requester = request.user
        target_user = requester

        if getattr(requester, "role", None) == "admin":
            target_user_id = request.data.get("user_id")
            if not target_user_id:
                return Response({"error": "user_id is required for admin"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        elif getattr(requester, "role", None) != "user":
            return Response({"error": "Only regular users can connect to an agent"}, status=status.HTTP_403_FORBIDDEN)

        agent_id = request.data.get("agent_id")
        agent_code = request.data.get("agent_code")
        allow_switch = bool(request.data.get("allow_switch", False))

        if not agent_id and not agent_code:
            return Response({"error": "agent_id or agent_code is required"}, status=status.HTTP_400_BAD_REQUEST)

        if agent_id and agent_code:
            return Response({"error": "Use only one of agent_id or agent_code"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if agent_id:
                agent = User.objects.get(id=agent_id, role='agent')
            else:
                agent = User.objects.get(agent_code=agent_code, role='agent')
        except User.DoesNotExist:
            return Response({"error": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)

        if agent.id == target_user.id:
            return Response({"error": "You cannot assign yourself as an agent"}, status=status.HTTP_400_BAD_REQUEST)

        old_agent = None
        if target_user.agent_id:
            if target_user.agent_id == agent.id:
                return Response({
                    "message": "Already connected to this agent",
                    "agent_id": agent.id
                }, status=status.HTTP_200_OK)
            if requester.role != "admin" and not allow_switch:
                return Response({"error": "User already has an agent"}, status=status.HTTP_400_BAD_REQUEST)
            old_agent = target_user.agent

        target_user.agent = agent
        target_user.save(update_fields=["agent"])

        Notification.objects.create(
            recipient=target_user,
            title="Agent connected",
            message=f"You are now connected to agent {agent.full_name}",
            icon=""
        )
        Notification.objects.create(
            recipient=agent,
            title="New user connected",
            message=f"User {target_user.full_name} is now connected to you",
            icon=""
        )
        if old_agent:
            Notification.objects.create(
                recipient=old_agent,
                title="User switched agent",
                message=f"User {target_user.full_name} switched to agent {agent.full_name}",
                icon=""
            )

        return Response({
            "message": "Agent connected successfully",
            "agent_id": agent.id,
            "agent_name": agent.full_name,
            "switched": bool(old_agent)
        }, status=status.HTTP_200_OK)



class AdminCashoutListView(APIView):
    serializer_class = CashoutListSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [SecureFilterBackend]
    filterset_class = CashoutFilterSet
    pagination_class = RequestPagination

    @extend_schema(parameters=CASHOUT_FILTER_PARAMETERS, responses={200: PaginatedRequestResponseSerializer, 400: FilterValidationErrorSerializer})
    def get(self, request):
        qs = Transaction.objects.filter(transaction_type="cashout").select_related("user", "recipient", "wallet").order_by("-created_at", "-id")
        qs = self.filter_backends[0]().filter_queryset(request, qs, self)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([serialize_cashout(tx) for tx in page])



class AgentDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if getattr(user, "agent_id", None) is None:
            return Response({"message": "No agent connected."}, status=status.HTTP_200_OK)

        old_agent = user.agent
        user.agent = None
        user.save(update_fields=["agent"])

        try:
            Notification.objects.create(
                recipient=user,
                title="Agent disconnected",
                message="Your agent has been disconnected.",
                icon=""
            )
            if old_agent:
                Notification.objects.create(
                    recipient=old_agent,
                    title="User disconnected",
                    message=f"User {user.full_name or user.name} disconnected from you.",
                    icon=""
                )
        except Exception:
            pass

        return Response({"message": "Agent disconnected."}, status=status.HTTP_200_OK)


# ------------------ Cashout Requests (User -> Agent) ------------------
class AgentCashoutView(APIView):
    serializer_class = CashoutListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SecureFilterBackend]
    filterset_class = CashoutFilterSet
    pagination_class = RequestPagination

    @extend_schema(parameters=CASHOUT_FILTER_PARAMETERS, responses={200: PaginatedRequestResponseSerializer, 400: FilterValidationErrorSerializer})
    def get(self, request):
        user = request.user
        as_agent = request.query_params.get("as_agent") in ["1", "true", "True"]

        if getattr(user, "role", None) == "agent" and as_agent:
            qs = Transaction.objects.filter(transaction_type="cashout", recipient=user)
        else:
            qs = Transaction.objects.filter(transaction_type="cashout", user=user)

        qs = qs.select_related("user", "recipient", "wallet").order_by("-created_at", "-id")
        qs = self.filter_backends[0]().filter_queryset(request, qs, self)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([serialize_cashout(tx) for tx in page])

    @extend_schema(request=None, responses=PaginatedRequestResponseSerializer)
    def post(self, request):
        user = request.user
        if getattr(user, "role", None) != "user":
            return Response({"error": "Only regular users can request cashout"}, status=status.HTTP_403_FORBIDDEN)

        agent = getattr(user, "agent", None)
        if not agent:
            return Response({"error": "User must be connected to an agent"}, status=status.HTTP_400_BAD_REQUEST)

        wallet_id = request.data.get("wallet_id")
        amount_raw = request.data.get("amount")
        note = request.data.get("note") or ""

        if not wallet_id:
            return Response({"error": "wallet_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response({"error": "Invalid amount"}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal("0"):
            return Response({"error": "Amount must be greater than zero"}, status=status.HTTP_400_BAD_REQUEST)

        wallet = get_object_or_404(Wallet, id=wallet_id, user=user)

        payout_currency = str(request.data.get("payout_currency") or request.data.get("wallet_currency") or wallet.currency).upper()
        try:
            tx, context = ShippingFinanceService.reserve_cashout(
                user=user, wallet=wallet, amount=amount,
                payout_currency=payout_currency, recipient=agent,
                note=note, operation_key=request.headers.get("Idempotency-Key"),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        tx.recipient = agent
        tx.save(update_fields=["recipient"])

        Notification.objects.create(
            recipient=agent,
            title="Cashout request",
            message=f"User {user.full_name} requested cashout of {amount} {wallet.currency}.",
            icon=""
        )

        return Response(serialize_cashout(tx), status=status.HTTP_201_CREATED)


class AgentCashoutApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, transaction_id):
        agent = request.user
        if getattr(agent, "role", None) != "agent":
            return Response({"error": "Only agents can approve cashout"}, status=status.HTTP_403_FORBIDDEN)

        try:
            tx = Transaction.objects.select_related("wallet", "user", "recipient").get(
                id=transaction_id, transaction_type="cashout"
            )
            if tx.recipient_id != agent.id:
                return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
            tx, agent_tx, replayed = ShippingFinanceService.finalize_cashout(
                transaction_id=transaction_id, approver=agent,
            )
        except Exception as exc:
            return Response({"error": str(exc), "error_code": getattr(exc, "code", "CASHOUT_STATE_CONFLICT")}, status=status.HTTP_400_BAD_REQUEST)

        Notification.objects.create(
            recipient=tx.user,
            title="Cashout paid",
            message=f"Your cashout of {abs(tx.amount)} {tx.wallet.currency} has been paid.",
            icon=""
        )

        return Response(serialize_cashout(tx))


class AgentCashoutCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, transaction_id):
        user = request.user
        tx = Transaction.objects.select_related("wallet", "user", "recipient").get(
            id=transaction_id, transaction_type="cashout"
        )
        if user.id not in [tx.user_id, tx.recipient_id] and getattr(user, "role", None) != "admin":
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        try:
            tx, replayed = ShippingFinanceService.reject_cashout(
                transaction_id=transaction_id,
                reason="Cancelled by user" if user.id == tx.user_id else "Cancelled by agent",
            )
        except Exception as exc:
            return Response({"error": str(exc), "error_code": getattr(exc, "code", "CASHOUT_STATE_CONFLICT")}, status=status.HTTP_400_BAD_REQUEST)

        Notification.objects.create(
            recipient=tx.user,
            title="Cashout cancelled",
            message=f"Your cashout of {abs(tx.amount)} {tx.wallet.currency} was cancelled.",
            icon=""
        )

        return Response(serialize_cashout(tx))


# -------------------- Agent Users List View --------------------
class AgentUsersListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        agent_id = self.kwargs.get("agent_id") 

        if getattr(user, "role", None) == "admin":
            if agent_id:
                return User.objects.filter(agent_id=agent_id)
            return User.objects.filter(agent__isnull=False)

        elif getattr(user, "role", None) == "agent":
            return User.objects.filter(agent=user)

        return User.objects.none()

    def get_serializer_class(self):
        if getattr(self.request.user, "role", None) == "admin":
            return SubordinateUserSerializer
        if getattr(self.request.user, "role", None) == "agent":
            return SubordinateUserSerializer
        return UserSerializer
    

# --------------------------------------------------
# دوال تحويل العملات
# --------------------------------------------------
def convert_amount(amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
    source = str(from_currency).upper()
    target = str(to_currency).upper()
    if source == target:
        return Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    side = RateSide.PLATFORM_SELLS_BASE if source == "USD" else RateSide.PLATFORM_BUYS_BASE
    operation = "purchase_native_to_syp" if target == "SYP" else "purchase_native_to_usd"
    result = CurrencyConversionService.convert(
        amount=amount, source_currency=source, target_currency=target,
        rate_side=side, operation_type=operation,
    )
    return result.target_amount.quantize(Decimal("0.01"), rounding=ROUND_DOWN)

def get_agent_coverage_limit(agent_profile: AgentProfile, currency: str) -> Decimal:
    if currency == "SYP":
        return Decimal(str(getattr(agent_profile, "coverage_limit_syp", 0) or "0"))
    return Decimal(str(getattr(agent_profile, "coverage_limit_usd", 0) or "0"))


# --------------------------------------------------
# API: شراء (مستخدم → أو وكيل) - UPDATED FOR NEW PRODUCT MODEL
# --------------------------------------------------
class AgentPurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        agent = request.user
        if getattr(agent, "role", None) != "agent":
            return Response({"detail": "غير مصرح لك بالوصول."}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("user_id")
        product_id = request.data.get("product_id")
        currency = (request.data.get("currency") or "USD").upper()
        amount = request.data.get("amount")  # For amount-based products
        selected_option = request.data.get("selected_option")  # For customization-based products

        if not all([user_id, product_id, currency]):
            return Response({"detail": "الحقول مطلوبة."}, status=status.HTTP_400_BAD_REQUEST)

        # جلب البيانات الأساسية
        try:
            user = User.objects.get(id=user_id)
            product = Product.objects.get(id=product_id, is_active=True)
            agent_profile = AgentProfile.objects.get(user=agent)
        except User.DoesNotExist:
            return Response({"detail": "المستخدم غير موجود."}, status=status.HTTP_404_NOT_FOUND)
        except Product.DoesNotExist:
            return Response({"detail": "المنتج غير موجود."}, status=status.HTTP_404_NOT_FOUND)
        except AgentProfile.DoesNotExist:
            return Response({"detail": "ملف الوكيل غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        # Calculate price based on product type
        try:
            if product.product_type == "amount_based":
                if not amount:
                    return Response(
                        {"detail": "الكمية مطلوبة لمنتجات الكمية."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Convert amount to Decimal
                try:
                    amount_decimal = Decimal(str(amount))
                except:
                    return Response(
                        {"detail": "الكمية غير صالحة."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Calculate price
                calculated_price = product.calculate_price(amount=amount_decimal)
                
            elif product.product_type == "customization_based":
                if not selected_option:
                    return Response(
                        {"detail": "الخيار المختار مطلوب لمنتجات التخصيص."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Calculate price for selected option
                calculated_price = product.calculate_price(selected_option=selected_option)
                
            else:
                return Response(
                    {"detail": "نوع المنتج غير مدعوم."},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error calculating price: {str(e)}")
            return Response(
                {"detail": "خطأ في حساب السعر."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate user price (category + agent commission) and agent price (no agent commission)
        user_price_base = PricingPolicy.native_final_amount(
            calculated_price, user, include_agent_adjustment=True,
            product_profit_percentage=getattr(product, "product_profit_percentage", Decimal("0")),
            product=product,
        )[-1]
        agent_price_base = PricingPolicy.native_final_amount(
            calculated_price, user, include_agent_adjustment=False,
            product_profit_percentage=getattr(product, "product_profit_percentage", Decimal("0")),
            product=product,
        )[-1]

        # Convert price to requested currency if needed
        if currency != product.currency:
            try:
                user_price = convert_amount(user_price_base, product.currency, currency)
                agent_price = convert_amount(agent_price_base, product.currency, currency)
            except Exception as e:
                logger.error(f"Currency conversion error: {str(e)}")
                return Response(
                    {"detail": "خطأ في تحويل العملة."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            user_price = user_price_base
            agent_price = agent_price_base

        # محفظة المستخدم
        try:
            user_wallet = Wallet.objects.get(user=user, currency=currency)
        except Wallet.DoesNotExist:
            return Response({"success": False, "message": "محفظة المستخدم غير موجودة."}, status=status.HTTP_400_BAD_REQUEST)

        #  الدفع من رصيد المستخدم
        if user_wallet.balance >= user_price:
            return self._process_payment(user, user_wallet, product, user_price, currency, amount, selected_option)

        return Response(
            {"success": False, "message": "رصيد المستخدم غير كافٍ لإتمام الشراء."},
            status=status.HTTP_400_BAD_REQUEST
        )

    def _process_payment(self, user, user_wallet, product, amount, currency, quantity=None, selected_option=None):
        """معالجة الدفع من رصيد المستخدم"""
        note = f"شراء {product.name_en} من قبل {user.name}"
        
        with db_transaction.atomic():
            trx = FinanceService.withdraw(
                wallet_id=user_wallet.id,
                amount=amount,
                transaction_type="purchase",
                note=note,
                idempotency_key=f"agent-purchase:{user.id}:{product.id}:{amount}",
            )

            # Prepare data for API
            user_data = {
                "name": user.name,
                "email": getattr(user, 'email', ''),
                "phone": getattr(user, 'phone', '')
            }
            
            transaction_data = {
                "product": product.name_en,
                "product_type": product.product_type,
                "currency": currency,
                "amount": quantity if product.product_type == "amount_based" else None,
                "selected_option": selected_option if product.product_type == "customization_based" else None
            }

            api_result = APIService.process_payment_through_best_api(
                amount=float(amount),
                user_data=user_data,
                transaction_data=transaction_data
            )

        if api_result.get("success"):
            FinanceService.approve(trx.id)

            try:
                credit_agent_commission(
                    user=user,
                    amount=amount,
                    currency=currency,
                    source_tx=trx
                )
            except Exception:
                pass

            # إشعار النجاح
            Notification.objects.create(
                recipient=user,
                title="تمت عملية الشراء بنجاح ✅",
                message=f"تم شراء {product.name_en} بمبلغ {amount} {currency}",
                icon=""
            )

            return Response({
                "success": True, 
                "message": "تمت عملية الدفع بنجاح.",
                "transaction_id": trx.id,
                "amount": float(amount),
                "currency": currency
            }, status=status.HTTP_200_OK)
        else:
            # فشل الدفع من API
            FinanceService.reject(trx.id, reason="Rejected by agent")
            return Response({
                "success": False, 
                "message": f"فشل الدفع: {api_result.get('error')}"
            }, status=status.HTTP_400_BAD_REQUEST)


# --------------------------------------------------
# دالة تنفيذ الموافقة أو الرفض من الوكيل
# --------------------------------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_approve_payment_view(request, transaction_id):
    agent = request.user
    approve = request.data.get("approve", True)

    try:
        trx = Transaction.objects.get(id=transaction_id, transaction_type="purchase")
        agent_profile = AgentProfile.objects.get(user=agent)
    except Transaction.DoesNotExist:
        return Response({"success": False, "message": "الطلب غير موجود."})
    except AgentProfile.DoesNotExist:
        return Response({"success": False, "message": "ملف الوكيل غير موجود."})

    if trx.status != "pending":
        return Response({"success": False, "message": "الطلب ليس قيد الانتظار."})

    if str(agent.id) not in trx.note:
        return Response({"success": False, "message": "لا تملك صلاحية لهذا الطلب."})

    if not approve:
        trx.status = "rejected"
        trx.save()

        # إشعار رفض الدفع للمستخدم
        Notification.objects.create(
            recipient=trx.user,
            title="تم رفض الدفع ❌",
            message=f"تم رفض طلب شراء {trx.wallet} بمبلغ {trx.amount} {trx.wallet.currency} من قبل الوكيل {agent.name}.",
            icon=""
        )

        return Response({"success": False, "message": "تم رفض الطلب."})

    currency = trx.wallet.currency
    amount = trx.amount
    agent_wallet, _ = Wallet.objects.get_or_create(user=agent, currency=currency)

    coverage_limit = get_agent_coverage_limit(agent_profile, currency)
    available_credit = (agent_wallet.balance or Decimal("0")) + coverage_limit
    if available_credit < amount:
        return Response({"success": False, "message": "رصيد الوكيل غير كافٍ."})

    with db_transaction.atomic():
        agent_tx = FinanceService.withdraw(
            wallet_id=agent_wallet.id,
            amount=amount,
            transaction_type="purchase",
            note=f"Agent approval for purchase TX#{trx.id}",
            idempotency_key=f"agent-approve:{trx.id}",
            allow_overdraft=True,
            overdraft_limit=coverage_limit,
        )
        FinanceService.approve(agent_tx.id)
        FinanceService.approve(trx.id)

        # No commission when agent pays from their own wallet

        # إشعار النجاح بعد الموافقة
        Notification.objects.create(
            recipient=trx.user,
            title="تمت الموافقة على الدفع ✅",
            message=f"تمت الموافقة على طلب شراء {trx.wallet} بمبلغ {trx.amount} {trx.wallet.currency} من قبل الوكيل {agent.name}.",
            icon=""
        )

    return Response({"success": True, "message": "تمت الموافقة بنجاح واحتساب العمولة."})


# -------------------- ترقية المستخدم لوكيل --------------------
# agents/views.py - Updated promote_to_agent function
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def promote_to_agent(request, user_id):
    """Promote user to agent using RoleService"""
    try:
        user = get_object_or_404(User, id=user_id)
        
        # Use RoleService
        from users.services.role_service import RoleService
        promoted_user, changed = RoleService.promote_to_agent(user, request.user)
        
        if not changed:
            return Response({
                'message': f'{user.name} is already an agent.',
                'agent_code': user.agent_code
            }, status=status.HTTP_200_OK)
        
        # Send notification
        Notification.objects.create(
            recipient=user,
            title="تمت ترقيتك إلى وكيل ✅",
            message=f"تهانينا {user.name}! لقد تمت ترقيتك إلى وكيل. رمز وكيلك: {user.agent_code}",
            icon=""
        )
        
        return Response({
            'message': f'{user.name} تمت ترقيته إلى وكيل.',
            'agent_code': user.agent_code,
            'role_changed': True
        }, status=status.HTTP_200_OK)
        
    except ValidationError as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error promoting to agent: {str(e)}")
        return Response({
            'error': 'Failed to promote user to agent'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# -------------------- خفض الوكيل إلى مستخدم عادي --------------------
# agents/views.py - Updated demote_to_user function
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def demote_to_user(request, user_id):
    """Demote agent to regular user"""
    # Check if current user is admin
    if request.user.role != "admin":
        return Response({'error': 'ليس لديك صلاحية للقيام بهذه العملية'}, 
                       status=status.HTTP_403_FORBIDDEN)

    user = get_object_or_404(User, id=user_id)

    if user.role != "agent":
        return Response({'message': f'{user.name} ليس وكيلاً'}, 
                       status=status.HTTP_400_BAD_REQUEST)

    # Use RoleService
    from users.services.role_service import RoleService
    demoted_user, changed = RoleService.demote_to_user(user, request.user)
    
    if not changed:
        return Response({'message': f'{user.name} ليس وكيلاً'}, 
                       status=status.HTTP_400_BAD_REQUEST)

    # Delete AgentProfile
    from .models import AgentProfile
    AgentProfile.objects.filter(user=user).delete()

    # Send notification
    Notification.objects.create(
        recipient=user,
        title="تم تحويلك إلى مستخدم عادي ⚠️",
        message=f"مرحبًا {user.name}, لقد تم تحويلك من وكيل إلى مستخدم عادي.",
        icon=""
    )

    return Response({
        'message': f'تم تحويل {user.name} إلى مستخدم عادي',
        'role_changed': True
    }, status=status.HTTP_200_OK)
# ------------------ تحديد عمولة الوكيل ------------------
class AgentCommissionAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, agent_id):
        """عرض عمولة الوكيل"""
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        return Response({
            "agent_name": agent_profile.user.full_name,
            "commission_rate": agent_profile.commission_rate
        })

    def post(self, request, agent_id):
        """إضافة أو تعديل العمولة"""
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        percent = request.data.get('commission_rate')

        try:
            percent = Decimal(str(percent))
            if not percent.is_finite() or percent < 0 or percent >= 100:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'error': 'النسبة غير صالحة، يجب أن تكون بين 0 و 100'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_percent = agent_profile.commission_rate
        agent_profile.commission_rate = percent.quantize(Decimal('0.01'))
        agent_profile.save()
        AuditLogger.log(request, "update_agent_commission_rate", "agent_profile", agent_profile.id,
                        {"old_rate": str(old_percent), "new_rate": str(agent_profile.commission_rate)})

        #  إرسال إشعار للوكيل
        Notification.objects.create(
            recipient=agent_profile.user,
            title="تغيير نسبة العمولة",
            message=f"تم تحديث نسبة العمولة الخاصة بك إلى {agent_profile.commission_rate}%",
            icon=""
        )

        return Response({
            "message": f"تم تعيين العمولة للوكيل {agent_profile.user.full_name}",
            "commission_rate": agent_profile.commission_rate
        }, status=status.HTTP_200_OK)

    def patch(self, request, agent_id):
        """تعديل العمولة فقط"""
        return self.post(request, agent_id)

    def delete(self, request, agent_id):
        """حذف العمولة (إعادتها إلى 0)"""
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        agent_profile.commission_rate = 0
        agent_profile.save()
        return Response({
            "message": f"تم حذف العمولة للوكيل {agent_profile.user.full_name}"
        }, status=status.HTTP_200_OK)
    

# ------------------ إضافة / حذف / عرض التخصيصات ------------------
# ------------------ Agent credit limit ------------------
class AgentCreditLimitAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, agent_id):
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        return Response({
            "agent_name": agent_profile.user.full_name,
            "coverage_limit_usd": agent_profile.coverage_limit_usd,
            "coverage_limit_syp": agent_profile.coverage_limit_syp,
        })

    def post(self, request, agent_id):
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        limit_usd = request.data.get('coverage_limit_usd')
        limit_syp = request.data.get('coverage_limit_syp')

        if limit_usd is None and limit_syp is None:
            return Response(
                {"error": "coverage_limit_usd or coverage_limit_syp is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if limit_usd is not None:
                limit_usd_value = Decimal(str(limit_usd))
                if limit_usd_value < 0:
                    raise ValueError
                agent_profile.coverage_limit_usd = limit_usd_value
            if limit_syp is not None:
                limit_syp_value = Decimal(str(limit_syp))
                if limit_syp_value < 0:
                    raise ValueError
                agent_profile.coverage_limit_syp = limit_syp_value
        except (TypeError, ValueError):
            return Response(
                {"error": "Coverage limits must be valid numbers (>= 0)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        agent_profile.save()

        Notification.objects.create(
            recipient=agent_profile.user,
            title="Credit limit updated",
            message=(
                "Your credit limits are now "
                f"USD {agent_profile.coverage_limit_usd}, "
                f"SYP {agent_profile.coverage_limit_syp}"
            ),
            icon=""
        )

        return Response({
            "message": f"Credit limit updated for agent {agent_profile.user.full_name}",
            "coverage_limit_usd": agent_profile.coverage_limit_usd,
            "coverage_limit_syp": agent_profile.coverage_limit_syp,
        }, status=status.HTTP_200_OK)

    def patch(self, request, agent_id):
        return self.post(request, agent_id)

    def delete(self, request, agent_id):
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        agent_profile.coverage_limit_usd = Decimal('0')
        agent_profile.coverage_limit_syp = Decimal('0')
        agent_profile.save(update_fields=["coverage_limit_usd", "coverage_limit_syp"])
        return Response({
            "message": f"Credit limit reset for agent {agent_profile.user.full_name}"
        }, status=status.HTTP_200_OK)


# ------------------ Agent product assignments ------------------
class AgentProductAssignmentAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        """عرض جميع التخصيصات"""
        assignments = AgentProductAssignment.objects.all().order_by('-created_at')
        serializer = AgentProductAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    def post(self, request):
        if isinstance(request.data, dict) and 'assignments' in request.data:
            updates = request.data.get('assignments')
            if not isinstance(updates, list) or not updates:
                return Response({'error': 'assignments must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
            prepared = []
            for item in updates:
                assignment_id = item.get('id') if isinstance(item, dict) else None
                if not assignment_id:
                    return Response({'error': 'each assignment requires id'}, status=status.HTTP_400_BAD_REQUEST)
                assignment = get_object_or_404(AgentProductAssignment, id=assignment_id)
                serializer = AgentProductAssignmentSerializer(assignment, data=item, partial=True)
                serializer.is_valid(raise_exception=True)
                prepared.append(serializer)
            updated = []
            with db_transaction.atomic():
                for serializer in prepared:
                    assignment = serializer.save()
                    AuditLogger.log(request, 'bulk_update_agent_product_assignment',
                                    'agent_product_assignment', assignment.id)
                    updated.append(AgentProductAssignmentSerializer(assignment).data)
            return Response(updated, status=status.HTTP_200_OK)
        """إضافة تخصيص جديد"""
        agent_id = request.data.get('agent')
        product_id = request.data.get('product')
        commission_percent = request.data.get('commission_percent')

        if agent_id is None or product_id is None or commission_percent is None:
            return Response({"error": "جميع الحقول مطلوبة"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            agent = User.objects.get(id=agent_id, role='agent')
        except User.DoesNotExist:
            return Response({"error": "الوكيل غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"error": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        try:
            commission_percent = Decimal(str(commission_percent))
            if not commission_percent.is_finite() or commission_percent < 0 or commission_percent >= 100:
                raise ValueError
        except (TypeError, ValueError, ArithmeticError):
            return Response({"error": "النسبة يجب أن تكون بين 0 و 100"}, status=status.HTTP_400_BAD_REQUEST)

        existing = AgentProductAssignment.objects.filter(agent=agent, product=product).first()
        raw_active = request.data.get('is_active', True)
        is_active = raw_active.strip().lower() not in {'false', '0', 'no', 'off'} if isinstance(raw_active, str) else bool(raw_active)
        assignment, created = AgentProductAssignment.objects.update_or_create(
            agent=agent, product=product,
            defaults={'commission_percent': commission_percent.quantize(Decimal('0.01')), 'is_active': bool(is_active)}
        )
        AuditLogger.log(request, "create_agent_product_assignment" if created else "update_agent_product_assignment",
                        "agent_product_assignment", assignment.id, {
                            "agent_id": agent.id, "product_id": product.id,
                            "old_rate": None if not existing else str(existing.commission_percent),
                            "new_rate": str(assignment.commission_percent), "is_active": assignment.is_active,
                        })

        Notification.objects.create(
            recipient=agent,
            title="تخصيص منتج جديد",
            message=f"تم {'إضافة' if created else 'تعديل'} تخصيص المنتج {product.name_en} بالنسبة {commission_percent}%",
            icon=""
        )

        serializer = AgentProductAssignmentSerializer(assignment)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def patch(self, request, assignment_id=None):
        assignment = get_object_or_404(AgentProductAssignment, id=assignment_id)
        serializer = AgentProductAssignmentSerializer(assignment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save()
        AuditLogger.log(request, "update_agent_product_assignment", "agent_product_assignment", assignment.id)
        return Response(AgentProductAssignmentSerializer(assignment).data)

    def delete(self, request, assignment_id=None):
        """حذف تخصيص"""
        if not assignment_id:
            return Response({"error": "يجب تحديد ID التخصيص"}, status=status.HTTP_400_BAD_REQUEST)

        assignment = get_object_or_404(AgentProductAssignment, id=assignment_id)
        assignment.is_active = False
        assignment.save(update_fields=['is_active'])
        AuditLogger.log(request, "deactivate_agent_product_assignment", "agent_product_assignment", assignment.id)
        return Response({"message": "تم حذف التخصيص بنجاح"}, status=status.HTTP_200_OK)
    
    
# ------------------ إضافة / حذف / عرض منطقة للوكيل ------------------
class AgentRegionAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        """عرض جميع الوكلاء اللي عندهم منطقة فقط"""
        agents = AgentProfile.objects.exclude(region__isnull=True).exclude(region__exact="")
        serializer = AgentProfileRegionSerializer(agents, many=True)
        return Response(serializer.data)

    def post(self, request):
        """إضافة أو تعديل المنطقة لوكيل محدد"""
        agent_id = request.data.get('agent_id')
        region = request.data.get('region')

        if not agent_id or not region:
            return Response({"error": "agent_id و region مطلوبين"}, status=status.HTTP_400_BAD_REQUEST)

        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        agent_profile.region = region
        agent_profile.save()

        serializer = AgentProfileRegionSerializer(agent_profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, agent_id=None):
        """تعديل المنطقة لوكيل محدد"""
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        region = request.data.get('region')

        if region is not None:
            agent_profile.region = region
            agent_profile.save()

        serializer = AgentProfileRegionSerializer(agent_profile)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, agent_id=None):
        """حذف المنطقة لوكيل محدد"""
        agent_profile = get_object_or_404(AgentProfile, user__id=agent_id)
        agent_profile.region = None
        agent_profile.save()
        return Response({"message": f"تم حذف المنطقة للوكيل {agent_profile.user.full_name}"}, status=status.HTTP_200_OK)
