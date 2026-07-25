from django.db import transaction as db_transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions

from system.models import Notification
from .models import Transaction
from .serializers import TransactionSerializer, CreateTransactionSerializer
from agents import models


class ApproveTransactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        transaction_obj = Transaction.objects.get(pk=pk)

        # فقط الأدمن يقدر يوافق
        if request.user.role != "admin":
            return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

        if transaction_obj.status != "pending":
            return Response({"detail": "Already processed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("action")
        if action not in ["approve", "reject"]:
            return Response({"detail": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with db_transaction.atomic():
                if action == "reject":
                    transaction_obj.status = "rejected"
                    transaction_obj.save()
                    return Response({"status": transaction_obj.status})

                # approve
                if transaction_obj.transaction_type == "deposit":
                    transaction_obj.wallet.balance += transaction_obj.amount
                    transaction_obj.wallet.save()

                elif transaction_obj.transaction_type == "transfer":
                    sender_wallet = transaction_obj.wallet
                    recipient_wallet = transaction_obj.recipient_wallet

                    if not recipient_wallet:
                        return Response({"detail": "Recipient wallet not defined"}, status=status.HTTP_400_BAD_REQUEST)

                    if sender_wallet.balance < transaction_obj.amount:
                        return Response({"detail": "Insufficient funds"}, status=status.HTTP_400_BAD_REQUEST)

                    sender_wallet.balance -= transaction_obj.amount
                    recipient_wallet.balance += transaction_obj.amount
                    sender_wallet.save()
                    recipient_wallet.save()

                # الملاحظة: عمليات الشراء (purchase) لا تحتاج موافقة admin
                transaction_obj.status = "approved"
                transaction_obj.save()

                Notification.objects.create(
                    recipient=transaction_obj.user,
                    title="تمت الموافقة على معاملتك",
                    message=f"تمت الموافقة على معاملتك بقيمة {transaction_obj.amount} {transaction_obj.wallet.currency}.",
                    icon="check_circle"
)

                return Response({"status": transaction_obj.status})

        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateTransactionSerializer
        return TransactionSerializer

    def perform_create(self, serializer):
        user = self.request.user
        
        # Auto-assign agent if user has one
        if hasattr(user, 'agent'):
            serializer.save(user=user, agent=user.agent)
        else:
            serializer.save(user=user)

    def get_queryset(self):
        user = self.request.user

        if user.role == "admin":
            # الادمن يشوف كل العمليات
            return Transaction.objects.all()

        elif user.role == "agent":
            # الوكيل يشوف عملياته + عمليات اليوزرات التابعة له
            users_under_agent = getattr(user, "subordinates", models.User.objects.none()).all()
            return Transaction.objects.filter(
                models.Q(user=user) | models.Q(user__in=users_under_agent)
            )

        else:
            # المستخدم العادي يشوف بس عملياته
            return Transaction.objects.filter(user=user)