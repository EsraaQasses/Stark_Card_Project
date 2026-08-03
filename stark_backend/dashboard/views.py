from rest_framework import generics, permissions
from users.models import User
from wallets.models import Wallet
from transactions.models import Transaction
from django.db.models import Count, Prefetch, Q
from store.models import Section, Product
from payment_methods.models import PaymentMethod
from .serializers import (
    DashboardUserSerializer, WalletSerializer, TransactionSerializer,
    SectionSerializer, PaymentMethodSerializer
)

class DashboardUserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = DashboardUserSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardTransactionListView(generics.ListAPIView):
    queryset = Transaction.objects.select_related(
        "user", "wallet", "related_transaction", "payment", "recipient", "recipient_wallet"
    ).order_by("-created_at", "-id")
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardWalletListView(generics.ListAPIView):
    queryset = Wallet.objects.select_related("user").order_by("user_id", "currency")
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardSectionListCreateView(generics.ListCreateAPIView):
    queryset = Section.objects.select_related("father_section").prefetch_related(
        Prefetch(
            "subsections",
            queryset=Section.objects.filter(is_active=True).order_by("name_en"),
            to_attr="active_subsections",
        )
    ).annotate(
        active_products_count_optimized=Count(
            "products", filter=Q(products__is_active=True), distinct=True
        ),
        active_store_products_count_optimized=Count(
            "store_products", filter=Q(store_products__is_active=True), distinct=True
        ),
    )
    serializer_class = SectionSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardPaymentMethodListCreateView(generics.ListCreateAPIView):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAdminUser]
