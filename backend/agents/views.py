from decimal import Decimal, ROUND_DOWN, getcontext
from django.db import transaction as db_transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from django.db.models import Sum
from system.models import Notification
from users.utils import generate_agent_code
from .models import AgentProductAssignment, User
from users.permissions import IsAdminUser  
from wallets.models import Wallet, ExchangeRate
from transactions.models import Transaction
from store.models import Product, PackagePrice
from third_party_apis.services.api_service import APIService
from .models import AgentProfile
from .serializers import AgentProductAssignmentSerializer, AgentProfileRegionSerializer, AgentProfileSerializer
from users.serializers import SubordinateUserSerializer, UserSerializer

User = get_user_model()
getcontext().prec = 28

# ------------------ Agent List ------------------
class AgentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        print("=== AgentListView Debug ===")
        
        # Ensure all agent users have AgentProfile objects
        agent_users = User.objects.filter(role='agent')
        print(f"Found {agent_users.count()} users with agent role")
        
        for user in agent_users:
            AgentProfile.objects.get_or_create(user=user)
        
        agent_profiles = AgentProfile.objects.select_related('user').all()
        print(f"Found {agent_profiles.count()} agent profiles")
        
        data = []

        for agent_profile in agent_profiles:
            agent_user = agent_profile.user
            print(f"Processing agent: {agent_user.name}")

            # 1. Username and full name
            username = agent_user.name
            full_name = agent_user.full_name or agent_user.name

            # 2. Number of clients (subordinates)
            clients_count = agent_user.subordinates.count()

            # 3. Wallet balance - use total_balance property
            wallets = Wallet.objects.filter(user=agent_user)
            total_balance = sum(float(wallet.total_balance) for wallet in wallets) if wallets else 0.0

            # 4. Commission rate from AgentProfile
            commission_rate = float(agent_profile.commission_rate or 0)

            # 5. Number of assigned products
            products_count = AgentProductAssignment.objects.filter(agent=agent_user).count()

            data.append({
                "id": agent_user.id,
                "username": username,
                "full_name": full_name,
                "clients_count": clients_count,
                "balance": total_balance,
                "commission_rate": commission_rate,
                "products_count": products_count
            })

        print(f"Returning {len(data)} agents")
        return Response(data)
    
# -------------------- Agent Users List View --------------------
class AgentUsersListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

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
        return UserSerializer
    

# --------------------------------------------------
# دوال تحويل العملات
# --------------------------------------------------
def get_rate(from_currency: str, to_currency: str) -> Decimal:
    if from_currency == to_currency:
        return Decimal("1")
    rate = ExchangeRate.objects.last()
    if not rate:
        return Decimal("1")
    if from_currency == "USD" and to_currency == "SYP":
        return rate.usd_to_syp
    elif from_currency == "SYP" and to_currency == "USD":
        return rate.syp_to_usd
    return Decimal("1")

def convert_amount(amount: Decimal, from_currency: str, to_currency: str) -> Decimal:
    rate = get_rate(from_currency, to_currency)
    return (amount * rate).quantize(Decimal("0.01"), rounding=ROUND_DOWN)


# --------------------------------------------------
# API: شراء (مستخدم → أو وكيل)
# --------------------------------------------------
class AgentPurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        agent = request.user
        if getattr(agent, "role", None) != "agent":
            return Response({"detail": "غير مصرح لك بالوصول."}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("user_id")
        product_id = request.data.get("product_id")
        package_price_id = request.data.get("package_price_id")
        currency = request.data.get("currency")

        if not all([user_id, product_id, package_price_id, currency]):
            return Response({"detail": "الحقول مطلوبة."}, status=status.HTTP_400_BAD_REQUEST)

        # جلب البيانات الأساسية
        try:
            user = User.objects.get(id=user_id)
            product = Product.objects.get(id=product_id)
            package_price = PackagePrice.objects.get(id=package_price_id, currency=currency)
            agent_profile = AgentProfile.objects.get(user=agent)
        except User.DoesNotExist:
            return Response({"detail": "المستخدم غير موجود."}, status=status.HTTP_404_NOT_FOUND)
        except Product.DoesNotExist:
            return Response({"detail": "المنتج غير موجود."}, status=status.HTTP_404_NOT_FOUND)
        except PackagePrice.DoesNotExist:
            return Response({"detail": "الحزمة غير موجودة لهذه العملة."}, status=status.HTTP_404_NOT_FOUND)
        except AgentProfile.DoesNotExist:
            return Response({"detail": "ملف الوكيل غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        amount = package_price.amount

        # محفظة المستخدم
        try:
            user_wallet = Wallet.objects.get(user=user, currency=currency)
        except Wallet.DoesNotExist:
            return Response({"success": False, "message": "محفظة المستخدم غير موجودة."}, status=status.HTTP_400_BAD_REQUEST)

        #  الدفع من رصيد المستخدم
        if user_wallet.balance >= amount:
            return self._process_payment(user, user_wallet, product, amount, currency)

        #  الدفع من رصيد الوكيل
        if getattr(user, "agent_id", None) != agent.id:
            return Response({"success": False, "message": "هذا المستخدم ليس تابعًا لك."}, status=status.HTTP_403_FORBIDDEN)

        agent_wallet, _ = Wallet.objects.get_or_create(user=agent, currency=currency)
        coverage_limit = Decimal(str(getattr(agent_profile, "coverage_limit", 0) or "0"))
        available_credit = (agent_wallet.balance or Decimal("0")) + coverage_limit

        if available_credit < amount:
            return Response({"success": False, "message": "رصيد الوكيل غير كافٍ."}, status=status.HTTP_400_BAD_REQUEST)

        note = f"شراء {product.name} من قبل {user.name} عبر الوكيل {agent.name}"

        with db_transaction.atomic():
            trx = Transaction.objects.create(
                user=user,
                wallet=user_wallet,
                transaction_type="purchase",
                amount=amount,
                status="pending",
                note=note

)

            # خصم المبلغ مؤقتاً من الوكيل
            agent_wallet.balance -= amount
            agent_wallet.save()

            api_result = APIService.process_payment_through_best_api(
                amount=float(amount),
                user_data={"name": user.name},
                transaction_data={"product": product.name, "currency": currency}
            )

        if api_result.get("success"):
            trx.status = "approved"
            trx.save()

    # حساب العمولة على AgentProfile
            commission_percent = agent_profile.commission_rate or Decimal("0")
            if commission_percent > 0:
                commission_amount = (amount * commission_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
                agent_wallet.balance += commission_amount
                agent_wallet.save()

        # تحديث أرباح الوكيل
                agent_profile.total_earnings += commission_amount
                agent_profile.save()

                Transaction.objects.create(
                  user=agent,
                  wallet=agent_wallet,
                  transaction_type="deposit",
                  amount=commission_amount,
                  status="approved",
                  note=f"عمولة عن طلب {trx.id} ({commission_percent}%)"
        )

    # إشعار النجاح بعد كل العمليات
            Notification.objects.create(
                recipient=user,
                title="تمت عملية الشراء بنجاح ✅",
                message=f"تم شراء {product.name} بمبلغ {amount} {currency}",
                icon=""
    )

            return Response({"success": True, "message": "تمت عملية الدفع بنجاح."}, status=status.HTTP_200_OK)

        else:
    #  فشل الدفع من API
            trx.status = "rejected"
            trx.save()
            agent_wallet.balance += amount  # استرجاع الرصيد
            agent_wallet.save()
            return Response({"success": False, "message": f"فشل الدفع: {api_result.get('error')}"}, status=status.HTTP_400_BAD_REQUEST)

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

    coverage_limit = Decimal(str(getattr(agent_profile, "coverage_limit", 0) or "0"))
    available_credit = (agent_wallet.balance or Decimal("0")) + coverage_limit
    if available_credit < amount:
        return Response({"success": False, "message": "رصيد الوكيل غير كافٍ."})

    with db_transaction.atomic():
        agent_wallet.balance -= amount
        agent_wallet.save()
        trx.status = "approved"
        trx.save()

        commission_percent = agent_profile.commission_rate or Decimal("0")
        if commission_percent > 0:
            commission_amount = (amount * commission_percent / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
            agent_wallet.balance += commission_amount
            agent_wallet.save()

            agent_profile.total_earnings += commission_amount
            agent_profile.save()

            Transaction.objects.create(
                user=agent,
                wallet=agent_wallet,
                transaction_type="deposit",
                amount=commission_amount,
                status="approved",
                note=f"عمولة عن طلب {trx.id} ({commission_percent}%)"
            )

        # إشعار النجاح بعد الموافقة
        Notification.objects.create(
            recipient=trx.user,
            title="تمت الموافقة على الدفع ✅",
            message=f"تمت الموافقة على طلب شراء {trx.wallet} بمبلغ {trx.amount} {trx.wallet.currency} من قبل الوكيل {agent.name}.",
            icon=""
        )

    return Response({"success": True, "message": "تمت الموافقة بنجاح واحتساب العمولة."})
# -------------------- ترقية المستخدم لوكيل --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def promote_to_agent(request, user_id):
    user = get_object_or_404(User, id=user_id)

    # ✅ منع ترقية الأدمن لوكيل
    if user.role == "admin":
        return Response(
            {'message': f'لا يمكن ترقية المستخدم {user.name} لأنه أدمن.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if user.role == "agent":
        return Response(
            {'message': f'{user.name} هو بالفعل وكيل.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user.role = "agent"
    user.agent_code = generate_agent_code()
    user.save()

    agent_profile, created = AgentProfile.objects.get_or_create(user=user)
    agent_profile.commission_rate = 0.00
    agent_profile.total_earnings = 0.00
    agent_profile.save()

    Notification.objects.create(
        recipient=user,
        title="تمت ترقيتك إلى وكيل ✅",
        message=f"تهانينا {user.name}! لقد تمت ترقيتك إلى وكيل. رمز وكيلك: {user.agent_code}",
        icon=""
    )

    return Response({
        'message': f'{user.name} تمت ترقيته إلى وكيل.',
        'agent_code': user.agent_code
    }, status=status.HTTP_200_OK)

# -------------------- خفض الوكيل إلى مستخدم عادي --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def demote_to_user(request, user_id):
    #  تحقق من أن المستخدم الحالي دوره "admin"
    if request.user.role != "admin":
        return Response({'error': 'ليس لديك صلاحية للقيام بهذه العملية'}, status=status.HTTP_403_FORBIDDEN)

    user = get_object_or_404(User, id=user_id)

    if user.role != "agent":
        return Response({'message': f'{user.name} ليس وكيلاً'}, status=status.HTTP_400_BAD_REQUEST)

    #  تعديل الدور
    user.role = "user"
    user.agent_code = None
    user.save()

    #  حذف AgentProfile الخاص بالمستخدم
    AgentProfile.objects.filter(user=user).delete()

    Notification.objects.create(
        recipient=user,
        title="تم تحويلك إلى مستخدم عادي ⚠️",
        message=f"مرحبًا {user.name}, لقد تم تحويلك من وكيل إلى مستخدم عادي.",
        icon=""
    )

    return Response({
        'message': f'تم تحويل {user.name} إلى مستخدم عادي'
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
            percent = float(percent)
            if percent < 0 or percent > 100:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {'error': 'النسبة غير صالحة، يجب أن تكون بين 0 و 100'},
                status=status.HTTP_400_BAD_REQUEST
            )

        agent_profile.commission_rate = percent
        agent_profile.save()

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
class AgentProductAssignmentAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        """عرض جميع التخصيصات"""
        assignments = AgentProductAssignment.objects.all().order_by('-created_at')
        serializer = AgentProductAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    def post(self, request):
        """إضافة تخصيص جديد"""
        agent_id = request.data.get('agent')
        product_id = request.data.get('product')
        commission_percent = request.data.get('commission_percent')

        if not all([agent_id, product_id, commission_percent]):
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
            commission_percent = float(commission_percent)
            if commission_percent < 0 or commission_percent > 100:
                raise ValueError
        except ValueError:
            return Response({"error": "النسبة يجب أن تكون بين 0 و 100"}, status=status.HTTP_400_BAD_REQUEST)

        assignment, created = AgentProductAssignment.objects.update_or_create(
            agent=agent, product=product,
            defaults={'commission_percent': commission_percent}
        )

        Notification.objects.create(
            recipient=agent,
            title="تخصيص منتج جديد",
            message=f"تم {'إضافة' if created else 'تعديل'} تخصيص المنتج {product.name} بالنسبة {commission_percent}%",
            icon=""
)

        serializer = AgentProductAssignmentSerializer(assignment)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, assignment_id=None):
        """حذف تخصيص"""
        if not assignment_id:
            return Response({"error": "يجب تحديد ID التخصيص"}, status=status.HTTP_400_BAD_REQUEST)

        assignment = get_object_or_404(AgentProductAssignment, id=assignment_id)
        assignment.delete()
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