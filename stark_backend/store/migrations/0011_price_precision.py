from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('store', '0010_alter_product_customization_options'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='base_price',
            field=models.DecimalField(decimal_places=8, max_digits=20, verbose_name='Base Price', help_text='Price per unit for amount-based and customization-based products.'),
        ),
        migrations.AlterField(
            model_name='product',
            name='min_amount',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=20, null=True, verbose_name='Minimum Amount', help_text='Minimum amount user can purchase (for amount-based products)'),
        ),
        migrations.AlterField(
            model_name='product',
            name='max_amount',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=20, null=True, verbose_name='Maximum Amount', help_text='Maximum amount user can purchase (for amount-based products)'),
        ),
        migrations.AlterField(
            model_name='externalproduct',
            name='base_price',
            field=models.DecimalField(decimal_places=8, max_digits=20, verbose_name='Base Price', help_text='Price from the external API'),
        ),
        migrations.AlterField(
            model_name='storeproduct',
            name='price',
            field=models.DecimalField(decimal_places=8, max_digits=20, verbose_name='Price', help_text='Custom price for this product'),
        ),
    ]
