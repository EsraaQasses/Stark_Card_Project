from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("users", "0014_userloginsession")]

    operations = [
        migrations.AddField(model_name="user", name="auth_version", field=models.PositiveIntegerField(default=1)),
        migrations.AddField(model_name="user", name="must_change_password", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="user", name="password_changed_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(
            name="PasswordResetChallenge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("request_id", models.CharField(max_length=128, unique=True)),
                ("code_hash", models.CharField(max_length=256)),
                ("purpose", models.CharField(choices=[("password_reset", "Password reset")], default="password_reset", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("resend_available_at", models.DateTimeField()),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("max_attempts", models.PositiveSmallIntegerField(default=5)),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("locked_at", models.DateTimeField(blank=True, null=True)),
                ("requested_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="password_reset_challenges", to=settings.AUTH_USER_MODEL)),
            ],
            options={"indexes": [models.Index(fields=["user", "purpose", "consumed_at", "expires_at"], name="users_passw_user_id_5a0490_idx"), models.Index(fields=["request_id", "purpose"], name="users_passw_request_10472c_idx")]},
        ),
        migrations.CreateModel(
            name="PasswordResetAuthorization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_hash", models.CharField(max_length=256, unique=True)),
                ("purpose", models.CharField(choices=[("password_reset", "Password reset")], default="password_reset", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("challenge", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="authorizations", to="users.passwordresetchallenge")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="password_reset_authorizations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"indexes": [models.Index(fields=["user", "purpose", "consumed_at", "expires_at"], name="users_passw_user_id_84ba3c_idx")]},
        ),
    ]
