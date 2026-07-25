from rest_framework import serializers
from .models import AgentProductAssignment, AgentProfile
from users.models import User

class AgentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentProfile
        fields = ["id", "user", "commission_rate", "total_earnings", "region"]


class AgentProductAssignmentSerializer(serializers.ModelSerializer):
    agent_name = serializers.ReadOnlyField(source='agent.full_name')
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = AgentProductAssignment
        fields = ['id', 'agent', 'agent_name', 'product', 'product_name', 'commission_percent', 'created_at']


    
class AgentProfileRegionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = AgentProfile
        fields = ['agent_name', 'region']