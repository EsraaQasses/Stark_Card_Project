from django.test import TestCase
from django.contrib.auth import get_user_model
from unittest.mock import patch, MagicMock

from wallets.models import Wallet
from third_party_apis.models import ThirdPartyAPI
from store.models import Section, ExternalProduct, StoreProduct
from transactions.services.purchase_service import PurchaseService


class PurchaseFlowTests(TestCase):
    def setUp(self):
        User = get_user_model()
        # create_user expects `name` positional argument in this project
        self.user = User.objects.create_user(name='testuser', password='password123', full_name='Test User')

        # Wallet is auto-created on User.save() in this project; fetch and set balance
        self.wallet = Wallet.objects.get(user=self.user, currency="USD")
        self.wallet.available_balance = 1000
        self.wallet.save()

        # Create section
        self.section = Section.objects.create(name_en='Mobile', name_ar='موبايل')

        # Create a ThirdPartyAPI config (stark-card provider)
        self.api = ThirdPartyAPI.objects.create(
            name='Test Stark API',
            provider='stark-card',
            base_url='https://api.stark-card.test/',
            is_active=True
        )

        # External product and store product (product name in Arabic requested)
        self.external = ExternalProduct.objects.create(
            api_config=self.api,
            external_id='srv-1234',
            name='تحويل وحدات سيريتل',
            base_price=0.01
        )

        self.store_product = StoreProduct.objects.create(
            section=self.section,
            external_product=self.external,
            name='تحويل وحدات سيريتل (Store)',
            description='Test product',
            price=0.01,
            is_active=True
        )

    @patch('third_party_apis.services.api_service.ConnectorFactory.get_connector')
    def test_purchase_flow_with_mock_connector(self, mock_get_connector):
        # Prepare a dummy connector that simulates success
        dummy_connector = MagicMock()
        dummy_connector.execute_purchase.return_value = {
            'success': True,
            'external_transaction_id': 'EXT-MOCK-1',
            'order_id': 'ORDER-MOCK-1',
            'message': 'Mock purchase successful',
            'status_code': 200
        }

        mock_get_connector.return_value = dummy_connector

        user_inputs = {
            'phone_number': '0982416135',
            'quantity': 4026
        }

        result = PurchaseService.process_purchase(self.store_product.id, self.user, user_inputs)

        # Assert success and that wallet was debited (price small, but process should succeed)
        self.assertTrue(result.get('success'), msg=str(result))
        self.assertIn('transaction_id', result)
        self.assertIn('external_transaction_id', result)
        self.assertEqual(result.get('external_transaction_id'), 'EXT-MOCK-1')

        # Ensure connector was called
        mock_get_connector.assert_called()

    @patch('third_party_apis.services.api_service.ConnectorFactory.get_connector')
    def test_uncertain_transport_result_stays_pending(self, mock_get_connector):
        mock_get_connector.return_value.execute_purchase.return_value = {
            'success': False,
            'status_code': None,
            'error': 'Transport error; request outcome unknown. Do not retry.',
        }
        result = PurchaseService.process_purchase(
            self.store_product.id, self.user,
            {'phone_number': '0982416135', 'quantity': 1},
        )
        self.assertTrue(result['success'])
        self.assertTrue(result['processing'])
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(result['error_code'], 'PROVIDER_STATUS_UNKNOWN')
        self.wallet.refresh_from_db()
        self.assertGreater(self.wallet.pending_balance, 0)
        self.assertEqual(self.wallet.total_balance, 1000)

    @patch('transactions.services.purchase_service.APIService.process_payment')
    def test_provider_auth_failure_releases_reservation_without_user_401(self, provider):
        for status in (401, 403):
            with self.subTest(status=status):
                provider.return_value = {'success': False, 'status_code': status, 'error': 'Provider authentication failed'}
                result = PurchaseService.process_purchase(self.store_product.id, self.user,
                    {'quantity': 1}, idempotency_key=f'auth-{status}')
                self.assertFalse(result['success'])
                self.assertEqual(result['error_code'], 'PROVIDER_AUTH_ERROR')
                self.wallet.refresh_from_db()
                self.assertEqual(self.wallet.available_balance, 1000)
                self.assertEqual(self.wallet.pending_balance, 0)
                from rest_framework.test import APIClient
                client = APIClient()
                client.force_authenticate(self.user)
                response = client.post('/api/store/user/purchases/', {
                    'store_product_id': self.store_product.pk,
                    'user_inputs': {'quantity': 1}, 'wallet_currency': 'USD',
                    'idempotency_key': f'http-auth-{status}',
                }, format='json')
                self.assertEqual(response.status_code, 502, response.data)
                self.assertEqual(response.data['error']['code'], 'PROVIDER_AUTH_ERROR')

    @patch('transactions.services.purchase_service.APIService.process_payment')
    def test_confirmed_rejection_is_not_pending_even_if_message_mentions_timeout(self, provider):
        provider.return_value = {'success': False, 'status': 'rejected', 'error': 'Rejected after validation timeout'}
        result = PurchaseService.process_purchase(self.store_product.id, self.user, {'quantity': 1})
        self.assertFalse(result['success'])
        self.assertEqual(result['error_code'], 'PROVIDER_REJECTED')
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 1000)
