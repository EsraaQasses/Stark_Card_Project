from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("shipping", "0003_shipping_currency_uppercase"),
        ("payment_methods", "0006_remove_paymentmethod_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="StandardShippingRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("currency", models.CharField(choices=[("USD", "USD"), ("SYP", "SYP")], default="USD", max_length=3)),
                ("wallet_currency", models.CharField(choices=[("USD", "USD"), ("SYP", "SYP")], default="USD", max_length=3)),
                ("user_input_data", models.JSONField(blank=True, default=dict)),
                ("receipt_image", models.ImageField(blank=True, null=True, upload_to="receipts/")),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"), ("processing", "Processing"), ("failed", "Failed")], default="pending", max_length=20)),
                ("admin_notes", models.TextField(blank=True, null=True)),
                ("transaction_ref", models.CharField(blank=True, max_length=100, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_standard_shippings", to=settings.AUTH_USER_MODEL, verbose_name="Approved By")),
                ("payment_method", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="payment_methods.paymentmethod")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="standard_shippings", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Standard Shipping Request",
                "verbose_name_plural": "Standard Shipping Requests",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="AgentShippingRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("currency", models.CharField(choices=[("USD", "USD"), ("SYP", "SYP")], default="USD", max_length=3)),
                ("wallet_currency", models.CharField(choices=[("USD", "USD"), ("SYP", "SYP")], default="USD", max_length=3)),
                ("user_input_data", models.JSONField(blank=True, default=dict)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"), ("processing", "Processing"), ("failed", "Failed")], default="pending", max_length=20)),
                ("agent_notes", models.TextField(blank=True, null=True)),
                ("user_transaction_ref", models.CharField(blank=True, max_length=100, null=True)),
                ("agent_transaction_ref", models.CharField(blank=True, max_length=100, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_agent_shippings", to=settings.AUTH_USER_MODEL, verbose_name="Approved By")),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assigned_agent_shippings", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="agent_shippings", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Agent Shipping Request",
                "verbose_name_plural": "Agent Shipping Requests",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="AgentAdminShippingRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("currency", models.CharField(choices=[("USD", "USD"), ("SYP", "SYP")], default="USD", max_length=3)),
                ("wallet_currency", models.CharField(choices=[("USD", "USD"), ("SYP", "SYP")], default="USD", max_length=3)),
                ("user_input_data", models.JSONField(blank=True, default=dict)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected"), ("processing", "Processing"), ("failed", "Failed")], default="pending", max_length=20)),
                ("admin_notes", models.TextField(blank=True, null=True)),
                ("transaction_ref", models.CharField(blank=True, max_length=100, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_admin_agent_shippings", to=settings.AUTH_USER_MODEL, verbose_name="Approved By")),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="admin_shippings", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Agent Shipping via Admin Request",
                "verbose_name_plural": "Agent Shipping via Admin Requests",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="standardshippingrequest",
            index=models.Index(fields=["status", "created_at"], name="shipping_stand_status_7a0a31_idx"),
        ),
        migrations.AddIndex(
            model_name="standardshippingrequest",
            index=models.Index(fields=["user", "status"], name="shipping_stand_user_id_78a338_idx"),
        ),
        migrations.AddIndex(
            model_name="agentshippingrequest",
            index=models.Index(fields=["status", "created_at"], name="shipping_agent_status_1f4ed8_idx"),
        ),
        migrations.AddIndex(
            model_name="agentshippingrequest",
            index=models.Index(fields=["user", "status"], name="shipping_agent_user_id_4b3f4c_idx"),
        ),
        migrations.AddIndex(
            model_name="agentshippingrequest",
            index=models.Index(fields=["agent", "status"], name="shipping_agent_agent_i_e2d9ce_idx"),
        ),
        migrations.AddIndex(
            model_name="agentadminshippingrequest",
            index=models.Index(fields=["status", "created_at"], name="shipping_agentadmin_status_1b9c01_idx"),
        ),
        migrations.AddIndex(
            model_name="agentadminshippingrequest",
            index=models.Index(fields=["agent", "status"], name="shipping_agentadmin_agent__df7c4d_idx"),
        ),
    ]
