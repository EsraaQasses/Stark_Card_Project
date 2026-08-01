from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transactions', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='amount_syp',
            field=models.DecimalField(blank=True, null=True, decimal_places=2, max_digits=14),
        ),
    ]
