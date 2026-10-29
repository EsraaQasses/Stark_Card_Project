"""Regression API tests against the adjacent backend, using an isolated test DB."""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from rest_framework.test import APIClient
from django.test import TestCase
from users.models import User, CustomerCategory
from wallets.models import Wallet
from shipping.models import StandardShippingRequest, AgentAdminShippingRequest
from payment_methods.test_media_api import PaymentMediaTests, image


class InstructionMediaTests(PaymentMediaTests):
    def test_instruction_image_survives_read_replace_and_clear_without_changing_qr(self):
        original_qr = self.method.qr_image.name
        response = self.client.patch(self.url, {'instruction_image': image('guide.png')}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        saved = response.data['instruction_image']
        self.assertEqual(self.client.get(self.url).data['instruction_image'], saved)
        self.client.force_authenticate(self.user)
        rows = self.client.get('/api/payment-methods/user/payment-methods/').data
        self.assertEqual(next(row for row in rows if row['id'] == self.method.pk)['instruction_image'], saved)
        self.assertEqual(self.client.patch(self.url, {'instruction_image': image()}, format='multipart').status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.patch(self.url, {'instruction_image': image('new-guide.png')}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotEqual(response.data['instruction_image'], saved)
        response = self.client.patch(self.url, {'instruction_image': ''}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['instruction_image'])
        self.method.refresh_from_db()
        self.assertEqual(self.method.qr_image.name, original_qr)

    def test_legacy_instruction_is_null_and_invalid_image_rejected(self):
        self.assertIsNone(self.client.get(self.url).data['instruction_image'])
        from django.core.files.uploadedfile import SimpleUploadedFile
        response = self.client.patch(self.url, {'instruction_image': SimpleUploadedFile('bad.png', b'not an image', content_type='image/png')}, format='multipart')
        self.assertEqual(response.status_code, 400)


class PriorityOneAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(name='priority-admin', role='admin')
        self.user = User.objects.create_user(name='priority-customer')
        self.agent = User.objects.create_user(name='priority-agent', role='agent')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_adjustment_reason_boundaries_customer_agent_and_currency(self):
        for user in (self.user, self.agent):
            for currency in ('USD', 'SYP'):
                url = f'/api/users/admin/customers/{user.pk}/balance-adjustments/'
                wallet = Wallet.objects.get(user=user, currency=currency)
                before = wallet.available_balance
                for index, reason in enumerate(('إيداع', 'شحن', '<>&"\'', 'x' * 500)):
                    payload = {'amount': '1', 'currency': currency, 'reason': reason,
                               'idempotency_key': f'{user.pk}-{currency}-{index}'}
                    result = self.client.post(url, payload, format='json')
                    self.assertEqual(result.status_code, 200, result.data)
                    self.assertEqual(self.client.post(url, payload, format='json').status_code, 200)
                for index, reason in enumerate(('', '   ', 'x' * 501)):
                    result = self.client.post(url, {'amount': '1', 'currency': currency, 'reason': reason,
                        'idempotency_key': f'bad-{user.pk}-{currency}-{index}'}, format='json')
                    self.assertEqual(result.status_code, 400, result.data)
                wallet.refresh_from_db()
                self.assertEqual(wallet.available_balance, before + Decimal('4'))

    def test_category_persistence_default_and_permissions(self):
        category = CustomerCategory.objects.create(name='priority', display_name='Priority', profit_percentage=5)
        active = self.client.get('/api/users/categories/active_categories/').data
        self.assertIn(category.pk, [row['id'] for row in active])
        url = '/api/users/assign-category/'
        response = self.client.post(url, {'user_id': self.user.pk, 'category_id': category.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        aggregate = self.client.get(f'/api/users/admin/customers/{self.user.pk}/').data
        self.assertEqual(aggregate['customer_category']['id'], category.pk)
        self.assertEqual(self.client.post(url, {'user_id': self.user.pk, 'category_id': None}, format='json').status_code, 200)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.category_id)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(url, {'user_id': self.user.pk, 'category_id': category.pk}, format='json').status_code, 403)

    def test_shipping_filters_before_pagination_for_both_dashboard_sources(self):
        for model, source, actor in ((StandardShippingRequest, 'standard', self.user),
                                      (AgentAdminShippingRequest, 'agent-admin', self.agent)):
            for index in range(3):
                kwargs = {'user': actor} if source == 'standard' else {'agent': actor}
                row = model.objects.create(**kwargs, amount='5', currency='USD', wallet_currency='USD')
                model.objects.filter(pk=row.pk).update(created_at=datetime(2026, 10, 27 if index < 2 else 26, 12, tzinfo=ZoneInfo('Asia/Damascus')))
            query = {'created_from': '2026-10-27T00:00:00+03:00', 'created_to': '2026-10-27T23:59:59.999999+03:00',
                     'status': 'pending', 'search': actor.name, 'page_size': 1}
            url = f'/api/shipping/{source}/'
            result = self.client.get(url, query)
            self.assertEqual(result.status_code, 200, result.data)
            self.assertEqual(result.data['count'], 2)
            self.assertEqual(len(result.data['results']), 1)
            self.assertTrue(result.data['next'])
            second = self.client.get(url, {**query, 'page': 2}).data
            self.assertNotEqual(second['results'][0]['id'], result.data['results'][0]['id'])
            self.assertEqual(self.client.get(url, {**query, 'status': 'approved'}).data['count'], 0)
            by_id = self.client.get(url, {**query, 'search': str(second['results'][0]['id'])}).data
            self.assertEqual(by_id['count'], 1)
