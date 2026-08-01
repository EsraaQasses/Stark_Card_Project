from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdminUser

from .reporting import FinancialReportService, ReportPeriodError


class CurrencyTotalsSerializer(serializers.Serializer):
    USD = serializers.CharField(required=False)
    SYP = serializers.CharField(required=False)


class FinancialReportBoundarySerializer(serializers.Serializer):
    start_inclusive = serializers.DateTimeField()
    end_exclusive = serializers.DateTimeField()


class FinancialReportSerializer(serializers.Serializer):
    period = serializers.ChoiceField(choices=("daily", "weekly", "monthly", "custom"))
    timezone = serializers.CharField()
    boundary = FinancialReportBoundarySerializer()
    source_of_truth = serializers.CharField()
    display_only_current_equivalents = serializers.BooleanField()
    totals = serializers.DictField(child=serializers.DictField(child=serializers.CharField()))
    status_totals = serializers.DictField(child=serializers.DictField(child=serializers.CharField()))
    operation_count = serializers.IntegerField()


class FinancialReportErrorSerializer(serializers.Serializer):
    error = serializers.CharField()
    error_code = serializers.CharField()


class FinancialReportView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="period", type=str, location=OpenApiParameter.QUERY,
                enum=["daily", "weekly", "monthly", "custom"], required=False,
            ),
            OpenApiParameter(name="date", type=str, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name="start_date", type=str, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name="end_date", type=str, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={
            200: FinancialReportSerializer,
            400: OpenApiResponse(response=FinancialReportErrorSerializer),
        },
        description=(
            "Admin-only historical accounting report. Dates use the project "
            "timezone; custom end_date is inclusive and represented as the "
            "following local midnight exclusive. Amounts are decimal strings."
        ),
    )
    def get(self, request):
        try:
            report = FinancialReportService.build(
                period=request.query_params.get("period", "daily"),
                anchor=request.query_params.get("date"),
                start_date=request.query_params.get("start_date"),
                end_date=request.query_params.get("end_date"),
            )
        except ReportPeriodError as exc:
            return Response({"error": str(exc), "error_code": exc.code}, status=400)
        return Response(report)
