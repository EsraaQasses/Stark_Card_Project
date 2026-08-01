from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal

from store.models import StoreProduct
from store.serializers import calculate_final_price
from users.models import CustomerCategory


class Command(BaseCommand):
    help = "Show sample prices for admin and a VIP1 user with 10% for a sample StoreProduct"

    def handle(self, *args, **options):
        User = get_user_model()

        # Ensure we have at least one StoreProduct
        product = StoreProduct.objects.filter(is_active=True).first() or StoreProduct.objects.first()
        if not product:
            self.stdout.write(self.style.ERROR("No StoreProduct found. Please create at least one product."))
            return

        base_price = Decimal(str(product.price))
        self.stdout.write(f"Using StoreProduct: id={product.id}, name='{product.name}', base_price={base_price}")

        # Create or get an admin user
        admin_user, _ = User.objects.get_or_create(name='admin_test_user', defaults={
            'full_name': 'Admin Test',
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True,
            'password': 'admin12345',
        })
        # Ensure flags
        admin_user.role = 'admin'
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()

        # Create or get VIP1 category with 10%
        vip1, _ = CustomerCategory.objects.get_or_create(name='vip1', defaults={
            'display_name': 'VIP 1',
            'profit_percentage': Decimal('10.00'),
            'is_active': True,
            'order': 1,
        })

        # Create or get a normal user and assign category
        normal_user, _ = User.objects.get_or_create(name='vip1_user_test', defaults={
            'full_name': 'VIP1 User Test',
            'role': 'user',
            'password': 'user12345',
        })
        normal_user.role = 'user'
        normal_user.category = vip1
        normal_user.save()

        # Compute prices
        admin_price = calculate_final_price(base_price, admin_user)
        vip1_price = calculate_final_price(base_price, normal_user)

        self.stdout.write(self.style.SUCCESS("Results:"))
        self.stdout.write(f"- Admin user price: {admin_price}")
        self.stdout.write(f"- VIP1 (10%) user price: {vip1_price}")
