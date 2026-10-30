from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('payment_methods', '0009_payment_media_details')]
    operations = [migrations.AddField(
        model_name='paymentmethod', name='instruction_image',
        field=models.ImageField(blank=True, null=True, upload_to='payment_methods/instructions/'),
    )]
