from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="agentprofile",
            name="coverage_limit",
            field=models.DecimalField(
                max_digits=12,
                decimal_places=2,
                default=0.00,
                help_text="Maximum negative balance allowed for agent wallet",
            ),
        ),
    ]
