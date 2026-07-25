from django.db import transaction as db_transaction
from wallets.models import Wallet
from transactions.models import Transaction
from third_party_apis.models import ThirdPartyAPI
from third_party_apis.services.api_service import APIService

class PurchaseService:
    @staticmethod
    def make_purchase(user, product, amount, currency, extra_payload=None):
        """
        Execute a purchase for a user, deducting balance and calling external API.
        Handles insufficient balance, empty API responses, and API failures.
        """
        with db_transaction.atomic():
            try:
                # نجيب محفظة اليوزر
                wallet = Wallet.objects.get(user=user, currency=currency)
            except Wallet.DoesNotExist:
                return {"success": False, "error": "Wallet not found"}

            if wallet.balance < amount:
                return {"success": False, "error": "Insufficient balance"}

            # نعمل transaction داخلية
            trx = Transaction.objects.create(
                user=user,
                wallet=wallet,
                transaction_type="purchase",
                amount=amount,
                status="pending",
                note=f"Purchase {getattr(product, 'name', 'Unknown Product')}",
            )

            # نخصم الرصيد مؤقتاً
            wallet.balance -= amount
            wallet.save()

            # نجيب API الفعال حسب provider
            api_config = ThirdPartyAPI.objects.filter(is_active=True).order_by("priority").first()
            if not api_config:
                trx.status = "rejected"
                trx.save()
                wallet.balance += amount
                wallet.save()
                return {"success": False, "error": "No active API provider"}

            # استدعاء API خارجي مع التعامل مع الأخطاء
            try:
                raw_response = APIService.process_payment(
                    api_id=api_config.id,
                    amount=float(amount),
                    user_data={"name": getattr(user, "name", "")},
                    transaction_data={
                        "product": getattr(product, "name", "Unknown Product"),
                        "currency": currency,
                        **(extra_payload or {})
                    }
                )
            except ValueError as ve:
                # يحدث عند محاولة فك JSON من فارغ
                trx.status = "rejected"
                trx.save()
                wallet.balance += amount
                wallet.save()
                return {"success": False, "error": f"API returned invalid response: {ve}"}
            except Exception as e:
                trx.status = "rejected"
                trx.save()
                wallet.balance += amount
                wallet.save()
                return {"success": False, "error": f"API call failed: {str(e)}"}

            # تحقق من الاستجابة قبل استخدام البيانات
            if not raw_response or not isinstance(raw_response, dict):
                trx.status = "rejected"
                trx.save()
                wallet.balance += amount
                wallet.save()
                return {"success": False, "error": "API response empty or not JSON"}

            # تحديث حالة الـ transaction بناءً على استجابة API
            if raw_response.get("success"):
                trx.status = "approved"
                trx.save()
                return {"success": True, "transaction_id": trx.id}
            else:
                trx.status = "rejected"
                trx.save()
                wallet.balance += amount
                wallet.save()
                return {"success": False, "error": raw_response.get("error", "Unknown API error")}