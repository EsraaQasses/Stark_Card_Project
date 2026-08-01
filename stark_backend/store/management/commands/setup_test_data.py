from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal
from store.models import Section, StoreProduct, ExternalProduct
from third_party_apis.models import ThirdPartyAPI
from payment_methods.models import PaymentMethod

class Command(BaseCommand):
    help = 'Setup test data for purchase testing'

    def handle(self, *args, **options):
        User = get_user_model()

        # 1. Get or create test user
        user, created = User.objects.get_or_create(
            email="test_purchase@stark-card.com",
            defaults={
                "name": "Test Purchase User",
                "is_active": True
            }
        )

        if created:
            user.set_password("TestPass123!")
            user.save()
            self.stdout.write(f"Created test user: {user.email}")

        # 2. Add funds to user wallet
        try:
            from wallets.models import Wallet
            wallet, _ = Wallet.objects.get_or_create(user=user, currency="USD")

            # Add test funds using existing add_funds method
            transaction = wallet.add_funds(Decimal('50000'), "Test funds for development")
            self.stdout.write(f"Added 50,000 to wallet for {user.email}")

            # Approve the transaction to make funds available
            wallet.approve_transaction(transaction)
            self.stdout.write(f"Approved transaction - Available balance: ${wallet.available_balance}")

        except Exception as e:
            self.stdout.write(f"Error adding funds: {e}")

        # 3. Create payment method if none exists
        if PaymentMethod.objects.count() == 0:
            PaymentMethod.objects.create(
                name="stark_wallet",
                title="Stark Wallet",
                currency="USD",
                account_details="Use your Stark Card wallet balance",
                instructions="Payment will be deducted from your wallet balance",
                description="Pay using your Stark Card wallet",
                is_active=True
            )
            self.stdout.write("Created payment method")

        # 4. Create test product
        api = ThirdPartyAPI.objects.filter(is_active=True).first()
        if api:
            section, _ = Section.objects.get_or_create(
                name_en="Test Products",
                name_ar="منتجات تجريبية",
                defaults={"is_active": True}
            )

            # Create external product
            external_product, _ = ExternalProduct.objects.get_or_create(
                api_config=api,
                external_id="test_mobile_001",
                defaults={
                    "name": "Test Mobile Units",
                    "description": "Test mobile credit units",
                    "base_price": Decimal("1000"),
                    "category": "mobile",
                    "is_active": True
                }
            )

            # Create store product
            store_product, created = StoreProduct.objects.get_or_create(
                external_product=external_product,
                defaults={
                    "section": section,
                    "name": "Test Mobile Credit",
                    "price": Decimal("1100"),
                    "currency": "USD",
                    "is_active": True
                }
            )

            if created:
                self.stdout.write(f"Created test product: {store_product.name} (ID: {store_product.id})")
        else:
            self.stdout.write("Warning: No active ThirdPartyAPI found for test product")

        self.stdout.write(self.style.SUCCESS("Test data setup complete!"))
        self.stdout.write("\nTest user: test_purchase@stark-card.com")
        self.stdout.write("Test password: TestPass123!")
        self.stdout.write("Wallet balance: 50,000 USD")
