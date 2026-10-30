from unittest.mock import patch

import requests
from django.test import TestCase, SimpleTestCase
from rest_framework.test import APIClient

from store.models import ExternalProduct, Product, Section, StoreProduct
from third_party_apis.models import ThirdPartyAPI
from third_party_apis.services.api_service import APIService
from third_party_apis.services.product_sync_service import ProductSynchronizationService
from third_party_apis.utils.connectors import AlaaeddinConnector
from users.models import User


class ProviderStatusTests(SimpleTestCase):
    def test_statuses_require_confirmation_and_negation_never_approves(self):
        for raw, expected in [('approved', 'approved'), ('pending', 'pending'),
                              ('rejected', 'rejected'), ('غير ناجح', 'rejected'),
                              ('غير مقبول', 'rejected'), ('لم يتم التنفيذ', 'unknown'),
                              ('not approved', 'unknown'), ('unconfirmed', 'unknown')]:
            with self.subTest(status=raw):
                self.assertEqual(APIService._normalize_order_status(raw), expected)


class ProviderLifecycleTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(name='provider-admin', role='admin')
        self.user = User.objects.create_user(name='provider-user')
        self.api = ThirdPartyAPI.objects.create(name='Provider', provider='stark-card', base_url='https://provider.test')
        self.external = ExternalProduct.objects.create(api_config=self.api, external_id='1', name='Item', base_price=1)
        self.section = Section.objects.create(name_en='Provider', name_ar='Provider')
        self.local = StoreProduct.objects.create(section=self.section, external_product=self.external, name='Item', price=2)
        self.product = Product.objects.create(section=self.section, external_product=self.external,
            api_config=self.api, name_en='Item', name_ar='Item', base_price=1,
            min_amount=1, max_amount=10, product_type='amount_based')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_retire_preserves_rows_and_selected_external_stays_disabled_after_reenable(self):
        url = f'/api/third_party_apis/apis/{self.api.pk}/'
        self.assertEqual(self.client.delete(url).status_code, 409)
        response = self.client.post(url + 'retire/', {'selected': [{'kind': 'external', 'id': self.external.pk}]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.api.refresh_from_db()
        self.assertFalse(self.api.is_active)
        self.assertTrue(ExternalProduct.objects.filter(pk=self.external.pk).exists())
        self.api.is_active = True
        self.api.save(update_fields=['is_active'])
        with patch('third_party_apis.services.product_sync_service.ConnectorFactory.get_connector') as factory:
            factory.return_value.get_products.return_value = [{'external_id': '1', 'name': 'Item', 'base_price': 1, 'status': 'active'}]
            self.assertTrue(ProductSynchronizationService.synchronize(self.api.pk)['success'])
        self.external.refresh_from_db()
        self.local.refresh_from_db()
        self.assertTrue(self.external.administrator_disabled)
        self.assertFalse(self.local.is_available_for_purchase)

    def test_disabled_provider_cannot_bypass_product_gate_or_appear_in_user_catalog(self):
        self.api.is_active = False
        self.api.save(update_fields=['is_active'])
        product = Product.objects.select_related('api_config', 'external_product__api_config').get(pk=self.product.pk)
        self.assertFalse(product.is_available_for_purchase)
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/store/user/products/')
        self.assertEqual(response.status_code, 200, response.data)
        rows = response.data.get('results', []) if isinstance(response.data, dict) else response.data
        self.assertNotIn(self.product.pk, [row['id'] for row in rows])

    def test_admin_disabled_products_are_not_reactivated_by_successful_sync(self):
        for url in (f'/api/store/admin/products/{self.product.pk}/',
                    f'/api/store/admin/store-products/{self.local.pk}/'):
            response = self.client.patch(url, {'is_active': False}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        with patch('third_party_apis.services.product_sync_service.ConnectorFactory.get_connector') as factory:
            factory.return_value.get_products.return_value = [{'external_id': '1', 'name': 'Item', 'base_price': 1, 'status': 'active'}]
            self.assertTrue(ProductSynchronizationService.synchronize(self.api.pk)['success'])
        for product in (self.product, self.local):
            product.refresh_from_db()
            self.assertTrue(product.administrator_disabled)
            self.assertFalse(product.is_active)

    @patch('third_party_apis.utils.connectors.requests.request', side_effect=requests.Timeout('ambiguous'))
    def test_purchase_get_is_never_retried_after_timeout(self, request):
        result = APIService._execute_api_call_and_log(self.api, '/api/purchase', 'POST', {
            'product_data': {'external_id': '1', 'quantity': 1}, 'user_data': {}, 'transaction_data': {},
        })
        self.assertFalse(result['success'])
        request.assert_called_once()

    def test_alaaeddin_structured_validation_rejection_is_distinct_from_server_failure(self):
        self.api.provider = 'alaaeddin'
        connector = AlaaeddinConnector(self.api)
        for code, state in ((422, 'rejected'), (500, 'unknown')):
            with self.subTest(code=code), patch.object(connector, 'make_request', return_value={
                'success': False, 'status_code': code,
                'data': {'error': {'code': 'INVALID_FIELDS', 'message': 'Invalid input'}},
            }):
                result = connector.execute_purchase({'external_id': '1', 'quantity': 1}, {}, {})
                self.assertEqual(result['status'], state)
