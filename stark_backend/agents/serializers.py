from decimal import Decimal, InvalidOperation
from rest_framework import serializers
from .models import AgentProductAssignment, AgentProfile
from users.models import User

class AgentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentProfile
        fields = [
            "id",
            "user",
            "commission_rate",
            "total_earnings",
            "total_earnings_usd",
            "total_earnings_syp",
            "region",
            "coverage_limit_usd",
            "coverage_limit_syp",
        ]


class AgentProductAssignmentSerializer(serializers.ModelSerializer):
    agent_name = serializers.ReadOnlyField(source='agent.full_name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = AgentProductAssignment
        fields = ['id', 'agent', 'agent_name', 'product', 'product_name', 'commission_percent', 'is_active', 'created_at']

    def validate_commission_percent(self, value):
        try:
            rate = Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise serializers.ValidationError('commission_percent must be a decimal percentage.') from exc
        if not rate.is_finite() or rate < 0 or rate >= 100:
            raise serializers.ValidationError('commission_percent must be between 0 and 99.99.')
        return rate.quantize(Decimal('0.01'))


    
class AgentProfileRegionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = AgentProfile
        fields = ['agent_name', 'region']
