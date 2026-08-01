from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("transactions", "0010_transaction_idempotency_key_transaction_balance_after"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="balance_before",
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=20, null=True),
        ),
    ]
