from django.db import migrations


def ensure_created_at(apps, schema_editor):
    model = apps.get_model("payment_methods", "PaymentMethodImage")
    with schema_editor.connection.cursor() as cursor:
        columns = schema_editor.connection.introspection.get_table_description(
            cursor, model._meta.db_table
        )
    if any(column.name == "created_at" for column in columns):
        return
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("""
            ALTER TABLE payment_methods_paymentmethodimage
            ADD COLUMN IF NOT EXISTS created_at
            timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;
        """)
    else:
        schema_editor.add_field(model, model._meta.get_field("created_at"))


class Migration(migrations.Migration):
    dependencies = [
        ("payment_methods", "0007_payment_method_gallery"),
    ]

    operations = [
        migrations.RunPython(ensure_created_at, migrations.RunPython.noop),
    ]
