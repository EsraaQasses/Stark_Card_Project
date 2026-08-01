# third_party_apis/management/commands/refresh_external_product_statuses.py
import logging
from django.core.management.base import BaseCommand
from third_party_apis.services.api_service import APIService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Refresh external product active/query flags without full resync"

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            type=str,
            help="Filter by provider (e.g. alaaeddin)",
        )

    def handle(self, *args, **options):
        provider = options.get("provider")
        try:
            result = APIService.refresh_external_product_statuses(provider=provider)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Status refresh done. Checked: {result['checked']}, Updated: {result['updated']}"
                )
            )
        except Exception as exc:
            logger.error(f"Status refresh failed: {exc}")
            self.stdout.write(self.style.ERROR(f"Status refresh failed: {exc}"))
