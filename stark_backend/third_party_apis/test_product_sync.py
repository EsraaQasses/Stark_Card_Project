from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase

from store.models import ExternalProduct, Product, Section, StoreProduct
from third_party_apis.models import ProductSyncResult, ProductSyncRun, ThirdPartyAPI
from third_party_apis.services.product_sync_service import ProductSyncBusy, ProductSynchronizationService


class ProductSynchronizationTests(TestCase):
    def setUp(self):
        self.api = ThirdPartyAPI.objects.create(
            name="Sync API", provider="alaaeddin", base_url="https://provider.test", is_active=True
        )
        self.section = Section.objects.create(name_en="Sync", name_ar="مزامنة")
        self.connector = MagicMock()
        cache.clear()

    def _connector(self, products):
        self.connector.get_products.return_value = products
        return patch("third_party_apis.services.product_sync_service.ConnectorFactory.get_connector", return_value=self.connector)

    def test_provider_active_to_inactive_and_back(self):
        with self._connector([{"external_id": "p1", "name": "P1", "base_price": "2", "status": "active"}]):
            ProductSynchronizationService.synchronize(self.api.id)
        external = ExternalProduct.objects.get(external_id="p1")
        with self._connector([{"external_id": "p1", "name": "P1", "base_price": "2", "status": "inactive"}]):
            ProductSynchronizationService.synchronize(self.api.id)
        external.refresh_from_db()
        self.assertEqual(external.provider_status, "inactive")
        with self._connector([{"external_id": "p1", "name": "P1", "base_price": "2", "status": "active"}]):
            ProductSynchronizationService.synchronize(self.api.id)
        external.refresh_from_db()
        self.assertEqual(external.provider_status, "active")

    def test_outage_preserves_last_confirmed_product_state(self):
        external = ExternalProduct.objects.create(
            api_config=self.api, external_id="p1", name="P1", base_price="2", is_active=True
        )
        with self._connector([]):
            result = ProductSynchronizationService.synchronize(self.api.id)
        external.refresh_from_db()
        self.assertFalse(result["success"])
        self.assertEqual(external.provider_status, "active")
        self.assertTrue(external.is_active)
        self.assertEqual(ProductSyncRun.objects.latest("id").status, "unavailable")
        self.assertTrue(result['preserved_last_confirmed_state'])
        self.assertEqual(result['cached_product_count'], 1)
        self.assertEqual(ProductSyncRun.objects.latest('id').unavailable_count, 1)

    def test_provider_exception_is_unavailable_not_inactive(self):
        external = ExternalProduct.objects.create(
            api_config=self.api, external_id="p1", name="P1", base_price="2", is_active=True
        )
        self.connector.get_products.side_effect = TimeoutError("provider timeout")
        with patch("third_party_apis.services.product_sync_service.ConnectorFactory.get_connector", return_value=self.connector):
            result = ProductSynchronizationService.synchronize(self.api.id)
        external.refresh_from_db()
        self.assertFalse(result["success"])
        self.assertEqual(external.provider_status, "active")
        self.assertTrue(external.is_active)

    def test_duplicate_job_is_rejected(self):
        key = "product-sync:alaaeddin:%s" % self.api.id
        cache.add(key, "another-worker", timeout=300)
        with self.assertRaises(ProductSyncBusy):
            ProductSynchronizationService.synchronize(self.api.id)

    def test_failed_sync_does_not_make_last_confirmed_store_product_unavailable(self):
        external = ExternalProduct.objects.create(api_config=self.api, external_id='known', name='Known', base_price=2)
        local = StoreProduct.objects.create(section=self.section, external_product=external, name='Known', price=3)
        with self._connector([]):
            self.assertFalse(ProductSynchronizationService.synchronize(self.api.id)['success'])
        external.refresh_from_db()
        local.refresh_from_db()
        self.assertTrue(local.is_available_for_purchase)
        self.assertEqual(external.last_sync_error_code, 'PROVIDER_EMPTY_RESPONSE')

    def test_disabled_provider_is_never_synced_or_reactivated(self):
        self.api.is_active = False
        self.api.save(update_fields=['is_active'])
        with self._connector([{'external_id': 'p1', 'name': 'P1', 'base_price': 1}]):
            result = ProductSynchronizationService.synchronize(self.api.id)
        self.assertEqual(result['error_code'], 'API_PROVIDER_DISABLED')
        self.connector.get_products.assert_not_called()

    def test_malformed_partial_item_does_not_discard_valid_updates(self):
        with self._connector([{'external_id': 'valid', 'name': 'Valid', 'base_price': 2}, 'invalid']):
            result = ProductSynchronizationService.synchronize(self.api.id)
        self.assertTrue(result['success'])
        self.assertEqual(ProductSyncRun.objects.get(pk=result['run_id']).status, 'partial')

    def test_all_invalid_catalog_is_reported_as_failure_without_disabling_products(self):
        external = ExternalProduct.objects.create(api_config=self.api, external_id='known', name='Known', base_price=2)
        for payload in ({'error': 'Provider unavailable'}, [{}]):
            with self.subTest(payload=payload), self._connector(payload):
                result = ProductSynchronizationService.synchronize(self.api.pk)
            self.assertFalse(result['success'])
            self.assertEqual(result['error_code'], 'PROVIDER_INVALID_RESPONSE')
            external.refresh_from_db()
            self.assertEqual(external.provider_status, 'active')

    def test_admin_override_is_preserved(self):
        external = ExternalProduct.objects.create(
            api_config=self.api, external_id="p1", name="P1", base_price="2"
        )
        store_product = StoreProduct.objects.create(
            section=self.section, external_product=external, name="P1", price="3",
            administrator_disabled=True, is_active=False,
        )
        with self._connector([{"external_id": "p1", "name": "P1", "base_price": "2", "status": "active"}]):
            ProductSynchronizationService.synchronize(self.api.id)
        store_product.refresh_from_db()
        self.assertFalse(store_product.is_active)
        self.assertTrue(store_product.administrator_disabled)

    def test_complete_response_marks_omitted_product_removed(self):
        ExternalProduct.objects.create(
            api_config=self.api, external_id="old", name="Old", base_price="2"
        )
        with self._connector([{"external_id": "new", "name": "New", "base_price": "2", "status": "active"}]):
            ProductSynchronizationService.synchronize(self.api.id)
        self.assertEqual(ExternalProduct.objects.get(external_id="old").provider_status, "removed")
        self.assertTrue(ProductSyncResult.objects.filter(external_id="old", status="removed").exists())

    def test_partial_response_does_not_remove_omitted_products(self):
        ExternalProduct.objects.create(
            api_config=self.api, external_id="old", name="Old", base_price="2"
        )
        with self._connector([{"external_id": "new", "name": "New", "base_price": "2", "status": "active"}, {}]):
            result = ProductSynchronizationService.synchronize(self.api.id)
        self.assertEqual(result["success"], True)
        self.assertNotEqual(ExternalProduct.objects.get(external_id="old").provider_status, "removed")

    def test_checkout_revalidation_rejects_provider_unavailable(self):
        external = ExternalProduct.objects.create(
            api_config=self.api, external_id="p1", name="P1", base_price="2", provider_status="unavailable"
        )
        store_product = StoreProduct.objects.create(
            section=self.section, external_product=external, name="P1", price="3", is_active=True
        )
        self.assertFalse(store_product.is_available_for_purchase)
