from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("users", "0016_remove_must_change_password")]

    operations = [migrations.DeleteModel(name="PasswordResetToken")]
