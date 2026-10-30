from django.db.models import Count, Sum
from rest_framework.exceptions import MethodNotAllowed


def shipping_summary(queryset):
    """Aggregate the entire filtered, authorized queryset before pagination."""
    rows = queryset.order_by().values('currency', 'status').annotate(count=Count('pk'), amount=Sum('amount'))
    counts, totals = {}, {}
    for row in rows:
        state, currency = row['status'], row['currency']
        counts[state] = counts.get(state, 0) + row['count']
        totals.setdefault(currency, {})[state] = str(row['amount'])
    return {'total_count': sum(counts.values()), 'counts_by_status': counts, 'amounts_by_currency': totals}


class ShippingSummaryMixin:
    # Financial snapshots and status transitions belong to dedicated actions.
    # Generic ModelViewSet writes would bypass approval and ledger services.
    def update(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def destroy(self, request, *args, **kwargs):
        raise MethodNotAllowed(request.method)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        summary = shipping_summary(queryset)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        response = self.get_paginated_response(serializer.data)
        response.data['summary'] = summary
        return response
