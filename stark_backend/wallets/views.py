# wallets/views.py - OPTIMIZED FIXED VERSION (~350 lines)
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from django.core.cache import cache
import logging
from users.models import User
from .models import ExchangeRate, ExchangeRateQuote, Wallet
from .serializers import ExchangeRateQuoteActivationSerializer, ExchangeRateQuoteSerializer, ExchangeRateSerializer
from .services import WalletService, ExchangeService
from .display import wallet_equivalents
from .permissions import CanManageExchangeRates, IsAdminUser
from .rate_quotes import ExchangeRateQuoteError, ExchangeRateQuoteService, QuoteConflict, SpreadNotEnabled
from transactions.models import Transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema
from finance.precision import quantize_rate

logger = logging.getLogger(__name__)


class WalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get wallet information for authenticated user"""
        try:
            user = request.user
            wallet_data = WalletService.get_wallet_data(user)
            rates = ExchangeService.get_exchange_rates(display_only=True)

            # Get 5 recent transactions
            recent_transactions = Transaction.objects.filter(
                user=user
            ).select_related('wallet').order_by('-created_at')[:5]

            transactions_data = []
            for tx in recent_transactions:
                transactions_data.append({
                    'id': tx.id,
                    'type': tx.transaction_type,
                    'amount': float(tx.amount),
                    'status': tx.status,
                    'note': tx.note[:100] if tx.note else '',
                    'created_at': tx.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                })

            # Return clean, essential data
            usd_wallet = Wallet.objects.filter(user=user, currency="USD").first()
            syp_wallet = Wallet.objects.filter(user=user, currency="SYP").first()
            usd_rate = rates["usd_to_syp"]
            syp_rate = rates["syp_to_usd"]
            data = {
                "USD": {
                    "symbol": "$",
                    "available": float(wallet_data["USD"]["available"]),
                    "pending": float(wallet_data["USD"]["pending"]),
                    "total": float(wallet_data["USD"]["total"]),
                    "rate_to_syp": None if usd_rate["value"] is None else str(usd_rate["value"]),
                    "display_conversion": wallet_data["equivalents"]["USD"],
                },
                "SYP": {
                    "symbol": "SYP",
                    "available": float(wallet_data["SYP"]["available"]),
                    "pending": float(wallet_data["SYP"]["pending"]),
                    "total": float(wallet_data["SYP"]["total"]),
                    "rate_to_usd": None if syp_rate["value"] is None else str(syp_rate["value"]),
                    "display_conversion": wallet_data["equivalents"]["SYP"],
                },
                "wallet_ids": {
                    "usd": usd_wallet.id if usd_wallet else None,
                    "syp": syp_wallet.id if syp_wallet else None,
                    "is_local": False,
                },
                "exchange_rates": {
                    "usd_to_syp": {
                        "value": None if usd_rate["value"] is None else str(usd_rate["value"]),
                        "change": usd_rate["change"]
                    },
                    "syp_to_usd": {
                        "value": None if syp_rate["value"] is None else str(syp_rate["value"]),
                        "change": syp_rate["change"]
                    },
                    "rate_available": rates["rate_available"],
                    "quote_id": rates["quote_id"],
                    "quote_version": rates["version"],
                    "error_code": None if rates["rate_available"] else "FX_RATE_UNAVAILABLE",
                },
                "recent_transactions": transactions_data,
                "currency_preference": user.currency_preference
            }

            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Wallet view error: {str(e)}")
            return Response(
                {"error": "Failed to load wallet data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExchangeRateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current exchange rate"""
        try:
            active_quote = ExchangeRateQuoteService.get_active_quote()
            if active_quote:
                payload = ExchangeRateQuoteService.serialize(active_quote)
                payload.update({
                    "rate_available": True,
                    "usd_to_syp": str(active_quote.platform_buy_base_rate),
                    "syp_to_usd": str(quantize_rate(ExchangeService.get_exchange_rates(display_only=True)["syp_to_usd"]["value"])),
                })
                return Response(payload, status=status.HTTP_200_OK)
            return Response({
                "rate_available": False,
                "quote_id": None,
                "version": None,
                "usd_to_syp": None,
                "syp_to_usd": None,
                "error_code": "FX_RATE_UNAVAILABLE",
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Exchange rate get error: {str(e)}")
            return Response(
                {"error": "Failed to load exchange rate"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request):
        """Update exchange rate (admin only)"""
        try:
            if request.user.role != "admin":
                return Response(
                    {"detail": "Only admin users can update exchange rate"},
                    status=status.HTTP_403_FORBIDDEN
                )

            legacy_rate = request.data.get("usd_to_syp")
            buy_rate = request.data.get("platform_buy_usd_rate_syp", legacy_rate)
            sell_rate = request.data.get("platform_sell_usd_rate_syp", legacy_rate)
            current = ExchangeRateQuoteService.get_active_quote()
            quote = ExchangeRateQuoteService.activate_quote(
                buy_rate=buy_rate,
                sell_rate=sell_rate,
                actor=request.user,
                activation_note=request.data.get("activation_note") or "Legacy exchange-rate endpoint update",
                expected_current_quote_id=request.data.get("expected_current_quote_id", current.id if current else None),
            )
            legacy = ExchangeRate.objects.order_by("-updated_at").first()
            if not legacy:
                legacy = ExchangeRate.objects.create(usd_to_syp=quote.platform_buy_base_rate)
            else:
                legacy.usd_to_syp = quote.platform_buy_base_rate
                legacy.save()
            payload = ExchangeRateQuoteService.serialize(quote)
            compatibility_rates = ExchangeService.get_exchange_rates(display_only=True)
            payload.update({
                "rate_available": True,
                "usd_to_syp": str(compatibility_rates["usd_to_syp"]["value"]),
                "syp_to_usd": str(quantize_rate(compatibility_rates["syp_to_usd"]["value"])),
            })
            return Response(payload, status=status.HTTP_200_OK)
        except SpreadNotEnabled as e:
            return Response({"error": str(e), "code": e.code}, status=status.HTTP_400_BAD_REQUEST)
        except QuoteConflict as e:
            return Response({"error": str(e), "code": e.code}, status=status.HTTP_409_CONFLICT)
        except ExchangeRateQuoteError as e:
            return Response({"error": str(e), "code": e.code}, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Exchange rate update error: {str(e)}")
            return Response(
                {"error": "Failed to update exchange rate"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExchangeRateQuoteCurrentView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ExchangeRateQuoteSerializer, 503: OpenApiResponse(description="FX_RATE_UNAVAILABLE")},
        description="Return the active USD/SYP quote and legacy read aliases.",
    )
    def get(self, request):
        quote = ExchangeRateQuoteService.get_active_quote()
        if not quote:
            return Response({"rate_available": False, "code": "FX_RATE_UNAVAILABLE", "error_code": "FX_RATE_UNAVAILABLE", "quote_id": None, "version": None, "usd_to_syp": None, "syp_to_usd": None}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        payload = ExchangeRateQuoteService.serialize(quote)
        payload.update({
            "rate_available": True,
            "usd_to_syp": str(quote.platform_buy_base_rate),
            "syp_to_usd": str(quantize_rate(ExchangeService.get_exchange_rates(display_only=True)["syp_to_usd"]["value"])),
        })
        return Response(payload, status=status.HTTP_200_OK)


class ExchangeRateQuoteHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ExchangeRateQuoteSerializer(many=True)},
        description="Return immutable USD/SYP quote history.",
    )
    def get(self, request):
        quotes = ExchangeRateQuote.objects.filter(
            base_currency="USD", quote_currency="SYP"
        ).order_by("-version")
        return Response(ExchangeRateQuoteSerializer(quotes, many=True).data, status=status.HTTP_200_OK)


class ExchangeRateQuoteActivateView(APIView):
    permission_classes = [CanManageExchangeRates]

    @extend_schema(
        request=ExchangeRateQuoteActivationSerializer,
        responses={201: ExchangeRateQuoteSerializer, 400: OpenApiResponse(description="FX_RATE_INVALID or FX_RATE_SPREAD_NOT_ENABLED"), 409: OpenApiResponse(description="FX_RATE_STALE_CURRENT_QUOTE")},
        description="Activate a zero-spread USD/SYP quote. Non-zero spread is deferred.",
    )
    def post(self, request):
        serializer = ExchangeRateQuoteActivationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"code": "FX_RATE_INVALID", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            quote = ExchangeRateQuoteService.activate_quote(
                buy_rate=data["platform_buy_usd_rate_syp"],
                sell_rate=data["platform_sell_usd_rate_syp"],
                actor=request.user,
                activation_note=data["activation_note"],
                expected_current_quote_id=data.get("expected_current_quote_id"),
            )
        except SpreadNotEnabled as exc:
            return Response({"code": exc.code, "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except QuoteConflict as exc:
            return Response({"code": exc.code, "error": str(exc)}, status=status.HTTP_409_CONFLICT)
        except ExchangeRateQuoteError as exc:
            return Response({"code": exc.code, "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ExchangeRateQuoteSerializer(quote).data, status=status.HTTP_201_CREATED)


class WalletCurrencyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, currency):
        """Get wallet information for a specific currency (USD or SYP)"""
        try:
            currency = currency.upper()
            if currency not in ["USD", "SYP"]:
                return Response(
                    {"error": "Unsupported currency. Use USD or SYP"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = request.user
            wallet = WalletService.get_or_create_wallet(user, currency)
            quote = ExchangeRateQuoteService.get_active_quote()
            target_currency = "SYP" if currency == "USD" else "USD"
            converted = wallet_equivalents(wallet, target_currency=target_currency, quote=quote)

            return Response({
                "currency": currency,
                "available": float(wallet.available_balance),
                "pending": float(wallet.pending_balance),
                "total": float(wallet.total_balance),
                "converted": converted,
                "rate_available": quote is not None,
                "error_code": None if quote is not None else "FX_RATE_UNAVAILABLE",
                "exchange_rates": ExchangeService.get_exchange_rates(display_only=True),
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Wallet currency view error: {str(e)}")
            return Response(
                {"error": "Failed to load wallet data"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminWalletsSummaryView(APIView):
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Admin view for all wallets summary"""
        try:
            wallet_data = WalletService.get_admin_wallet_data()
            
            # Get top 5 wallets only
            top_wallets = Wallet.objects.select_related('user').order_by('-available_balance')[:5]
            top_wallets_data = []
            
            for wallet in top_wallets:
                top_wallets_data.append({
                    'user_id': wallet.user.id,
                    'user_name': wallet.user.name,
                    'full_name': wallet.user.full_name,
                    'currency': wallet.currency,
                    'available': float(wallet.available_balance),
                    'total': float(wallet.total_balance),
                })
            
            return Response({
                'summary': wallet_data,
                'top_wallets': top_wallets_data,
                'total_wallets': Wallet.objects.count(),
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Admin wallets summary error: {str(e)}")
            return Response(
                {"error": "Failed to get wallets summary"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WalletTransactionsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get recent transactions for user's wallet"""
        try:
            user = request.user
            
            # Simple pagination
            page = int(request.GET.get('page', 1))
            limit = min(int(request.GET.get('limit', 20)), 100)  # Max 100 per page
            offset = (page - 1) * limit
            
            transactions = Transaction.objects.filter(
                user=user
            ).select_related('wallet').order_by('-created_at')

            currency = request.GET.get('currency')
            if currency:
                transactions = transactions.filter(wallet__currency=currency.upper())
            
            total_count = transactions.count()
            transactions_page = transactions[offset:offset + limit]
            
            # Simplified serialization
            transactions_data = []
            for tx in transactions_page:
                transactions_data.append({
                    'id': tx.id,
                    'type': tx.transaction_type,
                    'amount': float(tx.amount),
                    'status': tx.status,
                    'note': tx.note[:100] if tx.note else '',
                    'created_at': tx.created_at.strftime('%Y-%m-%d %H:%M:%S')
                })
            
            return Response({
                'transactions': transactions_data,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total_count,
                    'has_more': offset + limit < total_count
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Wallet transactions error: {str(e)}")
            return Response(
                {"error": "Failed to get transactions"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WalletDepositView(APIView):
    """For shipping integration - users can deposit via shipping payments"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Initiate a deposit (used by shipping app)"""
        try:
            user = request.user
            amount = Decimal(str(request.data.get('amount', 0)))
            currency = request.data.get('currency', 'USD').upper()
            if currency not in ["USD", "SYP"]:
                return Response(
                    {"error": "Unsupported currency. Use USD or SYP"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if amount <= Decimal('0'):
                return Response(
                    {"error": "Amount must be greater than zero"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get wallet
            wallet = WalletService.get_or_create_wallet(user, currency)
            
            # Create deposit transaction
            transaction = wallet.add_funds(
                amount=amount,
                note=f"Deposit: {request.data.get('note', '')}",
                transaction_type="deposit"
            )
            
            return Response({
                "success": True,
                "message": "Deposit request created",
                "transaction_id": transaction.id,
                "amount": float(amount),
                "status": "pending",
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Deposit error: {str(e)}")
            return Response(
                {"error": "Failed to process deposit"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WalletWithdrawView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Initiate a withdrawal"""
        try:
            user = request.user
            amount = Decimal(str(request.data.get('amount', 0)))
            currency = request.data.get('currency', 'USD').upper()
            if currency not in ["USD", "SYP"]:
                return Response(
                    {"error": "Unsupported currency. Use USD or SYP"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if amount <= Decimal('0'):
                return Response(
                    {"error": "Amount must be greater than zero"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get wallet
            wallet = WalletService.get_or_create_wallet(user, currency)
            
            # Check balance
            if wallet.available_balance < amount:
                return Response({
                    "error": f"Insufficient funds. Available: {wallet.available_balance}"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create withdrawal transaction
            transaction = wallet.deduct_funds(
                amount=amount,
                note=f"Withdrawal: {request.data.get('note', '')}",
                transaction_type="withdrawal"
            )
            
            return Response({
                "success": True,
                "message": "Withdrawal request created",
                "transaction_id": transaction.id,
                "amount": float(amount),
                "available_balance": float(wallet.available_balance)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Withdrawal error: {str(e)}")
            return Response(
                {"error": "Failed to process withdrawal"},
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
                {"error": "Unsupported currency. Use USD or SYP"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        user.currency_preference = new_currency
        user.save()
        
        # Clear user-specific cache
        cache.delete(f"wallet_data_{user.id}")

        return Response({
            "message": f"Currency preference updated to {new_currency}",
            "currency_preference": new_currency
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Currency change error: {str(e)}")
        return Response(
            {"error": "Failed to update currency preference"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def wallet_quick_stats(request):
    """Quick stats endpoint for admin dashboard"""
    try:
        from django.db.models import Count, Sum
        from django.utils import timezone
        from datetime import timedelta
        
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        
        # Basic stats
        total_wallets = Wallet.objects.count()
        total_balance_usd = Wallet.objects.filter(currency="USD").aggregate(
            total=Sum('available_balance')
        )['total'] or Decimal('0')
        total_balance_syp = Wallet.objects.filter(currency="SYP").aggregate(
            total=Sum('available_balance')
        )['total'] or Decimal('0')
        
        # Recent activity
        recent_deposits = Transaction.objects.filter(
            transaction_type='deposit',
            created_at__gte=week_ago,
            status='approved'
        ).aggregate(
            count=Count('id'),
            amount=Sum('amount')
        )
        
        return Response({
            'total_wallets': total_wallets,
            'total_balance_usd': float(total_balance_usd),
            'total_balance_syp': float(total_balance_syp),
            'recent_deposits': {
                'count': recent_deposits['count'] or 0,
                'amount': float(recent_deposits['amount'] or 0)
            },
            'top_currency': User.objects.values('currency_preference').annotate(
                count=Count('id')
            ).order_by('-count').first()
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Wallet stats error: {str(e)}")
        return Response({"error": "Failed to get stats"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
