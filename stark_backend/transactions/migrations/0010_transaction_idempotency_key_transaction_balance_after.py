from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("transactions", "0009_transaction_transaction_transac_731d8f_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="idempotency_key",
            field=models.CharField(blank=True, max_length=128, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="balance_after",
            field=models.DecimalField(blank=True, decimal_places=8, max_digits=20, null=True),
        ),
    ]
