from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("agents", "0004_merge_0002_earnings_0003_currency_limits")]

    operations = [
        migrations.AddField(
            model_name="agentproductassignment",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="agentproductassignment",
            name="commission_percent",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                validators=[
                    MinValueValidator(Decimal("0.00")),
                    MaxValueValidator(Decimal("99.99")),
                ],
            ),
        ),
    ]
