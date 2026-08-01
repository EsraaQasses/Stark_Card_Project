from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentprofile",
            name="total_earnings_usd",
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
        migrations.AddField(
            model_name="agentprofile",
            name="total_earnings_syp",
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
    ]
