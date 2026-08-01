# Full smoke test for wallet + currency + purchase flows
import os
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from users.models import User
from wallets.models import Wallet, ExchangeRate
from wallets.services import WalletService
from store.models import Section, ExternalProduct, StoreProduct
from third_party_apis.models import ThirdPartyAPI
from transactions.services.purchase_service import PurchaseService
from all_requests.models import Request
from shipping.models import Shipping
from shipping.views import ShippingViewSet


class Command(BaseCommand):
    help = "Run a full smoke test for wallets, currency, and purchases."

    def handle(self, *args, **options):
        self.stdout.write("== FULL SMOKE TEST START ==")

        # Ensure exchange rate exists
        rate = ExchangeRate.objects.order_by("-updated_at").first()
        if not rate:
            rate = ExchangeRate.objects.create(usd_to_syp=Decimal("116"))
        self.stdout.write(f"Exchange rate: 1 USD = {rate.usd_to_syp} SYP")

        # Ensure test user
        user, _ = User.objects.get_or_create(
            name="smoke_test_user",
            defaults={
                "full_name": "Smoke Test User",
                "email": "smoke_test_user@example.com",
                "is_active": True,
            },
        )

        # Ensure wallets
        wallet_usd = WalletService.get_or_create_wallet(user, "USD")
        wallet_syp = WalletService.get_or_create_wallet(user, "SYP")

        # Seed balances via pending transactions
        if wallet_usd.available_balance < Decimal("100"):
            tx = wallet_usd.add_funds(Decimal("200"), "Smoke test funds USD")
            wallet_usd.approve_transaction(tx)
        if wallet_syp.available_balance < Decimal("100000"):
            tx = wallet_syp.add_funds(Decimal("500000"), "Smoke test funds SYP")
            wallet_syp.approve_transaction(tx)

        self.stdout.write(
            f"Wallets ready: USD={wallet_usd.available_balance}, SYP={wallet_syp.available_balance}"
        )

        # Ensure API config
        api, _ = ThirdPartyAPI.objects.get_or_create(
            provider="mock-smoke",
            defaults={
                "name": "Mock Smoke API",
                "base_url": "https://mock.example.com",
                "is_active": True,
            },
        )

        # Ensure section
        section, _ = Section.objects.get_or_create(
            name_en="Smoke Test Section",
            name_ar="Smoke Test Section",
            defaults={"is_active": True},
        )

        # Ensure external product
        external_product, _ = ExternalProduct.objects.get_or_create(
            api_config=api,
            external_id="smoke_ext_001",
            defaults={
                "name": "Smoke External Product",
                "description": "Smoke test external product",
                "base_price": Decimal("10.00"),
                "required_fields_json": [{"field_name": "phone_number"}],
                "is_active": True,
            },
        )

        # Ensure store products (USD + SYP)
        store_product_usd, _ = StoreProduct.objects.get_or_create(
            external_product=external_product,
            defaults={
                "section": section,
                "name": "Smoke Store USD",
                "price": Decimal("5.00"),
                "currency": "USD",
                "is_active": True,
            },
        )
        store_product_syp, _ = StoreProduct.objects.get_or_create(
            external_product=external_product,
            defaults={
                "section": section,
                "name": "Smoke Store SYP",
                "price": Decimal("65000.00"),
                "currency": "SYP",
                "is_active": True,
            },
        )

        # Use mock API for purchase flow
        os.environ["USE_MOCK_API"] = "1"

        # Purchase USD product with USD wallet
        result_usd = PurchaseService.process_purchase(
            store_product_id=store_product_usd.id,
            user=user,
            user_inputs={"phone_number": "0990000000"},
            wallet_currency="USD",
        )
        self._assert_success("USD purchase", result_usd)

        # Purchase USD product with SYP wallet (cross-currency)
        result_cross = PurchaseService.process_purchase(
            store_product_id=store_product_usd.id,
            user=user,
            user_inputs={"phone_number": "0990000000"},
            wallet_currency="SYP",
        )
        self._assert_success("Cross-currency purchase (USD product, SYP wallet)", result_cross)

        # Purchase SYP product with SYP wallet
        result_syp = PurchaseService.process_purchase(
            store_product_id=store_product_syp.id,
            user=user,
            user_inputs={"phone_number": "0990000000"},
            wallet_currency="SYP",
        )
        self._assert_success("SYP purchase", result_syp)

        # Shipping request -> approve -> wallet credit
        request = Request.objects.create(
            user=user,
            request_type="payment",
            status="pending",
            title="Smoke Test Topup",
            description="Smoke test request",
            amount=Decimal("15.00"),
            currency="USD",
        )
        shipping = Shipping.objects.get(request=request)
        view = ShippingViewSet()
        if not view._process_payment(shipping):
            raise RuntimeError("Shipping payment failed")

        wallet_usd.refresh_from_db()
        self.stdout.write(f"Shipping deposit OK, USD balance now: {wallet_usd.available_balance}")

        self.stdout.write("== FULL SMOKE TEST PASSED ==")

    def _assert_success(self, label, result):
        if not result.get("success"):
            raise RuntimeError(f"{label} failed: {result}")
        self.stdout.write(f"{label}: OK")
