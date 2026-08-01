from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("payment_methods", "0003_paymentmethod_currency_uppercase"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentmethod",
            name="requires_receipt",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="allow_manual",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="paymentmethod",
            name="allow_agent",
            field=models.BooleanField(default=False),
        ),
    ]
