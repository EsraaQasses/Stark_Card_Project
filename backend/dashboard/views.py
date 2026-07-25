from rest_framework import generics, permissions
from users.models import User
from wallets.models import Wallet
from transactions.models import Transaction
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
    queryset = Transaction.objects.all().order_by("-created_at")
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardWalletListView(generics.ListAPIView):
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardSectionListCreateView(generics.ListCreateAPIView):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [permissions.IsAdminUser]

class DashboardPaymentMethodListCreateView(generics.ListCreateAPIView):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [permissions.IsAdminUser]
