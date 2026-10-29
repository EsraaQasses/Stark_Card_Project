from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from decimal import Decimal
from threading import Barrier
from unittest import skipUnless
from unittest.mock import patch

from django.db import IntegrityError, close_old_connections, connection, connections, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from finance.services import FinanceService
from store.models import Product, ProductCategoryProfit, Section
from store.services.pricing import PricingPolicy
from third_party_apis.models import ThirdPartyAPI
from users.models import AuditLog, CustomerCategory, User
from wallets.models import Wallet

URL = '/api/store/admin/profit-matrix/'


def seed():
    admin = User.objects.create_user(name='matrix-admin', role='admin')
    category = CustomerCategory.objects.create(name='retail', display_name='Retail', profit_percentage='10')
    user = User.objects.create_user(name='matrix-user', category=category)
    section = Section.objects.create(name_en='Section', name_ar='قسم')
    product = Product.objects.create(section=section, name_en='Matrix product', name_ar='منتج',
                                     base_price='100', min_amount=1, max_amount=10,
                                     product_profit_percentage='20', currency='USD')
    return admin, category, user, product


class ProductProfitMatrixTests(TestCase):
    def setUp(self):
        self.admin, self.category, self.user, self.product = seed()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def change(self, value='0.25', revision=0, **extra):
        return {'product_id': self.product.pk, 'category_id': self.category.pk,
                'profit_percentage': value, 'expected_revision': revision, **extra}

    def save(self, *changes):
        return self.client.patch(URL, {'changes': list(changes)}, format='json')

    def test_single_create_update_zero_decimal_and_clear_revision(self):
        for revision, value in enumerate(['0.25', '0', '12.50', None]):
            response = self.save(self.change(value, revision))
            self.assertEqual(response.status_code, 200, response.data)
            rate = ProductCategoryProfit.objects.get()
            self.assertEqual(rate.revision, revision + 1)
            self.assertEqual(rate.profit_percentage, None if value is None else Decimal(value))
        self.assertEqual(ProductCategoryProfit.objects.count(), 1)
        self.assertEqual(AuditLog.objects.filter(resource_type='product_category_profit').count(), 4)

    def test_categories_are_dynamic_and_renaming_keeps_identity(self):
        self.save(self.change())
        self.category.display_name = 'Renamed'
        self.category.save()
        other = CustomerCategory.objects.create(name='wholesale', display_name='Wholesale')
        response = self.client.get(URL).data
        categories = {row['id']: row for row in response['categories']}
        self.assertEqual(categories[self.category.pk]['display_name'], 'Renamed')
        self.assertIn(other.pk, categories)
        self.assertEqual(response['results'][0]['rates'][0]['category_id'], self.category.pk)

    def test_inactive_category_hidden_but_rates_retained_and_delete_rejected(self):
        self.save(self.change())
        self.category.is_active = False
        self.category.save()
        data = self.client.get(URL).data
        self.assertEqual(data['categories'], [])
        self.assertEqual(data['results'][0]['rates'], [])
        self.assertEqual(ProductCategoryProfit.objects.count(), 1)
        self.assertEqual(self.save(self.change('5', 1)).status_code, 400)
        self.assertEqual(self.client.delete(f'/api/users/categories/{self.category.pk}/').status_code, 400)
        self.assertTrue(CustomerCategory.objects.filter(pk=self.category.pk).exists())

    def test_unique_database_constraint(self):
        self.save(self.change())
        with self.assertRaises(IntegrityError), transaction.atomic():
            ProductCategoryProfit.objects.create(product=self.product, customer_category=self.category)

    def test_non_admin_and_anonymous_cannot_read_or_write(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.save(self.change()).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(URL).status_code, (401, 403))
        self.assertIn(self.save(self.change()).status_code, (401, 403))

    def test_invalid_percentages_and_ids_leave_no_changes(self):
        for value in ['-0.01', '1000', '0.001', 'NaN', 'Infinity', 'text', '']:
            with self.subTest(value=value):
                self.assertEqual(self.save(self.change(value)).status_code, 400)
        for extra in [{'product_id': 999999}, {'category_id': 999999}, {'product_id': -1}, {'expected_revision': -1}]:
            self.assertEqual(self.save(self.change(**extra)).status_code, 400)
        self.assertEqual(ProductCategoryProfit.objects.count(), 0)

    def test_atomic_batch_and_validation_rollback(self):
        other = CustomerCategory.objects.create(name='second', display_name='Second')
        response = self.save(self.change(), self.change('5.25', category_id=other.pk))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['saved_count'], 2)
        failed = self.save(self.change('8', 1), self.change('1000', 1, category_id=other.pk))
        self.assertEqual(failed.status_code, 400)
        self.assertEqual(ProductCategoryProfit.objects.get(customer_category=self.category).profit_percentage, Decimal('0.25'))

    def test_duplicate_cells_and_stale_revision_rollback(self):
        self.assertEqual(self.save(self.change(), self.change()).status_code, 400)
        self.save(self.change())
        other = CustomerCategory.objects.create(name='other', display_name='Other')
        response = self.save(self.change('6', category_id=other.pk), self.change('8', 0))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(ProductCategoryProfit.objects.count(), 1)

    def test_strict_audit_failure_rolls_back_entire_batch(self):
        with patch('store.profit_matrix.AuditLogger.log', side_effect=RuntimeError('audit unavailable')):
            self.assertEqual(self.save(self.change()).status_code, 500)
        self.assertEqual(ProductCategoryProfit.objects.count(), 0)

    def test_filters_pagination_usd_syp_and_cost_not_invented(self):
        other = Product.objects.create(section=self.product.section, name_en='Second product', name_ar='ثان', currency='SYP', base_price=1000)
        response = self.client.get(URL, {'page_size': 1}).data
        self.assertEqual(response['count'], 2)
        self.assertIsNotNone(response['next'])
        self.assertEqual(len(response['results']), 1)
        for query in [{'search': str(other.pk)}, {'currency': 'SYP'}, {'search': 'Second'}, {'section_id': other.section_id, 'currency': 'SYP'}]:
            rows = self.client.get(URL, query).data['results']
            self.assertEqual([row['id'] for row in rows], [other.pk])
        self.assertIsNone(response['results'][0]['cost'])
        self.assertEqual(self.client.get(URL, {'currency': 'EUR'}).status_code, 400)

    def test_disabled_product_provider_still_editable_without_mutating_links(self):
        api = ThirdPartyAPI.objects.create(name='Disabled', provider='stark-card', base_url='https://provider.invalid', is_active=False)
        self.product.api_config = api
        self.product.is_active = False
        self.product.save()
        response = self.save(self.change())
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.api_config_id, api.pk)
        self.assertFalse(self.product.is_active)
        row = self.client.get(URL, {'api_id': api.pk, 'is_active': 'false'}).data['results'][0]
        self.assertFalse(row['provider_active'])

    def test_configuration_never_reprices_pending_or_completed_snapshots(self):
        wallet = Wallet.objects.get(user=self.user, currency='USD')
        wallet.available_balance = 1000
        wallet.save()
        pricing = PricingPolicy.for_product(product=self.product, user=self.user)
        self.assertEqual(pricing.native_final_amount, Decimal('130'))
        snapshot = pricing.to_snapshot()
        rows = []
        for key in ['pending', 'approved']:
            tx = FinanceService.withdraw(wallet_id=wallet.pk, amount=pricing.wallet_charge_amount,
                transaction_type='purchase', idempotency_key='matrix-'+key,
                conversion_result=pricing.conversion, operation_context={'pricing': snapshot})
            if key == 'approved':
                tx = FinanceService.approve(tx.pk)
            rows.append((tx, deepcopy(tx.operation_context), tx.amount))
        self.assertEqual(self.save(self.change('99.99')).status_code, 200)
        self.assertEqual(PricingPolicy.for_product(product=self.product, user=self.user).native_final_amount, Decimal('130'))
        for tx, context, amount in rows:
            tx.refresh_from_db()
            self.assertEqual(tx.operation_context, context)
            self.assertEqual(tx.amount, amount)


@skipUnless(connection.vendor == 'postgresql', 'Requires PostgreSQL row locks')
class ProductProfitMatrixRaceTests(TransactionTestCase):
    def test_first_insert_race_is_unique_and_second_writer_gets_conflict(self):
        admin, category, user, product = seed()
        admins = [admin.pk, User.objects.create_user(name="matrix-admin-two", role="admin").pk]
        barrier = Barrier(2)
        def save(value, admin_id):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(User.objects.get(pk=admin_id))
                barrier.wait(timeout=10)
                return client.patch(URL, {'changes': [{'product_id': product.pk, 'category_id': category.pk,
                    'profit_percentage': value, 'expected_revision': 0}]}, format='json').status_code
            finally:
                connections['default'].close()
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(save, value, admins[index]) for index, value in enumerate(['1.25', '2.50'])]
            self.assertEqual(sorted(future.result(timeout=30) for future in futures), [200, 409])
        self.assertEqual(ProductCategoryProfit.objects.count(), 1)
        self.assertEqual(ProductCategoryProfit.objects.get().revision, 1)
        self.assertIn(ProductCategoryProfit.objects.get().updated_by_id, admins)
