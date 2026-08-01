from rest_framework import serializers


class FilterValidationErrorSerializer(serializers.Serializer):
    filters = serializers.DictField(child=serializers.ListField(child=serializers.CharField()))


class CashoutListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    amount = serializers.FloatField()
    currency = serializers.CharField()
    status = serializers.CharField()
    note = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    wallet_id = serializers.IntegerField(allow_null=True)
    user_id = serializers.IntegerField()
    user_name = serializers.CharField(allow_null=True)
    user_email = serializers.CharField(allow_null=True)
    user_phone = serializers.CharField(allow_null=True)
    agent_id = serializers.IntegerField(allow_null=True)
    agent_name = serializers.CharField(allow_null=True)
    agent_email = serializers.CharField(allow_null=True)
    agent_phone = serializers.CharField(allow_null=True)
