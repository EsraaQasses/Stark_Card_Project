from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("users", "0015_password_lifecycle")]

    operations = [migrations.RemoveField(model_name="user", name="must_change_password")]
