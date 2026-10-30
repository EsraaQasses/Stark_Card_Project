from unittest.mock import patch

from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from users.models import AuditLog, CustomerCategory, User


class CategoryAuditTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(name='category-admin', role='admin')
        self.user = User.objects.create_user(name='category-user')
        self.category = CustomerCategory.objects.create(name='special', display_name='Special', profit_percentage=10)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_edit_records_exact_before_after_and_actor(self):
        response = self.client.patch(reverse('customercategory-detail', args=[self.category.pk]),
                                     {'profit_percentage': '17.50'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        log = AuditLog.objects.filter(resource_type='category', resource_id=self.category.pk).latest('pk')
        self.assertEqual(log.user_id, self.admin.pk)
        self.assertEqual(log.details['old_profit'], 10)
        self.assertEqual(log.details['new_profit'], 17.5)

    def test_failed_audit_rolls_back_edit_and_assignment(self):
        with patch.object(AuditLog.objects, 'create', side_effect=IntegrityError('audit unavailable')):
            response = self.client.patch(reverse('customercategory-detail', args=[self.category.pk]),
                                         {'profit_percentage': '30'}, format='json')
            self.assertEqual(response.status_code, 500)
            response = self.client.post(reverse('assign-category'),
                {'user_id': self.user.pk, 'category_id': self.category.pk}, format='json')
            self.assertEqual(response.status_code, 400)
        self.category.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(self.category.profit_percentage, 10)
        self.assertIsNone(self.user.category_id)

    def test_non_admin_cannot_edit_and_no_audit_is_written(self):
        self.client.force_authenticate(self.user)
        before = AuditLog.objects.count()
        response = self.client.patch(reverse('customercategory-detail', args=[self.category.pk]),
                                     {'profit_percentage': '99'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(AuditLog.objects.count(), before)
