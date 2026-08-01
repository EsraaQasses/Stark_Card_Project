from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0002_add_amount_syp'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='exchange_rate_used',
            field=models.DecimalField(blank=True, null=True, decimal_places=6, max_digits=16, help_text='USD to SYP rate used for this transaction'),
        ),
    ]
