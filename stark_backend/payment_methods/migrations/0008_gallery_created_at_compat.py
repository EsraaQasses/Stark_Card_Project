from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("payment_methods", "0007_payment_method_gallery"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE payment_methods_paymentmethodimage
                ADD COLUMN IF NOT EXISTS created_at
                timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
