from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("agents", "0002_agentprofile_coverage_limit"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="agentprofile",
            name="coverage_limit",
        ),
        migrations.AddField(
            model_name="agentprofile",
            name="coverage_limit_syp",
            field=models.DecimalField(
                decimal_places=2,
                default=0.0,
                help_text="Maximum negative balance allowed for agent SYP wallet",
                max_digits=12,
            ),
        ),
        migrations.AddField(
            model_name="agentprofile",
            name="coverage_limit_usd",
            field=models.DecimalField(
                decimal_places=2,
                default=0.0,
                help_text="Maximum negative balance allowed for agent USD wallet",
                max_digits=12,
            ),
        ),
    ]
