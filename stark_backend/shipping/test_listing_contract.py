from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient

from all_requests.models import Request
from users.models import User
from .models import Shipping, StandardShippingRequest, AgentShippingRequest, AgentAdminShippingRequest


class ShippingListingTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(name='listing-admin', role='admin')
        self.agent = User.objects.create_user(name='listing-agent', role='agent')
        self.user = User.objects.create_user(name='listing-user', agent=self.agent)
        self.other = User.objects.create_user(name='listing-other')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        for user, amount, currency, state in [
            (self.user, '10', 'USD', 'approved'), (self.user, '20', 'USD', 'pending'),
            (self.user, '30', 'USD', 'approved'), (self.other, '1000', 'SYP', 'approved'),
        ]:
            req = Request.objects.create(user=user, title='Transfer', description='Listing',
                                         request_type='payment', amount=amount, currency=currency,
                                         user_input_data={'provider': 'bank'})
            Shipping.objects.filter(request=req).update(status=state,
                created_at=datetime(2026, 10, 26, 18, tzinfo=ZoneInfo('Asia/Damascus')))

    def test_filtered_summary_and_count_cover_all_pages(self):
        query = {'currency': 'USD', 'status': 'approved', 'page_size': 1, 'created_to': '2026-10-26'}
        response = self.client.get('/api/shipping/', query)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(Decimal(response.data['summary']['amounts_by_currency']['USD']['approved']), 40)
        self.assertEqual(response.data['payment_statistics']['approved_shippings_count'], 2)
        count = self.client.get('/api/shipping/count/', query)
        self.assertEqual(count.data['total_count'], 2)
        second = self.client.get('/api/shipping/', {**query, 'page': 2})
        self.assertNotEqual(response.data['results'][0]['id'], second.data['results'][0]['id'])

    def test_user_and_agent_counts_never_leak_other_users(self):
        for actor in (self.user, self.agent):
            self.client.force_authenticate(actor)
            response = self.client.get('/api/shipping/')
            self.assertEqual(response.data['count'], 3)
            self.assertNotIn('SYP', response.data['summary']['amounts_by_currency'])
            self.assertEqual(self.client.get('/api/shipping/count/').data['total_count'], 3)

    def test_invalid_filters_rejected_and_mixed_currencies_separated(self):
        for query in ({'status': 'bad'}, {'amount_min': 100, 'amount_max': 1},
                      {'created_from': '2026-10-27', 'created_to': '2026-10-26'},
                      {'user': '1.5'}, {'agent': '-1'},
                      {'ordering': 'user__email'}):
            response = self.client.get('/api/shipping/', query)
            self.assertEqual(response.status_code, 400, response.data)
        totals = self.client.get('/api/shipping/').data['summary']['amounts_by_currency']
        self.assertEqual(Decimal(totals['USD']['approved']), 40)
        self.assertEqual(Decimal(totals['SYP']['approved']), 1000)

    def test_standard_shipping_includes_filtered_summary(self):
        for value in (5, 7):
            StandardShippingRequest.objects.create(user=self.user, amount=value, currency='USD', wallet_currency='USD')
        response = self.client.get('/api/shipping/standard/', {'page_size': 1})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(Decimal(response.data['summary']['amounts_by_currency']['USD']['pending']), 12)

    def test_generic_writes_cannot_bypass_financial_status_transitions(self):
        shipping = Shipping.objects.filter(user=self.user).first()
        standard = StandardShippingRequest.objects.create(user=self.user, amount=5, currency='USD', wallet_currency='USD')
        for url in (f'/api/shipping/{shipping.pk}/', f'/api/shipping/standard/{standard.pk}/'):
            self.assertEqual(self.client.patch(url, {'status': 'approved', 'amount': 999}, format='json').status_code, 405)
            self.assertEqual(self.client.delete(url).status_code, 405)
        standard.refresh_from_db()
        self.assertEqual(standard.status, 'pending')
        self.assertEqual(standard.amount, 5)

    def test_creation_serializer_cannot_accept_forged_approval(self):
        from shipping.serializers import StandardShippingRequestSerializer
        serializer = StandardShippingRequestSerializer(data={
            'amount': '5', 'currency': 'USD', 'wallet_currency': 'USD',
            'status': 'approved', 'admin_notes': 'Forged',
        })
        serializer.is_valid(raise_exception=True)
        self.assertNotIn('status', serializer.validated_data)
        self.assertNotIn('admin_notes', serializer.validated_data)

    def test_finalized_shipping_cannot_be_rejected_after_approval(self):
        legacy = Shipping.objects.filter(status='approved').first()
        standard = StandardShippingRequest.objects.create(user=self.user, amount=5, currency='USD', status='approved')
        for url in (f'/api/shipping/{legacy.pk}/update_status/', f'/api/shipping/standard/{standard.pk}/update_status/'):
            response = self.client.post(url, {'status': 'rejected'}, format='json')
            self.assertEqual(response.status_code, 409, response.data)

    def test_agent_channels_filter_and_summarize_without_invalid_user_field(self):
        AgentShippingRequest.objects.create(user=self.user, agent=self.agent, amount=5, currency='USD')
        AgentAdminShippingRequest.objects.create(agent=self.agent, amount=9, currency='USD')
        for route, user_id, amount in (('via-agent', self.user.pk, 5), ('agent-admin', self.agent.pk, 9)):
            response = self.client.get(f'/api/shipping/{route}/', {'agent': self.agent.pk, 'user': user_id, 'page_size': 1})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['count'], 1)
            self.assertEqual(Decimal(response.data['summary']['amounts_by_currency']['USD']['pending']), amount)
