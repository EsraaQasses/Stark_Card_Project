from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('store', '0015_external_product_admin_disable'),
        ('users', '0018_alter_auditlog_action_customerbalanceadjustment'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name='ProductCategoryProfit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('profit_percentage', models.DecimalField(blank=True, null=True, max_digits=5, decimal_places=2, validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('999.99'))])),
                ('revision', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='category_profit_rates', to='store.product')),
                ('customer_category', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='product_profit_rates', to='users.customercategory')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(model_name='productcategoryprofit', constraint=models.UniqueConstraint(fields=('product', 'customer_category'), name='store_unique_product_category_profit')),
        migrations.AddConstraint(model_name='productcategoryprofit', constraint=models.CheckConstraint(check=models.Q(profit_percentage__isnull=True) | (models.Q(profit_percentage__gte=0) & models.Q(profit_percentage__lte=Decimal('999.99'))), name='store_category_profit_bounds')),
    ]
