from django.core.management.base import BaseCommand
from users.models import User, CustomerCategory

class Command(BaseCommand):
    help = 'Fix users with 0% profit percentage by assigning default category'

    def handle(self, *args, **options):
        default_cat = CustomerCategory.objects.filter(is_default=True, is_active=True).first()
        if not default_cat:
            self.stdout.write(self.style.ERROR('No default category found!'))
            return

        fixed_count = 0
        for user in User.objects.all():
            profit = user.effective_profit_percentage
            if profit == 0:
                # Remove 0% categories
                if user.category and user.category.profit_percentage == 0:
                    user.remove_category()
                    self.stdout.write(f"Removed 0% category from {user.name}")
                # Assign default if uncategorized
                elif not user.category:
                    user.assign_category(default_cat, None, "Auto-fixed by management command")
                    self.stdout.write(f"Assigned default category to {user.name}")
                
                fixed_count += 1
                user.save()

        self.stdout.write(self.style.SUCCESS(f'Fixed {fixed_count} users with 0% profit percentage'))