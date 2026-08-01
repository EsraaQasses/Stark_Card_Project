from django.core.management.base import BaseCommand
from django.db import transaction

from all_requests.models import Request


class Command(BaseCommand):
    help = "Retag legacy cashout requests (request_type=payment) as request_type=cashout"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change without saving.",
        )

    def handle(self, *args, **options):
        dry = options.get("dry_run", False)
        qs = Request.objects.filter(request_type="payment")

        def is_cashout(req):
            data = req.user_input_data or {}
            cashout_type = (data.get("cashout_type") or "").lower().strip()
            shipping_channel = (data.get("shipping_channel") or "").lower().strip()
            return cashout_type == "agent" or shipping_channel == "admin" or bool(data.get("cashout_tx_id"))

        to_update = [r for r in qs if is_cashout(r)]
        self.stdout.write(f"Found {len(to_update)} legacy cashout requests.")

        if dry:
            for r in to_update[:20]:
                self.stdout.write(f"[DRY] id={r.id} title={r.title}")
            return

        with transaction.atomic():
            for r in to_update:
                r.request_type = "cashout"
                if r.title and r.title.startswith("Payment Request"):
                    r.title = r.title.replace("Payment Request", "Cashout Request", 1)
                r.save(update_fields=["request_type", "title"])

        self.stdout.write("Done.")
