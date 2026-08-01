"""Validated, permission-safe filters shared by request list endpoints."""

from datetime import datetime, time, timedelta
from decimal import Decimal, InvalidOperation

import django_filters
from django import forms
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.exceptions import ValidationError as DRFValidationError


class BoundaryDateTimeField(forms.Field):
    def __init__(self, *args, end=False, **kwargs):
        self.end = end
        super().__init__(*args, **kwargs)

    def to_python(self, value):
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            parsed = value
        else:
            raw = str(value).strip()
            parsed = None
            try:
                parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                try:
                    parsed_date = datetime.strptime(raw, "%Y-%m-%d").date()
                    parsed = datetime.combine(parsed_date, time.max if self.end else time.min)
                except ValueError as exc:
                    raise forms.ValidationError("Use an ISO date or datetime.") from exc
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed


class DateTimeBoundaryFilter(django_filters.Filter):
    field_class = BoundaryDateTimeField

    def __init__(self, *args, end=False, **kwargs):
        kwargs["end"] = end
        super().__init__(*args, **kwargs)


class SecureFilterBackend(DjangoFilterBackend):
    """Do not silently ignore invalid filter values."""

    def filter_queryset(self, request, queryset, view):
        filterset = self.get_filterset(request, queryset, view)
        if filterset is None:
            return queryset
        if not filterset.is_valid():
            errors = {
                key: [str(error) for error in value]
                for key, value in filterset.errors.items()
            }
            raise DRFValidationError({"filters": errors})
        constraint_errors = filterset.validate_constraints()
        if constraint_errors:
            raise DRFValidationError({"filters": constraint_errors})
        return filterset.qs


class RequestFilterSet(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(field_name="status", choices=(
        ("pending", "Pending"), ("shipping", "Shipping"), ("in_progress", "In Progress"),
        ("objection", "Objection"), ("completed", "Completed"), ("rejected", "Rejected"),
    ))
    request_type = django_filters.ChoiceFilter(field_name="request_type", choices=(
        ("payment", "Payment"), ("cashout", "Cashout"), ("support", "Support"),
        ("refund", "Refund"), ("other", "Other"),
    ))
    user = django_filters.NumberFilter(field_name="user_id")
    currency = django_filters.ChoiceFilter(field_name="currency", choices=(("USD", "USD"), ("SYP", "SYP")))
    created_from = DateTimeBoundaryFilter(field_name="created_at", lookup_expr="gte")
    created_to = DateTimeBoundaryFilter(field_name="created_at", lookup_expr="lte", end=True)
    amount_min = django_filters.NumberFilter(field_name="amount", lookup_expr="gte")
    amount_max = django_filters.NumberFilter(field_name="amount", lookup_expr="lte")
    search = django_filters.CharFilter(method="filter_search")
    ordering = django_filters.CharFilter(method="filter_ordering")

    ordering_fields = {"created_at", "id", "amount", "status", "currency"}
    search_fields = ("title", "description", "user__name", "user__full_name", "user__email")

    def filter_search(self, queryset, name, value):
        query = Q()
        for field in self.search_fields:
            query |= Q(**{f"{field}__icontains": value})
        return queryset.filter(query)

    def filter_ordering(self, queryset, name, value):
        return queryset.order_by(*self._validated_ordering(value))

    def _validated_ordering(self, value):
        fields = [part.strip() for part in str(value).split(",") if part.strip()]
        invalid = [field for field in fields if field.lstrip("-") not in self.ordering_fields]
        if invalid:
            raise DjangoValidationError(
                f"Invalid ordering field(s): {', '.join(invalid)}."
            )
        return fields or ["-created_at", "-id"]

    def clean(self):
        cleaned = super().clean()
        if self.errors:
            return cleaned
        created_from = cleaned.get("created_from")
        created_to = cleaned.get("created_to")
        if created_from and created_to:
            if created_from > created_to:
                raise forms.ValidationError({"created_to": "created_to must be on or after created_from."})
            if created_to - created_from > timedelta(days=90):
                raise forms.ValidationError({"created_to": "The maximum custom date range is 90 days."})
        for field in ("amount_min", "amount_max"):
            value = cleaned.get(field)
            if value is not None:
                try:
                    if not value.is_finite():
                        raise InvalidOperation
                except AttributeError:
                    raise forms.ValidationError({field: "Amount must be finite."})
        if cleaned.get("amount_min") is not None and cleaned.get("amount_max") is not None:
            if cleaned["amount_min"] > cleaned["amount_max"]:
                raise forms.ValidationError({"amount_max": "amount_max must be on or after amount_min."})
        raw_ordering = self.data.get("ordering")
        if raw_ordering:
            try:
                self._validated_ordering(raw_ordering)
            except DjangoValidationError as exc:
                raise forms.ValidationError({"ordering": exc.messages})
        return cleaned

    def validate_constraints(self):
        cleaned = self.form.cleaned_data
        errors = {}
        created_from, created_to = cleaned.get("created_from"), cleaned.get("created_to")
        if created_from and created_to:
            if created_from > created_to:
                errors["created_to"] = ["created_to must be on or after created_from."]
            elif created_to - created_from > timedelta(days=90):
                errors["created_to"] = ["The maximum custom date range is 90 days."]
        if cleaned.get("amount_min") is not None and cleaned.get("amount_max") is not None and cleaned["amount_min"] > cleaned["amount_max"]:
            errors["amount_max"] = ["amount_max must be on or after amount_min."]
        raw_ordering = self.data.get("ordering")
        if raw_ordering:
            try:
                self._validated_ordering(raw_ordering)
            except DjangoValidationError as exc:
                errors["ordering"] = exc.messages
        return errors


class ShippingFilterSet(RequestFilterSet):
    request_type = None
    status = django_filters.ChoiceFilter(field_name="status", choices=(
        ("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"),
        ("processing", "Processing"), ("failed", "Failed"),
    ))
    reviewer = django_filters.NumberFilter(field_name="approved_by_id")
    agent = django_filters.NumberFilter(method="filter_agent")
    provider = django_filters.CharFilter(method="filter_provider")
    search_fields = ("user__name", "user__full_name", "user__email", "request__title", "request__description")

    def filter_agent(self, queryset, name, value):
        return queryset.filter(user__agent_id=value)

    def filter_provider(self, queryset, name, value):
        return queryset.filter(request__user_input_data__provider__iexact=value)


class BaseShippingFilterSet(ShippingFilterSet):
    search_fields = ("user__name", "user__full_name", "user__email", "user_input_data")

    def filter_provider(self, queryset, name, value):
        return queryset.filter(user_input_data__provider__iexact=value)


class StandardShippingFilterSet(BaseShippingFilterSet):
    class Meta:
        from shipping.models import StandardShippingRequest
        model = StandardShippingRequest
        fields = []


class AgentShippingFilterSet(BaseShippingFilterSet):
    def filter_agent(self, queryset, name, value):
        return queryset.filter(agent_id=value)

    search_fields = ("user__name", "user__full_name", "user__email", "agent__name", "agent__full_name", "user_input_data")

    class Meta:
        from shipping.models import AgentShippingRequest
        model = AgentShippingRequest
        fields = []


class AgentAdminShippingFilterSet(ShippingFilterSet):
    search_fields = ("agent__name", "agent__full_name", "agent__email", "user_input_data")

    def filter_agent(self, queryset, name, value):
        return queryset.filter(agent_id=value)

    def filter_provider(self, queryset, name, value):
        return queryset.filter(user_input_data__provider__iexact=value)

    class Meta:
        from shipping.models import AgentAdminShippingRequest
        model = AgentAdminShippingRequest
        fields = []


class AllRequestFilterSet(RequestFilterSet):
    reviewer = django_filters.NumberFilter(method="filter_reviewer")
    agent = django_filters.NumberFilter(field_name="user__agent_id")
    provider = django_filters.CharFilter(field_name="user_input_data__provider", lookup_expr="iexact")
    search_fields = RequestFilterSet.search_fields + ("user_input_data",)

    def filter_reviewer(self, queryset, name, value):
        return queryset.filter(shipping__approved_by_id=value)

    class Meta:
        from all_requests.models import Request
        model = Request
        fields = []


class CashoutFilterSet(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(field_name="status", choices=(
        ("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"),
        ("failed", "Failed"), ("cancelled", "Cancelled"),
    ))
    user = django_filters.NumberFilter(field_name="user_id")
    agent = django_filters.NumberFilter(field_name="recipient_id")
    provider = django_filters.CharFilter(method="filter_provider")
    currency = django_filters.ChoiceFilter(field_name="currency", choices=(("USD", "USD"), ("SYP", "SYP")))
    created_from = DateTimeBoundaryFilter(field_name="created_at", lookup_expr="gte")
    created_to = DateTimeBoundaryFilter(field_name="created_at", lookup_expr="lte", end=True)
    amount_min = django_filters.NumberFilter(field_name="amount", lookup_expr="gte")
    amount_max = django_filters.NumberFilter(field_name="amount", lookup_expr="lte")
    search = django_filters.CharFilter(method="filter_search")
    ordering = django_filters.CharFilter(method="filter_ordering")
    ordering_fields = {"created_at", "id", "amount", "status", "currency"}

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(note__icontains=value) | Q(external_reference__icontains=value) |
            Q(user__name__icontains=value) | Q(user__full_name__icontains=value) |
            Q(recipient__name__icontains=value) | Q(recipient__full_name__icontains=value)
        )

    def filter_provider(self, queryset, name, value):
        return queryset.filter(operation_context__provider__iexact=value)

    def filter_ordering(self, queryset, name, value):
        fields = [part.strip() for part in str(value).split(",") if part.strip()]
        invalid = [field for field in fields if field.lstrip("-") not in self.ordering_fields]
        if invalid:
            raise DjangoValidationError(f"Invalid ordering field(s): {', '.join(invalid)}.")
        return queryset.order_by(*(fields or ["-created_at", "-id"]))

    def clean(self):
        cleaned = super().clean()
        if self.errors:
            return cleaned
        start, end = cleaned.get("created_from"), cleaned.get("created_to")
        if start and end and start > end:
            raise forms.ValidationError({"created_to": "created_to must be on or after created_from."})
        if start and end and end - start > timedelta(days=90):
            raise forms.ValidationError({"created_to": "The maximum custom date range is 90 days."})
        if cleaned.get("amount_min") is not None and cleaned.get("amount_max") is not None and cleaned["amount_min"] > cleaned["amount_max"]:
            raise forms.ValidationError({"amount_max": "amount_max must be on or after amount_min."})
        if self.data.get("ordering"):
            fields = [part.strip() for part in str(self.data["ordering"]).split(",") if part.strip()]
            invalid = [field for field in fields if field.lstrip("-") not in self.ordering_fields]
            if invalid:
                raise forms.ValidationError({"ordering": f"Invalid ordering field(s): {', '.join(invalid)}."})
        return cleaned

    def validate_constraints(self):
        cleaned = self.form.cleaned_data
        errors = {}
        start, end = cleaned.get("created_from"), cleaned.get("created_to")
        if start and end:
            if start > end:
                errors["created_to"] = ["created_to must be on or after created_from."]
            elif end - start > timedelta(days=90):
                errors["created_to"] = ["The maximum custom date range is 90 days."]
        if cleaned.get("amount_min") is not None and cleaned.get("amount_max") is not None and cleaned["amount_min"] > cleaned["amount_max"]:
            errors["amount_max"] = ["amount_max must be on or after amount_min."]
        if self.data.get("ordering"):
            fields = [part.strip() for part in str(self.data["ordering"]).split(",") if part.strip()]
            invalid = [field for field in fields if field.lstrip("-") not in self.ordering_fields]
            if invalid:
                errors["ordering"] = [f"Invalid ordering field(s): {', '.join(invalid)}."]
        return errors
