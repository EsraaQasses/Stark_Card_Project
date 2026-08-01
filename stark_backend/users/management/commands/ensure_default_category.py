from django.core.management.base import BaseCommand
from users.models import CustomerCategory


class Command(BaseCommand):
    help = "Ensure a default customer category exists (Regular User at 15%)"

    def handle(self, *args, **options):
        name = "regularuser"
        display_name = "Regular User"
        profit_percentage = 15

        cat, created = CustomerCategory.objects.get_or_create(
            name=name,
            defaults={
                "display_name": display_name,
                "profit_percentage": profit_percentage,
                "is_default": True,
                "is_active": True,
                "description": "Default category assigned to new users",
            },
        )

        # If it already existed, ensure the key fields are correct and set as default
        changed = False
        if not cat.is_default:
            cat.is_default = True
            changed = True
        if float(cat.profit_percentage) != float(profit_percentage):
            cat.profit_percentage = profit_percentage
            changed = True
        if cat.display_name != display_name:
            cat.display_name = display_name
            changed = True
        if not cat.is_active:
            cat.is_active = True
            changed = True

        if changed:
            cat.save()
            self.stdout.write(self.style.SUCCESS("Updated existing default category."))
        elif created:
            self.stdout.write(self.style.SUCCESS("Created default category."))
        else:
            self.stdout.write("Default category already present and correct.")

