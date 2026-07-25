from decimal import Decimal
from django.db.models import Sum, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from django.core.cache import cache
from .models import ExchangeRate, Wallet
from .serializers import ExchangeRateSerializer
from transactions.models import Transaction
import logging

logger = logging.getLogger(__name__)

class WalletService:
    """Service class to handle wallet operations"""
    
    @staticmethod
    def get_wallet_balances(user=None):
        """
        Get wallet balances for specific user or all users
        Uses cache for better performance
        """
        cache_key = f"wallet_balances_{user.id if user else 'all'}"
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return cached_data
        
        try:
            # Get or create wallets for user
            if user and user.role != "admin":
                # Ensure user has both currency wallets
                usd_wallet, _ = Wallet.objects.get_or_create(user=user, currency="USD")
                syp_wallet, _ = Wallet.objects.get_or_create(user=user, currency="SYP")
                
                # Update balances from transactions
                usd_wallet.update_balances()
                syp_wallet.update_balances()
                
                wallets = Wallet.objects.filter(user=user)
            else:
                # Admin view - all users balances
                wallets = Wallet.objects.all()
            
            # Aggregate balances
            balances = {"USD": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")},
                       "SYP": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")}}
            
            for wallet in wallets:
                if wallet.currency in balances:
                    balances[wallet.currency]["available"] += wallet.available_balance
                    balances[wallet.currency]["pending"] += wallet.pending_balance
                    balances[wallet.currency]["total"] += wallet.total_balance
            
            # Cache for 30 seconds
            cache.set(cache_key, balances, 30)
            return balances
            
        except Exception as e:
            logger.error(f"Error getting wallet balances: {str(e)}")
            return {"USD": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")},
                    "SYP": {"available": Decimal("0"), "pending": Decimal("0"), "total": Decimal("0")}}

    @staticmethod
    def get_exchange_rates():
        """Get current exchange rates with caching"""
        cache_key = "exchange_rates"
        cached_rates = cache.get(cache_key)
        
        if cached_rates:
            return cached_rates
        
        try:
            rates = ExchangeRate.objects.order_by('-updated_at')[:2]
            if not rates:
                return {
                    "usd_to_syp": {"value": Decimal("13000"), "change": 0},
                    "syp_to_usd": {"value": Decimal("0.000077"), "change": 0}
                }

            current = rates[0]
            previous = rates[1] if len(rates) > 1 else current

            def calculate_change(current_val, prev_val):
                if prev_val == 0:
                    return 0
                change = ((current_val - prev_val) / prev_val) * 100
                return round(float(change), 2)

            usd_change = calculate_change(current.usd_to_syp, previous.usd_to_syp)
            syp_change = calculate_change(current.syp_to_usd, previous.syp_to_usd)

            rates_data = {
                "usd_to_syp": {"value": current.usd_to_syp, "change": usd_change},
                "syp_to_usd": {"value": current.syp_to_usd, "change": syp_change},
            }
            
            cache.set(cache_key, rates_data, 60)  # Cache for 1 minute
            return rates_data
            
        except Exception as e:
            logger.error(f"Error getting exchange rates: {str(e)}")
            return {
                "usd_to_syp": {"value": Decimal("13000"), "change": 0},
                "syp_to_usd": {"value": Decimal("0.000077"), "change": 0}
            }


class WalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            balances = WalletService.get_wallet_balances(user)
            rates = WalletService.get_exchange_rates()
            
            usd_rate = rates["usd_to_syp"]
            syp_rate = rates["syp_to_usd"]

            # Calculate converted totals
            total_usd = balances["USD"]["total"] + (balances["SYP"]["total"] * syp_rate["value"])
            total_syp = balances["SYP"]["total"] + (balances["USD"]["total"] * usd_rate["value"])

            # Return raw numbers for frontend to format
            data = {
                "USD": {
                    "symbol": "$",
                    "available": float(balances["USD"]["available"]),
                    "pending": float(balances["USD"]["pending"]),
                    "total": float(balances["USD"]["total"]),
                    "rate_to_syp": float(usd_rate["value"])
                },
                "SYP": {
                    "symbol": "ل.س",
                    "available": float(balances["SYP"]["available"]),
                    "pending": float(balances["SYP"]["pending"]),
                    "total": float(balances["SYP"]["total"]),
                    "rate_to_usd": float(syp_rate["value"])
                },
                "exchange_rates": {
                    "usd_to_syp": {
                        "value": float(usd_rate["value"]),
                        "change": usd_rate["change"]
                    },
                    "syp_to_usd": {
                        "value": float(syp_rate["value"]),
                        "change": syp_rate["change"]
                    }
                },
                "totals": {
                    "usd": float(total_usd),
                    "syp": float(total_syp),
                },
            }

            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Wallet view error: {str(e)}")
            return Response(
                {"error": "حدث خطأ في جلب بيانات المحفظة"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExchangeRateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            rate = ExchangeRate.objects.last()
            if not rate:
                # Create default rate if none exists
                rate = ExchangeRate.objects.create(usd_to_syp=Decimal("13000"))
            
            serializer = ExchangeRateSerializer(rate)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Exchange rate get error: {str(e)}")
            return Response(
                {"error": "حدث خطأ في جلب سعر الصرف"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request):
        try:
            if request.user.role != "admin":
                return Response(
                    {"detail": "ليس لديك صلاحية لتعديل سعر الصرف"}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            rate = ExchangeRate.objects.last()
            if not rate:
                rate = ExchangeRate.objects.create(usd_to_syp=Decimal("13000"))
            
            serializer = ExchangeRateSerializer(rate, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                # Clear cache
                cache.delete("exchange_rates")
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Exchange rate update error: {str(e)}")
            return Response(
                {"error": "حدث خطأ في تحديث سعر الصرف"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def change_user_currency(request):
    """Change user's preferred currency"""
    try:
        new_currency = request.data.get("currency")
        
        if new_currency not in ["USD", "SYP"]:
            return Response(
                {"error": "عملة غير مدعومة. الرجاء اختيار USD أو SYP"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        user.currency_preference = new_currency
        user.save()
        
        # Clear user-specific cache
        cache.delete(f"wallet_balances_{user.id}")

        return Response({
            "message": f"تم تغيير العملة الأساسية إلى {new_currency}",
            "currency_preference": new_currency
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Currency change error: {str(e)}")
        return Response(
            {"error": "حدث خطأ في تغيير العملة"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )