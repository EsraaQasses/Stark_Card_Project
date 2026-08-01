from decimal import Decimal
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model

from wallets.models import Wallet
from store.models import Section, Product, ExternalProduct, StoreProduct
from transactions.models import Transaction
from payment.models import Payment
from third_party_apis.models import ThirdPartyAPI
from users.models import OTPCode


class StoreAPITest(APITestCase):
    def setUp(self):
        User = get_user_model()

        # Create a regular user
        self.user = User.objects.create_user(name='apiuser', password='testpass', full_name='API User')
        self.user.is_active = True
        self.user.save()
        # create verified identity so login works
        from users.models import UserIdentity
        UserIdentity.objects.create(user=self.user, provider='phone', identifier=self.user.phone or '0982416135', is_verified=True)
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.wallet.available_balance = 10000
        self.wallet.save()

        # Create admin user for category endpoints
        self.admin = User.objects.create_user(name='admin1', password='adminpass', full_name='Admin One', role='admin')
        self.admin.is_active = True
        self.admin.is_staff = True
        self.admin.save()
        # ensure admin identity verified
        from users.models import UserIdentity
        UserIdentity.objects.create(user=self.admin, provider='email', identifier=self.admin.email or 'admin@example.com', is_verified=True)

        # Create section, product and external/store product
        self.section = Section.objects.create(name_en='Mobile', name_ar='موبايل')

        self.api = ThirdPartyAPI.objects.create(name='Mock API', provider='stark-card', base_url='https://mock', is_active=True)

        self.external = ExternalProduct.objects.create(
            api_config=self.api,
            external_id='srv-1234',
            name='تحويل وحدات سيريتل',
            base_price=0.01,
            required_fields_json=[{'field_name':'phone_number','field_type':'phone','required':True},{'field_name':'quantity','field_type':'number','required':True}]
        )

        self.product = Product.objects.create(
            section=self.section,
            api_config=self.api,
            external_product=self.external,
            name_en='Convert Syritel Units',
            name_ar='تحويل وحدات سيريتل',
            product_type='amount_based',
            currency='USD',
            base_price=0.01,
            min_amount=1,
            max_amount=100000,
            is_active=True
        )

        self.store_product = StoreProduct.objects.create(
            section=self.section,
            external_product=self.external,
            name='تحويل وحدات سيريتل (Store)',
            description='Store product',
            price=0.01,
            is_active=True
        )

    def authenticate_client(self, user, password=None):
        client = APIClient()
        if getattr(user, "role", None) == "admin":
            client.force_authenticate(user=user)
            return client
        pwd = password or ('testpass' if user == self.user else 'adminpass')
        res = client.post('/api/users/login/', {'name': user.name, 'password': pwd}, format='json')
        token = res.data.get('access')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    def test_register_and_otp_flow(self):
        client = APIClient()
        # Register a new user with phone provider
        payload = {
            'full_name': 'Reg User',
            'name': 'reguser',
            'phone': '0982416136',
            'password': 'strongpass',
            'country': 'Syria',
            'provider': 'phone'
        }

        res = client.post('/api/users/register/', payload, format='json')
        self.assertEqual(res.status_code, 201)

        # OTP should be created
        from users.models import User
        reg_user = User.objects.get(name='reguser')
        otp = OTPCode.objects.filter(user=reg_user).first()
        self.assertIsNotNone(otp)

        # Verify OTP
        verify_res = client.post('/api/users/verify-otp/', {'name': 'reguser', 'otp_code': otp.code}, format='json')
        self.assertEqual(verify_res.status_code, 200)

        # Login should now succeed
        login_res = client.post('/api/users/login/', {'name': 'reguser', 'password': 'strongpass'}, format='json')
        self.assertEqual(login_res.status_code, 200)

    @patch('third_party_apis.services.api_service.ConnectorFactory.get_connector')
    def test_store_endpoints_and_purchase(self, mock_get_connector):
        # Authenticate as regular user
        client = self.authenticate_client(self.user)

        # Sections
        res = client.get('/api/store/user/sections/')
        self.assertEqual(res.status_code, 200)

        # Products list
        res = client.get(f'/api/store/user/products/?section_id={self.section.id}')
        self.assertEqual(res.status_code, 200)

        # Product detail
        res = client.get(f'/api/store/user/products/{self.product.id}/')
        self.assertEqual(res.status_code, 200)

        # Requirements
        res = client.get(f'/api/store/user/products/{self.product.id}/requirements/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(any(r.get('field_name') in ['phone_number','quantity'] for r in res.data))

        # Calculate price
        res = client.get(f'/api/store/user/products/{self.product.id}/calculate_price/?amount=4026')
        self.assertEqual(res.status_code, 200)
        self.assertIn('calculated_price', res.data)

        # Search
        res = client.get('/api/store/user/products/search/?q=تحويل')
        self.assertEqual(res.status_code, 200)

        # Featured
        res = client.get('/api/store/user/featured-products/')
        self.assertEqual(res.status_code, 200)

        # Convert price
        res = client.get('/api/store/user/convert-price/?amount=10&from_currency=USD&to_currency=SYP')
        self.assertEqual(res.status_code, 200)

        # Favorites: add
        res = client.post('/api/store/user/favorites/add/', {'product_id': self.product.id}, format='json')
        self.assertIn(res.status_code, (200,201))

        # Favorites: list
        res = client.get('/api/store/user/favorites/')
        self.assertEqual(res.status_code, 200)

        # Favorites: remove
        res = client.post('/api/store/user/favorites/remove/', {'product_id': self.product.id}, format='json')
        self.assertEqual(res.status_code, 200)

        # Prepare mock connector for purchase
        dummy_connector = MagicMock()
        dummy_connector.execute_purchase.return_value = {
            'success': True,
            'external_transaction_id': 'EXT-TEST-1',
            'order_id': 'ORDER-TEST-1',
            'message': 'Mocked purchase success',
            'status_code': 200
        }
        mock_get_connector.return_value = dummy_connector

        # Perform purchase
        purchase_payload = {
            'store_product_id': self.store_product.id,
            'user_inputs': {
                'phone_number': '0982416135',
                'quantity': 4026
            },
            'amount': 4026 * float(self.store_product.price)
        }

        res = client.post('/api/store/user/purchases/', purchase_payload, format='json')
        self.assertIn(res.status_code, (200, 201))
        self.assertTrue(res.data.get('success'))

    def test_user_purchases_returns_user_inputs_for_pending_and_failed_linked_payments(self):
        client = self.authenticate_client(self.user)

        pending_inputs = {
            "gamer_id": "pending-player-42",
            "quantity": 1,
        }
        failed_inputs = {
            "gamer_id": "failed-player-43",
            "quantity": 1,
        }

        pending_payment = Payment.objects.create(
            user=self.user,
            wallet=self.wallet,
            store_product=self.store_product,
            base_price=Decimal("0.01"),
            profit_percentage=Decimal("0"),
            final_price=Decimal("0.01"),
            currency="USD",
            status="processing",
            user_inputs=pending_inputs,
        )
        failed_payment = Payment.objects.create(
            user=self.user,
            wallet=self.wallet,
            store_product=self.store_product,
            base_price=Decimal("0.01"),
            profit_percentage=Decimal("0"),
            final_price=Decimal("0.01"),
            currency="USD",
            status="failed",
            user_inputs=failed_inputs,
        )

        pending_tx = Transaction.objects.create(
            user=self.user,
            wallet=self.wallet,
            transaction_type="purchase",
            amount=Decimal("-0.01"),
            currency="USD",
            status="pending",
            note=f"Purchase: {self.store_product.name}",
            payment=pending_payment,
        )
        failed_tx = Transaction.objects.create(
            user=self.user,
            wallet=self.wallet,
            transaction_type="purchase",
            amount=Decimal("-0.01"),
            currency="USD",
            status="failed",
            note=f"Purchase: {self.store_product.name}",
            payment=failed_payment,
        )

        res = client.get("/api/store/user/purchases/")
        self.assertEqual(res.status_code, 200)

        rows = {item["id"]: item for item in res.data["results"]}
        self.assertEqual(rows[pending_tx.id]["user_inputs"]["gamer_id"], "pending-player-42")
        self.assertEqual(rows[pending_tx.id]["payment_status"], "processing")
        self.assertEqual(rows[failed_tx.id]["user_inputs"]["gamer_id"], "failed-player-43")
        self.assertEqual(rows[failed_tx.id]["payment_status"], "failed")

    def test_user_purchases_returns_clean_store_product_name_from_note(self):
        client = self.authenticate_client(self.user)

        payment = Payment.objects.create(
            user=self.user,
            wallet=self.wallet,
            store_product=self.store_product,
            base_price=Decimal("0.01"),
            profit_percentage=Decimal("0"),
            final_price=Decimal("0.01"),
            currency="USD",
            status="success",
            user_inputs={
                "phone_number": "0982416135",
                "amount": 300,
            },
        )

        tx = Transaction.objects.create(
            user=self.user,
            wallet=self.wallet,
            transaction_type="purchase",
            amount=Decimal("-0.01"),
            currency="USD",
            status="approved",
            note=f"Purchase: {self.store_product.name} (Amount: 300.00000000) - External ID: EXT-123",
            payment=payment,
        )

        res = client.get("/api/store/user/purchases/")
        self.assertEqual(res.status_code, 200)

        rows = {item["id"]: item for item in res.data["results"]}
        self.assertEqual(rows[tx.id]["store_product_name"], self.store_product.name)

    def test_categories_endpoints(self):
        # Authenticate as admin
        client = self.authenticate_client(self.admin)

        # Create a category
        res = client.post('/api/users/categories/', {'name': 'gold', 'display_name': 'Gold', 'profit_percentage': 10.0, 'is_active': True}, format='json')
        self.assertEqual(res.status_code, 201)

        # Active categories
        res = client.get('/api/users/categories/active_categories/')
        self.assertEqual(res.status_code, 200)
