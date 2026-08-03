# transactions/views.py - FIXED VERSION
from django.db import transaction as db_transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.db.models import Sum, Count, Q, Case, When, Value, DecimalField, F, ExpressionWrapper
from django.db.models.functions import Abs
from decimal import Decimal
from datetime import timedelta, datetime, time
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models.functions import TruncDate, TruncMonth, Coalesce
from django.core.cache import cache
import re
import logging

from shipping.models import Shipping
from system.models import Notification
from .models import Transaction
from .serializers import TransactionSerializer, CreateTransactionSerializer
from wallets.models import Wallet
from agents.models import AgentProfile
from users.models import User
from payment.models import Payment
from finance.services import FinanceService
from finance.reporting import FinancialReportService, ReportPeriodError

E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")
logger = logging.getLogger(__name__)

def normalize_phone(phone):
    if not phone:
        return None
    p = str(phone).strip()
    for ch in [" ", "-", "(", ")", ".", "\t", "\n"]:
        p = p.replace(ch, "")
    if p.startswith("00"):
        p = "+" + p[2:]
    if not p.startswith("+"):
        return None
    if not E164_RE.match(p):
        return None
    return p

class FinancialSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_usd_to_syp_with_logging(self):
        try:
            from wallets.views import WalletService
            rates = WalletService.get_exchange_rates()
            usd_to_syp = rates.get('usd_to_syp', {}).get('value')
            if not usd_to_syp:
                logger.warning("FinancialSummaryView: usd_to_syp missing in rates, using fallback 116")
                return Decimal('116')
            return Decimal(str(usd_to_syp))
        except Exception as exc:
            logger.warning("FinancialSummaryView: failed to load exchange rates, using fallback 116 (%s)", exc)
            return Decimal('116')

    def _safe_localdate(self):
        now = timezone.now()
        if timezone.is_naive(now):
            now = timezone.make_aware(now, timezone.get_current_timezone())
        return now.date()

    def _get_date_range(self, range_key):
        today = self._safe_localdate()
        if range_key == "last_month":
            first_current = today.replace(day=1)
            last_prev = first_current - timedelta(days=1)
            start = last_prev.replace(day=1)
            end = last_prev
            granularity = "day"
        else:
            start = None
            end = None
            granularity = "month"
        return start, end, granularity

    def _date_bounds(self, start_date, end_date):
        if not start_date or not end_date:
            return None, None
        tz = timezone.get_current_timezone()
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        if timezone.is_naive(start_dt):
            start_dt = timezone.make_aware(start_dt, tz)
        if timezone.is_naive(end_dt):
            end_dt = timezone.make_aware(end_dt, tz)
        return start_dt, end_dt

    def _convert_amount(self, amount, currency, usd_to_syp):
        amt = Decimal(str(amount or 0))
        if str(currency).upper() == "SYP":
            return (amt / Decimal(usd_to_syp), amt)
        return (amt, amt * Decimal(usd_to_syp))

    def _payment_amounts(self, payment, usd_to_syp):
        if payment.amount_usd is not None and payment.amount_syp is not None:
            return (Decimal(str(payment.amount_usd)), Decimal(str(payment.amount_syp)))
        final_price = Decimal(str(payment.final_price or 0))
        currency = (payment.currency or "USD").upper()
        return self._convert_amount(final_price, currency, usd_to_syp)

    def _base_cost_amounts(self, payment, usd_to_syp):
        base_price = Decimal(str(payment.base_price or 0))
        base_currency = getattr(payment.store_product, "currency", None) or payment.currency or "USD"
        return self._convert_amount(base_price, base_currency, usd_to_syp)

    def _build_payment_summary(self, payments, usd_to_syp):
        total_revenue_usd = Decimal("0")
        total_revenue_syp = Decimal("0")
        total_base_usd = Decimal("0")
        total_base_syp = Decimal("0")
        weighted_profit_pct_sum = Decimal("0")

        category_map = {}
        for payment in payments:
            rev_usd, rev_syp = self._payment_amounts(payment, usd_to_syp)
            base_usd, base_syp = self._base_cost_amounts(payment, usd_to_syp)
            profit_pct = Decimal(str(getattr(payment, "profit_percentage", 0) or 0))

            total_revenue_usd += rev_usd
            total_revenue_syp += rev_syp
            total_base_usd += base_usd
            total_base_syp += base_syp
            weighted_profit_pct_sum += (rev_usd * profit_pct)

            category = getattr(payment.user, "category", None)
            category_id = getattr(category, "id", "uncategorized")
            category_name = getattr(category, "display_name", None) or getattr(category, "name", None) or "Uncategorized"
            category_profit_pct = Decimal(str(getattr(category, "profit_percentage", 0) or 0))

            bucket = category_map.get(category_id)
            if not bucket:
                bucket = {
                    "id": category_id,
                    "name": category_name,
                    "profit_percentage": float(category_profit_pct),
                    "transactions_count": 0,
                    "revenue_usd": Decimal("0"),
                    "revenue_syp": Decimal("0"),
                    "base_cost_usd": Decimal("0"),
                    "base_cost_syp": Decimal("0"),
                }
                category_map[category_id] = bucket

            bucket["transactions_count"] += 1
            bucket["revenue_usd"] += rev_usd
            bucket["revenue_syp"] += rev_syp
            bucket["base_cost_usd"] += base_usd
            bucket["base_cost_syp"] += base_syp

        avg_profit_pct = (weighted_profit_pct_sum / total_revenue_usd) if total_revenue_usd else Decimal("0")
        gross_profit_usd = total_revenue_usd - total_base_usd
        gross_profit_syp = total_revenue_syp - total_base_syp

        categories = []
        for bucket in category_map.values():
            gross_usd = bucket["revenue_usd"] - bucket["base_cost_usd"]
            gross_syp = bucket["revenue_syp"] - bucket["base_cost_syp"]
            categories.append({
                "id": bucket["id"],
                "name": bucket["name"],
                "profit_percentage": float(bucket["profit_percentage"]),
                "transactions_count": bucket["transactions_count"],
                "revenue_usd": float(bucket["revenue_usd"]),
                "revenue_syp": float(bucket["revenue_syp"]),
                "base_cost_usd": float(bucket["base_cost_usd"]),
                "base_cost_syp": float(bucket["base_cost_syp"]),
                "gross_profit_usd": float(gross_usd),
                "gross_profit_syp": float(gross_syp),
            })

        return {
            "payments_count": payments.count(),
            "revenue_usd": total_revenue_usd,
            "revenue_syp": total_revenue_syp,
            "base_cost_usd": total_base_usd,
            "base_cost_syp": total_base_syp,
            "gross_profit_usd": gross_profit_usd,
            "gross_profit_syp": gross_profit_syp,
            "avg_profit_percentage": avg_profit_pct,
            "per_category": categories,
        }

    def _build_payment_summary_db(self, payments, usd_to_syp):
        usd_to_syp_val = Value(Decimal(str(usd_to_syp)), output_field=DecimalField(max_digits=20, decimal_places=8))
        dec_field = DecimalField(max_digits=20, decimal_places=8)
        zero = Value(Decimal("0"), output_field=dec_field)

        revenue_usd_expr = Case(
            When(currency="USD", amount_usd__isnull=False, then=F("amount_usd")),
            When(currency="USD", then=F("final_price")),
            default=zero,
            output_field=dec_field,
        )
        revenue_syp_expr = Case(
            When(currency="SYP", amount_syp__isnull=False, then=F("amount_syp")),
            When(currency="SYP", then=F("final_price")),
            default=zero,
            output_field=dec_field,
        )

        payments = payments.annotate(base_currency=Coalesce(F("store_product__currency"), F("currency")))
        base_usd_expr = Case(
            When(currency="USD", base_currency="USD", then=F("base_price")),
            When(currency="USD", base_currency="SYP", then=ExpressionWrapper(F("base_price") / usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )
        base_syp_expr = Case(
            When(currency="SYP", base_currency="SYP", then=F("base_price")),
            When(currency="SYP", base_currency="USD", then=ExpressionWrapper(F("base_price") * usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )

        weighted_profit_expr = ExpressionWrapper(revenue_usd_expr * F("profit_percentage"), output_field=dec_field)

        totals = payments.aggregate(
            payments_count=Count("id"),
            revenue_usd=Coalesce(Sum(revenue_usd_expr), zero),
            revenue_syp=Coalesce(Sum(revenue_syp_expr), zero),
            base_cost_usd=Coalesce(Sum(base_usd_expr), zero),
            base_cost_syp=Coalesce(Sum(base_syp_expr), zero),
            weighted_profit=Coalesce(Sum(weighted_profit_expr), zero),
        )

        total_revenue_usd = Decimal(str(totals["revenue_usd"] or 0))
        total_revenue_syp = Decimal(str(totals["revenue_syp"] or 0))
        total_base_usd = Decimal(str(totals["base_cost_usd"] or 0))
        total_base_syp = Decimal(str(totals["base_cost_syp"] or 0))
        weighted_profit = Decimal(str(totals["weighted_profit"] or 0))

        avg_profit_pct = (weighted_profit / total_revenue_usd) if total_revenue_usd else Decimal("0")
        gross_profit_usd = total_revenue_usd - total_base_usd
        gross_profit_syp = total_revenue_syp - total_base_syp

        category_rows = payments.values(
            "user__category_id",
            "user__category__display_name",
            "user__category__name",
            "user__category__profit_percentage",
        ).annotate(
            transactions_count=Count("id"),
            revenue_usd=Coalesce(Sum(revenue_usd_expr), zero),
            revenue_syp=Coalesce(Sum(revenue_syp_expr), zero),
            base_cost_usd=Coalesce(Sum(base_usd_expr), zero),
            base_cost_syp=Coalesce(Sum(base_syp_expr), zero),
        )

        categories = []
        for row in category_rows:
            category_id = row.get("user__category_id") or "uncategorized"
            category_name = row.get("user__category__display_name") or row.get("user__category__name") or "Uncategorized"
            profit_pct = Decimal(str(row.get("user__category__profit_percentage") or 0))
            revenue_usd = Decimal(str(row.get("revenue_usd") or 0))
            revenue_syp = Decimal(str(row.get("revenue_syp") or 0))
            base_usd = Decimal(str(row.get("base_cost_usd") or 0))
            base_syp = Decimal(str(row.get("base_cost_syp") or 0))
            categories.append({
                "id": category_id,
                "name": category_name,
                "profit_percentage": float(profit_pct),
                "transactions_count": row.get("transactions_count") or 0,
                "revenue_usd": float(revenue_usd),
                "revenue_syp": float(revenue_syp),
                "base_cost_usd": float(base_usd),
                "base_cost_syp": float(base_syp),
                "gross_profit_usd": float(revenue_usd - base_usd),
                "gross_profit_syp": float(revenue_syp - base_syp),
            })

        return {
            "payments_count": totals["payments_count"] or 0,
            "revenue_usd": total_revenue_usd,
            "revenue_syp": total_revenue_syp,
            "base_cost_usd": total_base_usd,
            "base_cost_syp": total_base_syp,
            "gross_profit_usd": gross_profit_usd,
            "gross_profit_syp": gross_profit_syp,
            "avg_profit_percentage": avg_profit_pct,
            "per_category": categories,
        }

    def _build_commissions(self, commission_txs, usd_to_syp):
        total_usd = Decimal("0")
        total_syp = Decimal("0")
        by_agent = {}

        for tx in commission_txs:
            if tx.amount_usd is not None and tx.amount_syp is not None:
                amt_usd = Decimal(str(tx.amount_usd))
                amt_syp = Decimal(str(tx.amount_syp))
            else:
                amt_usd, amt_syp = self._convert_amount(tx.amount, tx.currency, usd_to_syp)

            total_usd += amt_usd
            total_syp += amt_syp

            agent_id = tx.user_id
            bucket = by_agent.get(agent_id)
            if not bucket:
                agent_name = getattr(tx.user, "full_name", None) or getattr(tx.user, "name", None) or f"Agent {agent_id}"
                profile = AgentProfile.objects.filter(user_id=agent_id).first()
                commission_rate = float(getattr(profile, "commission_rate", 0) or 0)
                bucket = {
                    "id": agent_id,
                    "name": agent_name,
                    "commission_rate": commission_rate,
                    "commission_usd": Decimal("0"),
                    "commission_syp": Decimal("0"),
                    "transactions_count": 0,
                }
                by_agent[agent_id] = bucket

            bucket["commission_usd"] += amt_usd
            bucket["commission_syp"] += amt_syp
            bucket["transactions_count"] += 1

        top_agents = sorted(
            by_agent.values(),
            key=lambda x: x["commission_usd"],
            reverse=True,
        )[:10]

        formatted_agents = []
        for bucket in top_agents:
            formatted_agents.append({
                "id": bucket["id"],
                "name": bucket["name"],
                "commission_rate": bucket["commission_rate"],
                "commission_usd": float(bucket["commission_usd"]),
                "commission_syp": float(bucket["commission_syp"]),
                "transactions_count": bucket["transactions_count"],
            })

        return {
            "total_usd": total_usd,
            "total_syp": total_syp,
            "top_agents": formatted_agents,
        }

    def _build_commissions_db(self, commission_txs, usd_to_syp):
        usd_to_syp_val = Value(Decimal(str(usd_to_syp)), output_field=DecimalField(max_digits=20, decimal_places=8))
        dec_field = DecimalField(max_digits=20, decimal_places=8)
        zero = Value(Decimal("0"), output_field=dec_field)

        amt_usd_expr = Case(
            When(amount_usd__isnull=False, then=F("amount_usd")),
            When(currency="USD", then=F("amount")),
            When(currency="SYP", then=ExpressionWrapper(F("amount") / usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )
        amt_syp_expr = Case(
            When(amount_syp__isnull=False, then=F("amount_syp")),
            When(currency="SYP", then=F("amount")),
            When(currency="USD", then=ExpressionWrapper(F("amount") * usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )

        totals = commission_txs.aggregate(
            total_usd=Coalesce(Sum(amt_usd_expr), zero),
            total_syp=Coalesce(Sum(amt_syp_expr), zero),
        )

        agent_rows = commission_txs.values(
            "user_id",
            "user__full_name",
            "user__name",
        ).annotate(
            commission_usd=Coalesce(Sum(amt_usd_expr), zero),
            commission_syp=Coalesce(Sum(amt_syp_expr), zero),
            transactions_count=Count("id"),
        ).order_by("-commission_usd")[:10]

        agent_ids = [row["user_id"] for row in agent_rows]
        profiles = {p.user_id: p for p in AgentProfile.objects.filter(user_id__in=agent_ids)}

        formatted_agents = []
        for row in agent_rows:
            agent_id = row["user_id"]
            profile = profiles.get(agent_id)
            commission_rate = float(getattr(profile, "commission_rate", 0) or 0)
            agent_name = row.get("user__full_name") or row.get("user__name") or f"Agent {agent_id}"
            formatted_agents.append({
                "id": agent_id,
                "name": agent_name,
                "commission_rate": commission_rate,
                "commission_usd": float(Decimal(str(row.get("commission_usd") or 0))),
                "commission_syp": float(Decimal(str(row.get("commission_syp") or 0))),
                "transactions_count": row.get("transactions_count") or 0,
            })

        return {
            "total_usd": Decimal(str(totals.get("total_usd") or 0)),
            "total_syp": Decimal(str(totals.get("total_syp") or 0)),
            "top_agents": formatted_agents,
        }

    def _build_trend(self, payments, usd_to_syp, start, end, granularity):
        buckets = {}
        for payment in payments:
            date = payment.created_at.date()
            if granularity == "month":
                date = date.replace(day=1)
            rev_usd, rev_syp = self._payment_amounts(payment, usd_to_syp)
            base_usd, base_syp = self._base_cost_amounts(payment, usd_to_syp)
            gross_usd = rev_usd - base_usd
            gross_syp = rev_syp - base_syp

            entry = buckets.get(date)
            if not entry:
                entry = {
                    "revenue_usd": Decimal("0"),
                    "revenue_syp": Decimal("0"),
                    "gross_profit_usd": Decimal("0"),
                    "gross_profit_syp": Decimal("0"),
                    "payments_count": 0,
                }
                buckets[date] = entry

            entry["revenue_usd"] += rev_usd
            entry["revenue_syp"] += rev_syp
            entry["gross_profit_usd"] += gross_usd
            entry["gross_profit_syp"] += gross_syp
            entry["payments_count"] += 1

        points = []
        if granularity == "day" and start and end:
            current = start
            while current <= end:
                entry = buckets.get(current, {})
                points.append({
                    "period": current.isoformat(),
                    "revenue_usd": float(entry.get("revenue_usd", 0)),
                    "revenue_syp": float(entry.get("revenue_syp", 0)),
                    "gross_profit_usd": float(entry.get("gross_profit_usd", 0)),
                    "gross_profit_syp": float(entry.get("gross_profit_syp", 0)),
                    "payments_count": entry.get("payments_count", 0),
                })
                current += timedelta(days=1)
        else:
            for period in sorted(buckets.keys()):
                entry = buckets[period]
                points.append({
                    "period": period.isoformat(),
                    "revenue_usd": float(entry.get("revenue_usd", 0)),
                    "revenue_syp": float(entry.get("revenue_syp", 0)),
                    "gross_profit_usd": float(entry.get("gross_profit_usd", 0)),
                    "gross_profit_syp": float(entry.get("gross_profit_syp", 0)),
                    "payments_count": entry.get("payments_count", 0),
                })

        return points

    def _build_trend_db(self, payments, usd_to_syp, start, end, granularity):
        usd_to_syp_val = Value(Decimal(str(usd_to_syp)), output_field=DecimalField(max_digits=20, decimal_places=8))
        dec_field = DecimalField(max_digits=20, decimal_places=8)
        zero = Value(Decimal("0"), output_field=dec_field)

        revenue_usd_expr = Case(
            When(currency="USD", amount_usd__isnull=False, then=F("amount_usd")),
            When(currency="USD", then=F("final_price")),
            default=zero,
            output_field=dec_field,
        )
        revenue_syp_expr = Case(
            When(currency="SYP", amount_syp__isnull=False, then=F("amount_syp")),
            When(currency="SYP", then=F("final_price")),
            default=zero,
            output_field=dec_field,
        )
        payments = payments.annotate(base_currency=Coalesce(F("store_product__currency"), F("currency")))
        base_usd_expr = Case(
            When(currency="USD", base_currency="USD", then=F("base_price")),
            When(currency="USD", base_currency="SYP", then=ExpressionWrapper(F("base_price") / usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )
        base_syp_expr = Case(
            When(currency="SYP", base_currency="SYP", then=F("base_price")),
            When(currency="SYP", base_currency="USD", then=ExpressionWrapper(F("base_price") * usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )

        if granularity == "day":
            period_expr = TruncDate("created_at")
        else:
            period_expr = TruncMonth("created_at")

        rows = payments.annotate(
            period=period_expr,
        ).values("period").annotate(
            revenue_usd=Coalesce(Sum(revenue_usd_expr), zero),
            revenue_syp=Coalesce(Sum(revenue_syp_expr), zero),
            base_usd=Coalesce(Sum(base_usd_expr), zero),
            base_syp=Coalesce(Sum(base_syp_expr), zero),
            payments_count=Count("id"),
        ).order_by("period")

        buckets = {}
        for row in rows:
            period = row["period"].date() if hasattr(row["period"], "date") else row["period"]
            revenue_usd = Decimal(str(row.get("revenue_usd") or 0))
            revenue_syp = Decimal(str(row.get("revenue_syp") or 0))
            base_usd = Decimal(str(row.get("base_usd") or 0))
            base_syp = Decimal(str(row.get("base_syp") or 0))
            buckets[period] = {
                "revenue_usd": float(revenue_usd),
                "revenue_syp": float(revenue_syp),
                "gross_profit_usd": float(revenue_usd - base_usd),
                "gross_profit_syp": float(revenue_syp - base_syp),
                "payments_count": row.get("payments_count") or 0,
            }

        points = []
        if granularity == "day" and start and end:
            current = start
            while current <= end:
                entry = buckets.get(current, {})
                points.append({
                    "period": current.isoformat(),
                    "revenue_usd": entry.get("revenue_usd", 0),
                    "revenue_syp": entry.get("revenue_syp", 0),
                    "gross_profit_usd": entry.get("gross_profit_usd", 0),
                    "gross_profit_syp": entry.get("gross_profit_syp", 0),
                    "payments_count": entry.get("payments_count", 0),
                })
                current += timedelta(days=1)
        else:
            for period in sorted(buckets.keys()):
                entry = buckets[period]
                points.append({
                    "period": period.isoformat(),
                    "revenue_usd": entry["revenue_usd"],
                    "revenue_syp": entry["revenue_syp"],
                    "gross_profit_usd": entry["gross_profit_usd"],
                    "gross_profit_syp": entry["gross_profit_syp"],
                    "payments_count": entry["payments_count"],
                })

        return points

    def _build_transaction_type_summary(self, transactions, usd_to_syp):
        summary = {}
        for tx in transactions:
            tx_type = tx.transaction_type
            if tx.amount_usd is not None and tx.amount_syp is not None:
                amt_usd = abs(Decimal(str(tx.amount_usd)))
                amt_syp = abs(Decimal(str(tx.amount_syp)))
            else:
                amt_usd, amt_syp = self._convert_amount(abs(tx.amount), tx.currency, usd_to_syp)

            bucket = summary.get(tx_type)
            if not bucket:
                bucket = {"type": tx_type, "count": 0, "total_usd": Decimal("0"), "total_syp": Decimal("0")}
                summary[tx_type] = bucket
            bucket["count"] += 1
            bucket["total_usd"] += amt_usd
            bucket["total_syp"] += amt_syp

        return [
            {
                "type": bucket["type"],
                "count": bucket["count"],
                "total_usd": float(bucket["total_usd"]),
                "total_syp": float(bucket["total_syp"]),
            }
            for bucket in summary.values()
        ]

    def _build_transaction_type_summary_db(self, transactions, usd_to_syp):
        usd_to_syp_val = Value(Decimal(str(usd_to_syp)), output_field=DecimalField(max_digits=20, decimal_places=8))
        dec_field = DecimalField(max_digits=20, decimal_places=8)
        zero = Value(Decimal("0"), output_field=dec_field)

        amt_usd_expr = Case(
            When(amount_usd__isnull=False, then=Abs(F("amount_usd"))),
            When(currency="USD", then=Abs(F("amount"))),
            When(currency="SYP", then=ExpressionWrapper(Abs(F("amount")) / usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )
        amt_syp_expr = Case(
            When(amount_syp__isnull=False, then=Abs(F("amount_syp"))),
            When(currency="SYP", then=Abs(F("amount"))),
            When(currency="USD", then=ExpressionWrapper(Abs(F("amount")) * usd_to_syp_val, output_field=dec_field)),
            default=zero,
            output_field=dec_field,
        )

        rows = transactions.values("transaction_type").annotate(
            count=Count("id"),
            total_usd=Coalesce(Sum(amt_usd_expr), zero),
            total_syp=Coalesce(Sum(amt_syp_expr), zero),
        )

        return [
            {
                "type": row["transaction_type"],
                "count": row["count"],
                "total_usd": float(Decimal(str(row.get("total_usd") or 0))),
                "total_syp": float(Decimal(str(row.get("total_syp") or 0))),
            }
            for row in rows
        ]

    def get(self, request):
        if getattr(request.user, 'role', None) != 'admin' and not request.user.is_superuser:
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        # Compatibility adapter: historical summary requests now use the
        # ledger-backed reporting service. The legacy implementation below is
        # retained temporarily for response-shape migration only and is not
        # reachable from this endpoint.
        try:
            requested_period = request.query_params.get("period")
            if requested_period:
                report = FinancialReportService.build(
                    period=requested_period,
                    anchor=request.query_params.get("date"),
                    start_date=request.query_params.get("start_date"),
                    end_date=request.query_params.get("end_date"),
                )
            else:
                legacy_range = (request.query_params.get("range") or "monthly").strip().lower()
                report = FinancialReportService.build(
                    period="monthly" if legacy_range in {"all", "monthly"} else "daily",
                    anchor=request.query_params.get("date"),
                )
            return Response(report)
        except ReportPeriodError as exc:
            return Response({"detail": str(exc), "error_code": exc.code}, status=status.HTTP_400_BAD_REQUEST)

        range_key = (request.query_params.get("range") or "all").strip().lower()
        cache_key = f"financial_summary:{range_key}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        usd_to_syp = self._get_usd_to_syp_with_logging()

        start_date, end_date, granularity = self._get_date_range(range_key)
        start_dt, end_dt = self._date_bounds(start_date, end_date)

        payments = Payment.objects.filter(status="success").select_related(
            "store_product", "user", "user__category"
        )
        if start_dt and end_dt:
            payments = payments.filter(created_at__gte=start_dt, created_at__lte=end_dt)

        commission_txs = Transaction.objects.filter(
            transaction_type="commission",
            status="approved",
        ).select_related("user")
        if start_dt and end_dt:
            commission_txs = commission_txs.filter(created_at__gte=start_dt, created_at__lte=end_dt)

        approved_txs = Transaction.objects.filter(status="approved")
        if start_dt and end_dt:
            approved_txs = approved_txs.filter(created_at__gte=start_dt, created_at__lte=end_dt)

        try:
            payment_summary = self._build_payment_summary_db(payments, usd_to_syp)
        except Exception:
            logger.exception("FinancialSummaryView payment summary failed")
            payment_summary = {
                "payments_count": 0,
                "revenue_usd": Decimal("0"),
                "revenue_syp": Decimal("0"),
                "base_cost_usd": Decimal("0"),
                "base_cost_syp": Decimal("0"),
                "gross_profit_usd": Decimal("0"),
                "gross_profit_syp": Decimal("0"),
                "avg_profit_percentage": Decimal("0"),
                "per_category": [],
            }

        try:
            commissions = self._build_commissions_db(commission_txs, usd_to_syp)
        except Exception:
            logger.exception("FinancialSummaryView commissions failed")
            commissions = {"total_usd": Decimal("0"), "total_syp": Decimal("0"), "top_agents": []}

        net_profit_usd = payment_summary["gross_profit_usd"] - commissions["total_usd"]
        net_profit_syp = payment_summary["gross_profit_syp"] - commissions["total_syp"]

        try:
            trend_points = self._build_trend_db(payments, usd_to_syp, start_date, end_date, granularity)
        except Exception:
            logger.exception("FinancialSummaryView trend failed")
            trend_points = []

        try:
            tx_type_summary = self._build_transaction_type_summary_db(approved_txs, usd_to_syp)
        except Exception:
            logger.exception("FinancialSummaryView transaction summary failed")
            tx_type_summary = []

        data = {
            "range": range_key,
            "date_start": start_date.isoformat() if start_date else None,
            "date_end": end_date.isoformat() if end_date else None,
            "generated_at": timezone.now().isoformat(),
            "payments_count": payment_summary["payments_count"],
            "revenue": {
                "usd": float(payment_summary["revenue_usd"]),
                "syp": float(payment_summary["revenue_syp"]),
            },
            "base_cost": {
                "usd": float(payment_summary["base_cost_usd"]),
                "syp": float(payment_summary["base_cost_syp"]),
            },
            "gross_profit": {
                "usd": float(payment_summary["gross_profit_usd"]),
                "syp": float(payment_summary["gross_profit_syp"]),
            },
            "agent_commission": {
                "usd": float(commissions["total_usd"]),
                "syp": float(commissions["total_syp"]),
            },
            "net_profit": {
                "usd": float(net_profit_usd),
                "syp": float(net_profit_syp),
            },
            "avg_profit_percentage": float(payment_summary["avg_profit_percentage"]),
            "per_category": payment_summary["per_category"],
            "top_agents": commissions["top_agents"],
            "transaction_type_summary": tx_type_summary,
            "trend": {
                "granularity": granularity,
                "points": trend_points,
            },
            # Backward-compatible fields
            "total_revenue_usd": float(payment_summary["revenue_usd"]),
            "total_revenue_syp": float(payment_summary["revenue_syp"]),
            "transactions_count": payment_summary["payments_count"],
            "average_profit_percentage": float(payment_summary["avg_profit_percentage"]),
            "estimated_commission_syp": float(commissions["total_syp"]),
        }

        cache.set(cache_key, data, 300)
        return Response(data)


class AgentFinancialSummaryView(FinancialSummaryView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'role', None) != 'agent':
            return Response({'detail': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        from users.models import User
        users_under_agent = User.objects.filter(agent=request.user)
        payments = Payment.objects.filter(
            status="success",
            user__in=users_under_agent,
        ).select_related("store_product", "user", "user__category")

        # Build revenue totals by currency without exchange rate conversion.
        revenue_by_currency = {"USD": Decimal("0"), "SYP": Decimal("0")}
        try:
            for payment in payments:
                currency = (payment.currency or "USD").upper()
                amount = Decimal(str(payment.final_price or 0))
                if currency in revenue_by_currency:
                    revenue_by_currency[currency] += amount
        except Exception:
            logger.exception("AgentFinancialSummaryView revenue aggregation failed")

        try:
            today = self._safe_localdate()
            start_7d = today - timedelta(days=6)
            start_30d = today - timedelta(days=29)
            start_7d_dt, today_dt = self._date_bounds(start_7d, today)
            start_30d_dt, _today_dt = self._date_bounds(start_30d, today)

            # Trend keeps historical structure, but it uses base conversions.
            # Since agent summary should not depend on exchange rates, keep it minimal.
            t7_points, t30_points = [], []
        except Exception:
            logger.exception("AgentFinancialSummaryView trend failed")
            t7_points, t30_points = [], []

        trend_7d = [{"date": p["period"], "total_usd": p["revenue_usd"]} for p in t7_points]
        trend_30d = [{"date": p["period"], "total_usd": p["revenue_usd"]} for p in t30_points]
        trend_7d_syp = [{"date": p["period"], "total_syp": p["revenue_syp"]} for p in t7_points]
        trend_30d_syp = [{"date": p["period"], "total_syp": p["revenue_syp"]} for p in t30_points]

        try:
            profile = AgentProfile.objects.filter(user=request.user).first()
            commission_rate = float(getattr(profile, "commission_rate", 0) or 0)
            total_earnings_usd = float(getattr(profile, "total_earnings_usd", 0) or 0)
            total_earnings_syp = float(getattr(profile, "total_earnings_syp", 0) or 0)
            total_earnings = float(getattr(profile, "total_earnings", 0) or 0)
        except Exception:
            logger.exception("AgentFinancialSummaryView earnings failed")
            commission_rate = 0.0
            total_earnings = 0.0
            total_earnings_usd = 0.0
            total_earnings_syp = 0.0

        # Commission totals from real commission transactions (no exchange conversion).
        commission_txs = Transaction.objects.filter(
            user=request.user,
            transaction_type="commission",
            status="approved",
        )
        commission_by_currency = {"USD": Decimal("0"), "SYP": Decimal("0")}
        for tx in commission_txs:
            ccy = (tx.currency or "USD").upper()
            if ccy in commission_by_currency:
                commission_by_currency[ccy] += Decimal(str(tx.amount or 0))

        estimated_commission_usd = float(commission_by_currency["USD"])
        estimated_commission_syp = float(commission_by_currency["SYP"])

        data = {
            "total_revenue_usd": float(revenue_by_currency["USD"]),
            "total_revenue_syp": float(revenue_by_currency["SYP"]),
            "transactions_count": payments.count(),
            "average_profit_percentage": float(commission_rate),
            "estimated_commission_usd": estimated_commission_usd,
            "estimated_commission_syp": estimated_commission_syp,
            "total_revenue_by_currency": {
                "USD": float(revenue_by_currency["USD"]),
                "SYP": float(revenue_by_currency["SYP"]),
            },
            "commission_by_currency": {
                "USD": float(commission_by_currency["USD"]),
                "SYP": float(commission_by_currency["SYP"]),
            },
            "total_earnings_by_currency": {
                "USD": total_earnings_usd,
                "SYP": total_earnings_syp,
            },
            "per_category": [],
            "trend_7d": trend_7d,
            "trend_30d": trend_30d,
            "trend_7d_syp": trend_7d_syp,
            "trend_30d_syp": trend_30d_syp,
            "total_earnings": total_earnings,
            "total_earnings_usd": total_earnings_usd,
            "total_earnings_syp": total_earnings_syp,
            "commission_rate": commission_rate,
        }

        return Response(data)


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
                    transaction_obj = FinanceService.reject(transaction_obj.id, admin_user=request.user)
                    return Response({"status": transaction_obj.status})

                # approve
                # الملاحظة: عمليات الشراء (purchase) لا تحتاج موافقة admin
                transaction_obj = FinanceService.approve(transaction_obj.id, admin_user=request.user)

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
        params = self.request.query_params
        tx_type = params.get("transaction_type") or params.get("type")
        status_param = params.get("status")
        currency = params.get("currency")
        direction = params.get("direction")

        if user.role == "admin":
            # الادمن يشوف كل العمليات
            qs = Transaction.objects.all()

        elif user.role == "agent":
            # الوكيل يشوف عملياته + عمليات اليوزرات التابعة له
            from users import models as user_models
            users_under_agent = getattr(user, "subordinates", user_models.User.objects.none()).all()
            qs = Transaction.objects.filter(
                models.Q(user=user) | models.Q(user__in=users_under_agent)
            )

        else:
            # المستخدم العادي يشوف بس عملياته
            qs = Transaction.objects.filter(user=user)

        if tx_type and str(tx_type).lower() != "all":
            qs = qs.filter(transaction_type=tx_type)
        if status_param and str(status_param).lower() != "all":
            qs = qs.filter(status__iexact=status_param)
        if currency:
            qs = qs.filter(currency__iexact=currency)
        if direction:
            if str(direction).lower() == "in":
                qs = qs.filter(amount__gt=0)
            elif str(direction).lower() == "out":
                qs = qs.filter(amount__lt=0)

        return qs.select_related(
            "user", "wallet", "recipient", "recipient_wallet", "payment", "exchange_rate_quote"
        ).order_by("-created_at", "-id")


class TransferLookupView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        phone = request.query_params.get("phone") or request.data.get("phone")
        recipient_id = request.query_params.get("recipient_id") or request.data.get("recipient_id")
        wallet_id = request.query_params.get("wallet_id") or request.data.get("wallet_id")

        recipient = None
        if recipient_id:
            recipient = get_object_or_404(User, id=recipient_id)
        elif wallet_id:
            wallet = get_object_or_404(Wallet, id=wallet_id)
            recipient = wallet.user
        else:
            normalized = normalize_phone(phone)
            if not normalized:
                return Response({"error": "Invalid phone format. Use full international format like +964..."}, status=status.HTTP_400_BAD_REQUEST)
            recipient = User.objects.filter(phone=normalized).first()

        if not recipient:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if not recipient.is_active or getattr(recipient, "is_banned", False):
            return Response({"error": "Recipient not available"}, status=status.HTTP_400_BAD_REQUEST)

        if recipient.id == request.user.id:
            return Response({"error": "Cannot transfer to نفسك"}, status=status.HTTP_400_BAD_REQUEST)

        wallets = Wallet.objects.filter(user=recipient).order_by("currency")
        return Response({
            "id": recipient.id,
            "name": recipient.full_name or recipient.name,
            "phone": recipient.phone,
            "wallets": [
                {
                    "id": w.id,
                    "currency": w.currency,
                    "available": float(w.available_balance),
                    "pending": float(w.pending_balance),
                } for w in wallets
            ]
        })


class TransferCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        wallet_id = request.data.get("wallet_id")
        recipient_phone = request.data.get("recipient_phone")
        recipient_id = request.data.get("recipient_id")
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

        sender_wallet = get_object_or_404(Wallet, id=wallet_id, user=user)
        cooldown_start = timezone.now() - timedelta(minutes=10)
        last_outgoing = Transaction.objects.filter(
            user=user,
            transaction_type="transfer",
            amount__lt=0,
            created_at__gte=cooldown_start,
        ).order_by('-created_at').first()
        if last_outgoing:
            next_allowed = last_outgoing.created_at + timedelta(minutes=10)
            remaining_seconds = max(0, int((next_allowed - timezone.now()).total_seconds()))
            remaining_minutes = (remaining_seconds + 59) // 60
            return Response({
                "error": "You can only send one transfer every 10 minutes.",
                "retry_after_seconds": remaining_seconds,
                "retry_after_minutes": remaining_minutes,
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)


        recipient = None
        if recipient_id:
            recipient = get_object_or_404(User, id=recipient_id)
        else:
            normalized = normalize_phone(recipient_phone)
            if not normalized:
                return Response({"error": "Invalid phone format. Use full international format like +964..."}, status=status.HTTP_400_BAD_REQUEST)
            recipient = User.objects.filter(phone=normalized).first()

        if not recipient:
            return Response({"error": "Recipient not found"}, status=status.HTTP_404_NOT_FOUND)

        if not recipient.is_active or getattr(recipient, "is_banned", False):
            return Response({"error": "Recipient not available"}, status=status.HTTP_400_BAD_REQUEST)

        if recipient.id == user.id:
            return Response({"error": "Cannot transfer to yourself"}, status=status.HTTP_400_BAD_REQUEST)

        recipient_wallet, _ = Wallet.objects.get_or_create(user=recipient, currency=sender_wallet.currency)

        try:
            allow_overdraft = False
            overdraft_limit = None
            if getattr(user, "role", None) == "agent":
                agent_profile = AgentProfile.objects.filter(user=user).first()
                if agent_profile:
                    if sender_wallet.currency == "SYP":
                        overdraft_limit = Decimal(str(agent_profile.coverage_limit_syp or 0))
                    else:
                        overdraft_limit = Decimal(str(agent_profile.coverage_limit_usd or 0))
                    allow_overdraft = True

            sender_tx = FinanceService.transfer(
                sender_wallet_id=sender_wallet.id,
                recipient_wallet_id=recipient_wallet.id,
                amount=amount,
                note=note or f"Transfer from {user.full_name or user.name}",
                idempotency_key=request.data.get("idempotency_key"),
                allow_overdraft=allow_overdraft,
                overdraft_limit=overdraft_limit,
            )
            recipient_tx = sender_tx.related_transaction

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        Notification.objects.create(
            recipient=recipient,
            title="Transfer received",
            message=f"You received {amount} {sender_wallet.currency} from {user.full_name or user.name}.",
            icon=""
        )
        Notification.objects.create(
            recipient=user,
            title="Transfer sent",
            message=f"You sent {amount} {sender_wallet.currency} to {recipient.full_name or recipient.name}.",
            icon=""
        )

        return Response({
            "id": sender_tx.id,
            "status": sender_tx.status,
            "amount": float(abs(sender_tx.amount)),
            "currency": sender_wallet.currency,
            "recipient_id": recipient.id,
            "recipient_name": recipient.full_name or recipient.name,
            "recipient_phone": recipient.phone,
            "created_at": sender_tx.created_at,
        }, status=status.HTTP_201_CREATED)
