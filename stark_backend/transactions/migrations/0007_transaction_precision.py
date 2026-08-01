from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0006_alter_transaction_amount_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='transaction',
            name='amount',
            field=models.DecimalField(decimal_places=8, max_digits=20, verbose_name='Amount'),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='amount_syp',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=20, null=True, help_text='Automatically calculated SYP equivalent', verbose_name='Amount (SYP)'),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='amount_usd',
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=20, null=True, help_text='Automatically calculated USD equivalent', verbose_name='Amount (USD)'),
        ),
    ]
