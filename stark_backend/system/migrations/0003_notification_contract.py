from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("system", "0002_alter_ad_options_alter_lastaction_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="details",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="notification",
            name="type",
            field=models.CharField(default="general", max_length=64),
        ),
        migrations.AlterField(
            model_name="notification",
            name="icon",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "is_read", "created_at"], name="notif_recipient_read_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "created_at"], name="notif_recipient_date_idx"),
        ),
    ]