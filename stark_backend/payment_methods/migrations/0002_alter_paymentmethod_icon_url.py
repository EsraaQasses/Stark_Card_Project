from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payment_methods', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='paymentmethod',
            name='icon_url',
            field=models.ImageField(blank=True, null=True, upload_to='payment_methods/'),
        ),
    ]
