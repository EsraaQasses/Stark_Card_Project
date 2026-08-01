from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("payment_methods", "0005_paymentmethod_steps"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="paymentmethod",
            name="currency",
        ),
        migrations.RemoveField(
            model_name="paymentmethod",
            name="allow_manual",
        ),
        migrations.RemoveField(
            model_name="paymentmethod",
            name="allow_agent",
        ),
        migrations.RemoveField(
            model_name="paymentmethod",
            name="description",
        ),
        migrations.RemoveField(
            model_name="paymentmethod",
            name="steps",
        ),
    ]
