from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal
from django.db import transaction

class Command(BaseCommand):
    help = 'Fix server issues and test purchase flow'

    def handle(self, *args, **options):
        self.stdout.write('🔧 STARK CARD SERVER FIX SCRIPT')
        self.stdout.write('=' * 40)

        self.fix_payment_methods()
        self.check_alaaeddin_api()
        self.check_store_products()
        self.test_purchase_flow()

        self.stdout.write('=' * 40)
        self.stdout.write('✅ Fix script completed')

    def fix_payment_methods(self):
        """Create payment methods if they don't exist"""
        try:
            from payment_methods.models import PaymentMethod
            self.stdout.write('=== PAYMENT METHODS ===')

            if PaymentMethod.objects.count() == 0:
                self.stdout.write('Creating Stark Wallet payment method...')
                PaymentMethod.objects.create(
                    title="Stark Wallet",
                    name="stark_wallet",
                    currency="SYP",
                    account_details="Use your Stark Card wallet balance",
                    instructions="Payment will be deducted from your wallet balance",
                    description="Pay using your Stark Card wallet",
                    is_active=True
                )
                self.stdout.write('✓ Created Stark Wallet payment method')
            else:
                self.stdout.write(f'✓ {PaymentMethod.objects.count()} payment methods already exist')

            active_count = PaymentMethod.objects.filter(is_active=True).count()
            self.stdout.write(f'Active payment methods: {active_count}')

        except ImportError as e:
            self.stdout.write(f'PaymentMethod model not found: {e}')

    def check_alaaeddin_api(self):
        """Check Alaaeddin API configuration"""
        from third_party_apis.models import ThirdPartyAPI
        self.stdout.write('\n=== ALAAEDDIN API ===')

        api = ThirdPartyAPI.objects.filter(provider='alaaeddin', is_active=True).first()
        if api:
            self.stdout.write(f'Name: {api.name}')
            self.stdout.write(f'Base URL: {api.base_url}')
            self.stdout.write(f'Is Active: {api.is_active}')
            self.stdout.write(f'Has API key: {bool(api.encrypted_api_key)}')

            # Test get_api_key method
            try:
                key = api.get_api_key()
                self.stdout.write(f'API key accessible: {bool(key)}')
            except Exception as e:
                self.stdout.write(f'Error accessing API key: {e}')
        else:
            self.stdout.write('No active Alaaeddin API found')

    def check_store_products(self):
        """Check if store products exist"""
        from store.models import StoreProduct
        self.stdout.write('\n=== STORE PRODUCTS ===')

        products = StoreProduct.objects.filter(is_active=True)
        self.stdout.write(f'Active store products: {products.count()}')

        for p in products[:3]:  # Show first 3
            self.stdout.write(f'  - {p.name} (ID: {p.id}, Price: {p.price} {p.currency})')

    def test_purchase_flow(self):
        """Test the purchase flow with correct parameters"""
        self.stdout.write('\n=== TESTING PURCHASE FLOW ===')

        try:
            from django.contrib.auth import get_user_model
            from store.models import StoreProduct
            from transactions.services.purchase_service import PurchaseService
            import inspect

            User = get_user_model()

            # Check service signature
            sig = inspect.signature(PurchaseService.process_purchase)
            self.stdout.write(f'PurchaseService.process_purchase{sig}')

            # Get test user
            user = User.objects.filter(is_active=True).first()
            if not user:
                self.stdout.write('No active users found')
                return

            self.stdout.write(f'Test User: {user.email}')

            # Get store product
            store_product = StoreProduct.objects.filter(is_active=True).first()
            if not store_product:
                self.stdout.write('No active store products found')
                return

            self.stdout.write(f'Store Product: {store_product.name} (ID: {store_product.id})')

            # Test purchase with correct parameters
            user_inputs = {"amount": "100"}  # For Syriatel units

            self.stdout.write(f'Attempting purchase with store_product_id={store_product.id}')

            result = PurchaseService.process_purchase(
                store_product_id=store_product.id,
                user=user,
                user_inputs=user_inputs
            )

            self.stdout.write(f'Result: {result}')

        except Exception as e:
            self.stdout.write(f'Error in purchase test: {e}')
            import traceback
            traceback.print_exc()
