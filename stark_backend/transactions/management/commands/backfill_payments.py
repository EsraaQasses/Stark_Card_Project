# transactions/management/commands/backfill_payments.py
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from decimal import Decimal
import re

from transactions.models import Transaction
from payment.models import Payment
from third_party_apis.models import APITransaction
from store.models import StoreProduct, ExternalProduct
from store.services.currency_service import CurrencyService
from store.services.price_service import PriceService


class Command(BaseCommand):
    help = "Backfill Payment records for approved purchase transactions."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Apply changes (default is dry-run).")
        parser.add_argument("--limit", type=int, default=0, help="Limit number of transactions to process.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        limit = options["limit"] or 0

        qs = Transaction.objects.filter(
            transaction_type="purchase",
            status="approved",
            payment__isnull=True,
        ).select_related("user", "wallet")

        if limit:
            qs = qs[:limit]

        total = qs.count()
        self.stdout.write(f"Found {total} purchase transactions without Payment.")

        created = 0
        skipped = 0

        for tx in qs:
            store_product = None
            api_tx = APITransaction.objects.filter(internal_transaction=tx).order_by("-created_at").first()
            external_id = None
            user_inputs = {}

            if api_tx and isinstance(api_tx.request_payload, dict):
                product_data = api_tx.request_payload.get("product_data") or {}
                external_id = product_data.get("external_id")
                user_inputs = product_data.get("user_inputs") or {}

            if external_id:
                external_product = ExternalProduct.objects.filter(external_id=external_id).first()
                if external_product:
                    store_product = StoreProduct.objects.filter(external_product=external_product).first()

            if not store_product:
                note = tx.note or ""
                m = re.search(r"Purchase:\s*(.+?)(?:\s*\(|$)", note)
                if m:
                    name = m.group(1).strip()
                    store_product = StoreProduct.objects.filter(name=name).first()

            if not store_product:
                skipped += 1
                self.stdout.write(f"Skip tx={tx.id}: store_product not found")
                continue

            base_price = Decimal(str(store_product.price))
            profit_pct = PriceService.calculate_user_profit_percentage(tx.user)

            # Convert transaction amount into store product currency for final_price
            tx_amount = Decimal(str(abs(tx.amount)))
            if tx.currency and store_product.currency and tx.currency.upper() != store_product.currency.upper():
                try:
                    final_price = CurrencyService.convert_amount(
                        tx_amount, tx.currency, store_product.currency
                    ).quantize(Decimal("0.00000001"))
                except Exception:
                    final_price = base_price
            else:
                final_price = tx_amount

            if not apply_changes:
                created += 1
                self.stdout.write(f"DRY-RUN create payment for tx={tx.id} product={store_product.id}")
                continue

            with db_transaction.atomic():
                payment = Payment.objects.create(
                    user=tx.user,
                    wallet=tx.wallet,
                    store_product=store_product,
                    base_price=base_price,
                    profit_percentage=profit_pct,
                    final_price=final_price,
                    currency=store_product.currency or tx.currency or "USD",
                    status="success",
                    external_transaction_id=getattr(api_tx, "external_transaction_id", None),
                    user_inputs=user_inputs or {},
                    notes=f"Backfilled payment for TX#{tx.id}",
                )
                tx.payment = payment
                tx.save(update_fields=["payment"])
                created += 1

        self.stdout.write(f"Done. Created: {created}, Skipped: {skipped}, Dry-run: {not apply_changes}")
