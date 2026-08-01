"""
Test cases for category functionality
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from decimal import Decimal

from ..models import CustomerCategory

User = get_user_model()


class CategoryModelTestCase(TestCase):
    """Test CustomerCategory model functionality"""

    def setUp(self):
        self.category1 = CustomerCategory.objects.create(
            name='test1',
            display_name='Test Category 1',
            profit_percentage=10.0
        )
        self.category2 = CustomerCategory.objects.create(
            name='test2',
            display_name='Test Category 2',
            profit_percentage=20.0
        )

    def test_default_category_uniqueness(self):
        """Test that only one category can be default"""
        self.category1.is_default = True
        self.category1.save()

        self.category2.is_default = True
        self.category2.save()

        # Only category2 should be default
        self.assertFalse(CustomerCategory.objects.get(id=self.category1.id).is_default)
        self.assertTrue(CustomerCategory.objects.get(id=self.category2.id).is_default)

    def test_category_str(self):
        """Test category string representation"""
        expected = f"{self.category1.display_name} ({self.category1.profit_percentage}%)"
        self.assertEqual(str(self.category1), expected)


class CategoryAPITestCase(APITestCase):
    """Test category API endpoints"""

    def setUp(self):
        self.admin_user = User.objects.create_user(
            name='admin',
            email='admin@test.com',
            password='admin123',
            role='admin'
        )
        self.regular_user = User.objects.create_user(
            name='user',
            email='user@test.com',
            password='user123',
            role='user'
        )
        self.category = CustomerCategory.objects.create(
            name='test',
            display_name='Test Category',
            profit_percentage=15.0
        )

    def test_category_list_requires_auth(self):
        """Test that category list requires authentication"""
        url = reverse('customercategory-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_category_list_requires_admin(self):
        """Test that category list requires admin role"""
        self.client.force_authenticate(user=self.regular_user)
        url = reverse('customercategory-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_category_list_admin_access(self):
        """Test that admin can access category list"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('customercategory-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_category_creation(self):
        """Test category creation"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('customercategory-list')
        data = {
            'name': 'new_cat',
            'display_name': 'New Category',
            'profit_percentage': 25.0
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomerCategory.objects.count(), 2)


class UserCategoryAssignmentTestCase(APITestCase):
    """Test user category assignment functionality"""

    def setUp(self):
        self.admin_user = User.objects.create_user(
            name='admin',
            email='admin@test.com',
            password='admin123',
            role='admin'
        )
        self.test_user = User.objects.create_user(
            name='testuser',
            email='test@test.com',
            password='test123',
            role='user'
        )
        self.category = CustomerCategory.objects.create(
            name='test_cat',
            display_name='Test Category',
            profit_percentage=10.0
        )

    def test_assign_category_requires_auth(self):
        """Test that category assignment requires authentication"""
        url = reverse('assign-category')
        data = {
            'user_id': self.test_user.id,
            'category_id': self.category.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_assign_category_requires_admin(self):
        """Test that category assignment requires admin role"""
        self.client.force_authenticate(user=self.test_user)
        url = reverse('assign-category')
        data = {
            'user_id': self.test_user.id,
            'category_id': self.category.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assign_category_success(self):
        """Test successful category assignment"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('assign-category')
        data = {
            'user_id': self.test_user.id,
            'category_id': self.category.id,
            'notes': 'Test assignment'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify assignment
        self.test_user.refresh_from_db()
        self.assertEqual(self.test_user.category.id, self.category.id)
        self.assertIsNotNone(self.test_user.category_assigned_at)
        self.assertEqual(self.test_user.category_notes, 'Test assignment')

    def test_remove_category_assignment(self):
        """Test removing category assignment"""
        # First assign a category
        self.test_user.category = self.category
        self.test_user.save()

        # Now remove it
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('assign-category')
        data = {
            'user_id': self.test_user.id,
            'category_id': None,
            'notes': 'Test removal'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify removal
        self.test_user.refresh_from_db()
        self.assertIsNone(self.test_user.category)
        self.assertIsNone(self.test_user.category_assigned_at)

    def test_assign_invalid_category(self):
        """Test assigning invalid category"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('assign-category')
        data = {
            'user_id': self.test_user.id,
            'category_id': 99999  # Non-existent
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assign_to_invalid_user(self):
        """Test assigning to invalid user"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('assign-category')
        data = {
            'user_id': 99999,  # Non-existent
            'category_id': self.category.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserEffectiveProfitTestCase(TestCase):
    """Test user effective profit percentage calculation"""

    def setUp(self):
        self.default_category = CustomerCategory.objects.create(
            name='default',
            display_name='Default',
            profit_percentage=15.0,
            is_default=True
        )
        self.custom_category = CustomerCategory.objects.create(
            name='custom',
            display_name='Custom',
            profit_percentage=25.0
        )
        self.user_with_category = User.objects.create_user(
            name='user_with_cat',
            email='with@test.com',
            password='test123',
            role='user'
        )
        self.user_with_category.category = self.custom_category
        self.user_with_category.save()

        self.user_without_category = User.objects.create_user(
            name='user_no_cat',
            email='no@test.com',
            password='test123',
            role='user'
        )

    def test_user_with_category_profit(self):
        """Test profit percentage for user with assigned category"""
        self.assertEqual(self.user_with_category.effective_profit_percentage, Decimal('25.0'))

    def test_user_without_category_profit(self):
        """Test profit percentage for user without assigned category"""
        self.assertEqual(self.user_without_category.effective_profit_percentage, Decimal('15.0'))

    def test_customer_category_display_with_category(self):
        """Test customer_category_display for user with category"""
        self.assertEqual(self.user_with_category.customer_category_display, 'Custom')

    def test_customer_category_display_without_category(self):
        """Test customer_category_display for user without category"""
        self.assertEqual(self.user_without_category.customer_category_display, 'Default')


class ComprehensiveCategoryTests(APITestCase):
    """Comprehensive tests covering all category functionality"""

    def setUp(self):
        """Set up comprehensive test data"""
        # Create admin user
        self.admin = User.objects.create_superuser(
            name='admin',
            email='admin@test.com',
            password='admin123'
        )

        # Create multiple users
        self.users = []
        for i in range(5):
            user = User.objects.create_user(
                name=f'user{i}',
                email=f'user{i}@test.com',
                password='user123',
                role='user'
            )
            self.users.append(user)

        # Create agent
        self.agent = User.objects.create_user(
            name='agent1',
            email='agent@test.com',
            password='agent123',
            role='agent'
        )

        # Create categories
        self.categories = []
        for i, (name, display, profit) in enumerate([
            ('premium', 'Premium Customer', 20.0),
            ('standard', 'Standard Customer', 10.0),
            ('basic', 'Basic Customer', 5.0),
            ('vip', 'VIP Customer', 25.0)
        ]):
            category = CustomerCategory.objects.create(
                name=name,
                display_name=display,
                profit_percentage=profit,
                is_active=i < 3  # Make last one inactive
            )
            self.categories.append(category)

        # Set standard as default
        self.categories[1].is_default = True
        self.categories[1].save()

    def test_user_list_serializer_includes_categories(self):
        """Test that UserListSerializer includes category data"""
        # Assign categories to some users
        self.users[0].category = self.categories[0]  # premium
        self.users[0].save()
        self.users[1].category = self.categories[1]  # standard (default)
        self.users[1].save()
        # users[2] has no category (should get default)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('user-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()

        # Find our test users in the response
        user_data = {user['id']: user for user in data}

        # Check user with assigned category
        user0_data = user_data[self.users[0].id]
        self.assertIn('category_details', user0_data)
        self.assertEqual(user0_data['category_details']['name'], 'premium')
        self.assertEqual(user0_data['category_details']['display_name'], 'Premium Customer')

        # Check user with default category (no explicit assignment)
        user2_data = user_data[self.users[2].id]
        # For users without assigned categories, category_details will be None
        # They should use the default category for profit calculations
        self.assertIsNone(user2_data['category_details'])
        # But customer_category should show the default
        self.assertEqual(user2_data['customer_category'], 'Standard Customer')

    def test_agents_endpoint_includes_categories(self):
        """Test that agents endpoint includes category data"""
        # Assign category to agent
        self.agent.category = self.categories[0]
        self.agent.save()

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('agent-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        agent_data = next(a for a in data if a['id'] == self.agent.id)

        self.assertIn('category', agent_data)
        self.assertIn('category_details', agent_data)
        self.assertEqual(agent_data['category']['name'], 'premium')
        self.assertTrue(agent_data['has_assigned_category'])

    def test_bulk_assign_categories(self):
        """Test bulk category assignment"""
        self.client.force_authenticate(user=self.admin)

        user_ids = [u.id for u in self.users[:3]]
        data = {
            'user_ids': user_ids,
            'category_id': self.categories[0].id,
            'notes': 'Bulk test assignment'
        }

        response = self.client.post(reverse('bulk-assign-category'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response_data = response.json()
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['assigned_count'], 3)
        self.assertEqual(response_data['total_users'], 3)

        # Verify assignments
        for user in self.users[:3]:
            user.refresh_from_db()
            self.assertEqual(user.category, self.categories[0])
            self.assertEqual(user.category_notes, 'Bulk test assignment')

    def test_category_report_endpoint(self):
        """Test category report functionality"""
        # Assign categories
        self.users[0].category = self.categories[0]  # premium
        self.users[0].save()
        self.users[1].category = self.categories[1]  # standard
        self.users[1].save()
        self.users[2].category = self.categories[0]  # premium again
        self.users[2].save()
        # users[3] and [4] have no category

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('category-report'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn('categories', data)
        self.assertIn('summary', data)
        self.assertIn('total_users', data['summary'])
        self.assertIn('users_with_categories', data)
        self.assertIn('users_without_categories', data)

        # Check category counts
        categories = {cat['category_id']: cat for cat in data['categories']}
        self.assertEqual(categories[self.categories[0].id]['users_count'], 2)  # premium
        self.assertEqual(categories[self.categories[1].id]['users_count'], 1)  # standard

    def test_default_category_behavior(self):
        """Test default category assignment and fallback"""
        # Remove all default flags
        CustomerCategory.objects.all().update(is_default=False)

        # Set premium as default
        self.categories[0].is_default = True
        self.categories[0].save()

        # User without category should get default profit
        user_no_cat = self.users[0]
        user_no_cat.category = None
        user_no_cat.save()

        self.assertEqual(float(user_no_cat.effective_profit_percentage), 20.0)

        # User with category should keep their category profit
        user_with_cat = self.users[1]
        user_with_cat.category = self.categories[1]  # standard 10%
        user_with_cat.save()

        self.assertEqual(float(user_with_cat.effective_profit_percentage), 10.0)

    def test_category_users_endpoint(self):
        """Test getting users for a specific category"""
        # Assign multiple users to premium category
        for user in self.users[:3]:
            user.category = self.categories[0]
            user.save()

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            reverse('customercategory-category-users', kwargs={'pk': self.categories[0].id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(len(data), 3)
        user_ids = [u['id'] for u in data]
        self.assertIn(self.users[0].id, user_ids)
        self.assertIn(self.users[1].id, user_ids)
        self.assertIn(self.users[2].id, user_ids)

    def test_inactive_category_assignment_fails(self):
        """Test that inactive categories cannot be assigned"""
        inactive_category = self.categories[3]  # vip is inactive
        self.assertFalse(inactive_category.is_active)

        self.client.force_authenticate(user=self.admin)
        data = {
            'user_id': self.users[0].id,
            'category_id': inactive_category.id
        }

        response = self.client.post(reverse('assign-category'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_category_update_audit(self):
        """Test that category updates are audited"""
        from ..models import AuditLog

        initial_count = AuditLog.objects.count()

        self.client.force_authenticate(user=self.admin)
        data = {'profit_percentage': 22.0}
        response = self.client.patch(
            reverse('customercategory-detail', kwargs={'pk': self.categories[0].id}),
            data, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should have created audit log
        self.assertGreater(AuditLog.objects.count(), initial_count)

    def test_user_category_assignment_audit(self):
        """Test that user category assignments are audited"""
        from ..models import AuditLog

        initial_count = AuditLog.objects.count()

        self.client.force_authenticate(user=self.admin)
        data = {
            'user_id': self.users[0].id,
            'category_id': self.categories[0].id
        }

        response = self.client.post(reverse('assign-category'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Should have created audit log
        self.assertGreater(AuditLog.objects.count(), initial_count)

    def test_mixed_role_users_in_list(self):
        """Test that user list includes users of all roles with category data"""
        # Create users of different roles
        admin_user = User.objects.create_user(
            name='test_admin',
            email='test_admin@test.com',
            password='admin123',
            role='admin'
        )
        agent_user = User.objects.create_user(
            name='test_agent',
            email='test_agent@test.com',
            password='agent123',
            role='agent'
        )

        # Assign categories
        admin_user.category = self.categories[0]
        admin_user.save()
        agent_user.category = self.categories[1]
        agent_user.save()

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse('user-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()

        # Should include all users regardless of role
        user_ids = [u['id'] for u in data]
        self.assertIn(admin_user.id, user_ids)
        self.assertIn(agent_user.id, user_ids)
        self.assertIn(self.agent.id, user_ids)

        # Check category data is included
        for user_data in data:
            if user_data['id'] in [admin_user.id, agent_user.id, self.agent.id]:
                self.assertIn('category_details', user_data)