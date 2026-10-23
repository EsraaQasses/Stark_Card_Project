# Generated for Stark Card payment method additional gallery images
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [('payment_methods', '0006_remove_paymentmethod_fields')]
    operations = [migrations.CreateModel(name='PaymentMethodImage', fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('image', models.ImageField(upload_to='payment_methods/gallery/')),
        ('sort_order', models.PositiveIntegerField(default=0)),
        ('created_at', models.DateTimeField(auto_now_add=True)),
        ('payment_method', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='additional_images', to='payment_methods.paymentmethod')),
    ], options={'ordering': ['sort_order', 'id']})]
