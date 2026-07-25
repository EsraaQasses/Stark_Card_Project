from django.db import models
from django.conf import settings

from store.models import Product

User = settings.AUTH_USER_MODEL

class AgentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="agent_profile")
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    region = models.CharField(max_length=255, blank=True, null=True) 

    def __str__(self):
        return f"Agent: {self.user.name}"


class AgentProductAssignment(models.Model):
    agent = models.ForeignKey(User, limit_choices_to={'role': 'agent'}, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('agent', 'product')  # يمنع تخصيص نفس المنتج لنفس الوكيل أكثر من مرة

    def __str__(self):
        return f"{self.agent.full_name} - {self.product.name} ({self.commission_percent}%)"

