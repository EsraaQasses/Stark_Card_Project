"""Historical financial reporting from the immutable transaction ledger."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Case, CharField, Count, DecimalField, F, Q, Sum, Value, When, Window
from django.db.models.functions import Abs, Cast, Coalesce, RowNumber
from django.db.models.fields.json import KeyTextTransform
from django.utils import timezone

from transactions.models import Transaction


class ReportPeriodError(ValueError):
    code = "INVALID_REPORT_PERIOD"


class FinancialReportService:
    """Build accounting totals without re-converting historical operations."""

    PERIODS = {"daily", "weekly", "monthly", "custom"}

    @staticmethod
    def _local_zone():
        return ZoneInfo(getattr(settings, "TIME_ZONE", "UTC"))

    @classmethod
    def boundaries(cls, *, period="daily", anchor=None, start_date=None, end_date=None):
        period = str(period or "daily").lower()
        if period not in cls.PERIODS:
            raise ReportPeriodError("period must be daily, weekly, monthly, or custom")
        zone = cls._local_zone()
        if period == "custom":
            if not start_date or not end_date:
                raise ReportPeriodError("custom reports require start_date and end_date")
            try:
                start = date.fromisoformat(str(start_date))
                end = date.fromisoformat(str(end_date))
            except ValueError as exc:
                raise ReportPeriodError("Dates must use YYYY-MM-DD") from exc
            if end < start:
                raise ReportPeriodError("end_date must not precede start_date")
            return (
                datetime.combine(start, time.min, tzinfo=zone),
                datetime.combine(end + timedelta(days=1), time.min, tzinfo=zone),
            )
        try:
            selected = date.fromisoformat(str(anchor)) if anchor else timezone.localdate()
        except ValueError as exc:
            raise ReportPeriodError("date must use YYYY-MM-DD") from exc
        if period == "weekly":
            selected -= timedelta(days=selected.weekday())
        elif period == "monthly":
            selected = selected.replace(day=1)
        start = datetime.combine(selected, time.min, tzinfo=zone)
        if period == "daily":
            end = start + timedelta(days=1)
        elif period == "weekly":
            end = start + timedelta(days=7)
        else:
            next_month = (selected.replace(day=28) + timedelta(days=4)).replace(day=1)
            end = datetime.combine(next_month, time.min, tzinfo=zone)
        return start, end

    @staticmethod
    def _money(value):
        return Decimal(value or 0)

    @staticmethod
    def _add(bucket, currency, value):
        bucket[str(currency or "UNKNOWN").upper()] += abs(Decimal(value or 0))

    @staticmethod
    def _strings(bucket):
        return {currency: str(value.quantize(Decimal("0.00000001"))) for currency, value in sorted(bucket.items())}

    @classmethod
    def _deduplicated_rows(cls, start, end):
        """Return one ledger row per operation using PostgreSQL windowing.

        Historical reports previously materialized every transaction and
        deduplicated correlation IDs in Python. The window keeps the same
        earliest-row semantics while allowing all report sums to be grouped in
        PostgreSQL. No balances, snapshots, or provider data are cached.
        """
        operation_key = Coalesce(
            Cast("operation_context__correlation_id", CharField()),
            F("idempotency_key"),
            Cast("id", CharField()),
            Value("tx:unknown"),
            output_field=CharField(),
        )
        return (
            Transaction.objects.filter(
                created_at__gte=start.astimezone(dt_timezone.utc),
                created_at__lt=end.astimezone(dt_timezone.utc),
            )
            .annotate(operation_key=operation_key)
            .annotate(
                operation_row=Window(
                    expression=RowNumber(),
                    partition_by=[F("operation_key")],
                    order_by=[F("created_at").asc(), F("id").asc()],
                )
            )
            .filter(operation_row=1)
            .annotate(
                report_currency=Coalesce(
                    F("target_currency"),
                    F("currency"),
                    Value("UNKNOWN"),
                    output_field=CharField(),
                ),
                absolute_amount=Abs(F("amount")),
            )
        )

    @classmethod
    def _build_database_report(cls, start, end, period):
        """Aggregate report totals in PostgreSQL without loading ledger rows."""
        money = DecimalField(max_digits=30, decimal_places=8)
        zero = Value(Decimal("0"), output_field=money)
        amount = F("absolute_amount")

        def metric(**conditions):
            filters = Q(**conditions)
            return Sum(
                Case(
                    When(filters, then=amount),
                    default=zero,
                    output_field=money,
                ),
                default=Decimal("0"),
            )

        rows = cls._deduplicated_rows(start, end).values("report_currency").annotate(
            operation_count=Count("id"),
            pending=metric(status="pending"),
            completed=metric(status="approved"),
            failed_rejected=metric(status__in=["rejected", "failed", "cancelled"]),
            deposits=metric(status="approved", transaction_type="deposit"),
            withdrawals=metric(status="approved", transaction_type="withdrawal"),
            purchases=metric(status="approved", transaction_type="purchase"),
            transfers=metric(status="approved", transaction_type="transfer"),
            shipping_credits=metric(
                status="approved", transaction_type="deposit",
                operation_context__flow_type__in=["shipping", "agent_shipping", "agent_admin_shipping"],
            ),
            cashouts=metric(status="approved", transaction_type="cashout"),
            refunds=Sum(
                Case(
                    When(
                        status="approved", transaction_type="refund",
                        operation_context__commission_reversal_of__isnull=True,
                        then=amount,
                    ),
                    default=zero,
                    output_field=money,
                ),
                default=Decimal("0"),
            ),
            compensations=metric(status="approved", transaction_type="compensation"),
            agent_commission=metric(status="approved", transaction_type="commission"),
            commission_reversals=Sum(
                Case(
                    When(
                        status="approved", transaction_type="refund",
                        operation_context__commission_reversal_of__isnull=False,
                        then=amount,
                    ),
                    default=zero,
                    output_field=money,
                ),
                default=Decimal("0"),
            ),
        )

        totals = {key: defaultdict(Decimal) for key in (
            "revenue", "provider_cost", "gross_profit", "agent_commission",
            "net_profit", "deposits", "withdrawals", "purchases", "transfers",
            "shipping_credits", "cashouts", "refunds", "compensations", "commission_reversals",
        )}
        status_totals = {key: defaultdict(Decimal) for key in ("pending", "completed", "failed_rejected")}
        operation_count = 0

        for row in rows:
            currency = str(row["report_currency"] or "UNKNOWN").upper()
            operation_count += row["operation_count"] or 0
            for key in status_totals:
                status_totals[key][currency] += cls._money(row[key])
            for key in ("deposits", "withdrawals", "purchases", "transfers", "shipping_credits", "cashouts", "refunds", "compensations", "agent_commission", "commission_reversals"):
                totals[key][currency] += cls._money(row[key])
            totals["revenue"][currency] += cls._money(row["purchases"])

        provider_rows = (
            cls._deduplicated_rows(start, end)
            .filter(status="approved", transaction_type="purchase")
            .annotate(
                provider_currency=KeyTextTransform("provider_cost_currency", "operation_context"),
                provider_amount=Cast(
                    KeyTextTransform("provider_cost_amount", "operation_context"), money
                ),
            )
            .filter(provider_currency__isnull=False, provider_amount__isnull=False)
            .values("provider_currency")
            .annotate(provider_cost=Sum("provider_amount", default=Decimal("0")))
        )
        for row in provider_rows:
            currency = str(row["provider_currency"] or "UNKNOWN").upper()
            totals["provider_cost"][currency] += cls._money(row["provider_cost"])

        currencies = set(totals["revenue"]) | set(totals["provider_cost"]) | set(totals["agent_commission"])
        currencies |= set(totals["refunds"]) | set(totals["compensations"]) | set(totals["commission_reversals"])
        for currency in currencies:
            gross = totals["revenue"][currency] - totals["provider_cost"][currency]
            totals["gross_profit"][currency] = gross
            totals["net_profit"][currency] = (
                gross - totals["agent_commission"][currency]
                + totals["commission_reversals"][currency]
                - totals["refunds"][currency] - totals["compensations"][currency]
            )

        return {
            "period": period,
            "timezone": getattr(settings, "TIME_ZONE", "UTC"),
            "boundary": {
                "start_inclusive": start.isoformat(),
                "end_exclusive": end.isoformat(),
            },
            "source_of_truth": "transactions",
            "display_only_current_equivalents": False,
            "totals": {name: cls._strings(values) for name, values in totals.items()},
            "status_totals": {name: cls._strings(values) for name, values in status_totals.items()},
            "operation_count": operation_count,
        }

    @classmethod
    def build(cls, *, period="daily", anchor=None, start_date=None, end_date=None):
        start, end = cls.boundaries(
            period=period, anchor=anchor, start_date=start_date, end_date=end_date
        )
        return cls._build_database_report(start, end, period)

        rows = Transaction.objects.filter(
            created_at__gte=start.astimezone(dt_timezone.utc),
            created_at__lt=end.astimezone(dt_timezone.utc),
        ).order_by("created_at", "id")

        totals = {key: defaultdict(Decimal) for key in (
            "revenue", "provider_cost", "gross_profit", "agent_commission",
            "net_profit", "deposits", "withdrawals", "purchases", "transfers",
            "shipping_credits", "cashouts", "refunds", "compensations", "commission_reversals",
        )}
        status_totals = {key: defaultdict(Decimal) for key in ("pending", "completed", "failed_rejected")}
        operation_ids = set()

        for tx in rows:
            # Transactions are the sole operation source. Payment, Shipping,
            # Request and APITransaction are linked metadata, not extra sales.
            operation_key = (tx.operation_context or {}).get("correlation_id") or tx.idempotency_key or f"tx:{tx.id}"
            if operation_key in operation_ids:
                continue
            operation_ids.add(operation_key)
            currency = tx.target_currency or tx.currency
            amount = abs(Decimal(tx.amount or 0))
            if tx.status == "pending":
                cls._add(status_totals["pending"], currency, amount)
                continue
            if tx.status in {"rejected", "failed", "cancelled"}:
                cls._add(status_totals["failed_rejected"], currency, amount)
                continue
            if tx.status != "approved":
                continue
            cls._add(status_totals["completed"], currency, amount)
            tx_type = tx.transaction_type
            if tx_type == "purchase":
                cls._add(totals["purchases"], currency, amount)
                cls._add(totals["revenue"], currency, amount)
                provider_amount = (tx.operation_context or {}).get("provider_cost_amount")
                provider_currency = (tx.operation_context or {}).get("provider_cost_currency")
                if provider_amount is not None and provider_currency:
                    cls._add(totals["provider_cost"], provider_currency, provider_amount)
            elif tx_type == "commission":
                cls._add(totals["agent_commission"], currency, amount)
            elif tx_type == "deposit":
                cls._add(totals["deposits"], currency, amount)
                if (tx.operation_context or {}).get("flow_type") in {"shipping", "agent_shipping", "agent_admin_shipping"}:
                    cls._add(totals["shipping_credits"], currency, amount)
            elif tx_type == "withdrawal":
                cls._add(totals["withdrawals"], currency, amount)
            elif tx_type == "transfer":
                cls._add(totals["transfers"], currency, amount)
            elif tx_type == "cashout":
                cls._add(totals["cashouts"], currency, amount)
            elif tx_type == "refund":
                if (tx.operation_context or {}).get("commission_reversal_of"):
                    cls._add(totals["commission_reversals"], currency, amount)
                else:
                    cls._add(totals["refunds"], currency, amount)

        currencies = set(totals["revenue"]) | set(totals["provider_cost"]) | set(totals["agent_commission"])
        currencies |= set(totals["refunds"]) | set(totals["compensations"]) | set(totals["commission_reversals"])
        for currency in currencies:
            gross = totals["revenue"][currency] - totals["provider_cost"][currency]
            totals["gross_profit"][currency] = gross
            totals["net_profit"][currency] = (
                gross - totals["agent_commission"][currency]
                + totals["commission_reversals"][currency]
                - totals["refunds"][currency] - totals["compensations"][currency]
            )

        return {
            "period": period,
            "timezone": getattr(settings, "TIME_ZONE", "UTC"),
            "boundary": {
                "start_inclusive": start.isoformat(),
                "end_exclusive": end.isoformat(),
            },
            "source_of_truth": "transactions",
            "display_only_current_equivalents": False,
            "totals": {name: cls._strings(values) for name, values in totals.items()},
            "status_totals": {name: cls._strings(values) for name, values in status_totals.items()},
            "operation_count": len(operation_ids),
        }
