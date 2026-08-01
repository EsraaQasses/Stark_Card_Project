# third_party_apis/management/commands/check_pending_purchases.py
import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from third_party_apis.models import APITransaction
from third_party_apis.services.api_service import APIService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Check and update status for pending purchase transactions across providers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=24,
            help="Check API transactions from last N hours (default: 24).",
        )
        parser.add_argument(
            "--provider",
            type=str,
            help="Limit to a specific provider (e.g., alaaeddin, stark-card).",
        )
        parser.add_argument(
            "--api-id",
            type=int,
            help="Limit to a specific API configuration ID.",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        provider = options.get("provider")
        api_id = options.get("api_id")

        try:
            since_time = timezone.now() - timedelta(hours=hours)

            queryset = APITransaction.objects.filter(
                created_at__gte=since_time,
                endpoint_used="/api/purchase",
                internal_transaction__status="pending",
            ).select_related("api_config", "internal_transaction")

            if provider:
                queryset = queryset.filter(api_config__provider=provider)
            if api_id:
                queryset = queryset.filter(api_config_id=api_id)

            self.stdout.write(f"Checking {queryset.count()} pending purchases from last {hours} hours")

            updated_count = 0
            error_count = 0

            for api_tx in queryset:
                external_order_id = api_tx.external_transaction_id
                if not external_order_id:
                    # Try to fallback to local_id in response payload
                    resp = api_tx.response_payload or {}
                    external_order_id = resp.get("local_id") or resp.get("order_uuid")
                if not external_order_id:
                    continue

                result = APIService.update_order_status(api_tx.api_config_id, external_order_id)
                if result.get("success"):
                    updated_count += 1
                else:
                    error_count += 1
                    logger.warning("Status check failed for %s: %s", external_order_id, result.get("error"))

            self.stdout.write(
                self.style.SUCCESS(
                    f"Done. Updated: {updated_count}, Errors: {error_count}"
                )
            )

        except Exception as exc:
            logger.error("Pending purchase status check failed: %s", exc, exc_info=True)
            self.stdout.write(self.style.ERROR(f"Failed: {exc}"))
