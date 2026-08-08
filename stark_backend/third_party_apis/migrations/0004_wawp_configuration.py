from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("third_party_apis", "0003_productsyncrun_productsyncresult_and_more")]

    operations = [
        migrations.AddField(
            model_name="thirdpartyapi",
            name="instance_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AlterField(
            model_name="thirdpartyapi",
            name="provider",
            field=models.CharField(
                choices=[
                    ("wawp", "WAWP"),
                    ("daily", "Daily"),
                    ("alfaour", "Alfaour"),
                    ("alaaeddin", "Alaaeddin"),
                    ("stark-card", "Stark-Card"),
                ],
                max_length=50,
            ),
        ),
        migrations.AddConstraint(
            model_name="thirdpartyapi",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True, provider="wawp"),
                fields=("provider",),
                name="one_active_wawp_configuration",
            ),
        ),
    ]
