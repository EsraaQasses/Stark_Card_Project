from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallets', '0006_alter_wallet_available_balance_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='wallet',
            name='available_balance',
            field=models.DecimalField(decimal_places=8, default=0.0, max_digits=20, verbose_name='Available Balance'),
        ),
        migrations.AlterField(
            model_name='wallet',
            name='pending_balance',
            field=models.DecimalField(decimal_places=8, default=0.0, max_digits=20, verbose_name='Pending Balance'),
        ),
    ]
