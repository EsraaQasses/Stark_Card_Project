from drf_spectacular.utils import OpenApiResponse, extend_schema
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.permissions import IsAdminUser
from users.utils.audit_logger import AuditLogger
from .models import ThirdPartyAPI
from .services.wawp_service import WAWPService, WAWPServiceError
from .wawp_serializers import WAWPConfigurationSerializer, WAWPTestMessageSerializer


def _result_error(exc):
    return {"success": False, "status": "error", "error_code": exc.code, "message": exc.message}


class WAWPConfigurationView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(responses=WAWPConfigurationSerializer)
    def get(self, request):
        config = ThirdPartyAPI.objects.filter(provider="wawp").first()
        return Response(WAWPConfigurationSerializer(config).data if config else None)

    @extend_schema(request=WAWPConfigurationSerializer, responses=WAWPConfigurationSerializer)
    def post(self, request):
        if ThirdPartyAPI.objects.filter(provider="wawp").exists():
            return Response({"success": False, "error_code": "WAWP_ALREADY_CONFIGURED", "message": "WAWP is already configured."}, status=status.HTTP_409_CONFLICT)
        serializer = WAWPConfigurationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        AuditLogger.log(request, "WAWP_CONFIGURATION_CREATED", "wawp", config.id)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(request=WAWPConfigurationSerializer, responses=WAWPConfigurationSerializer)
    def patch(self, request):
        config = ThirdPartyAPI.objects.filter(provider="wawp").first()
        if not config:
            return Response({"success": False, "error_code": "WAWP_NOT_CONFIGURED", "message": "WAWP is not configured."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WAWPConfigurationSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLogger.log(request, "WAWP_CONFIGURATION_UPDATED", "wawp", config.id, {"credentials_replaced": "access_token" in request.data})
        return Response(serializer.data)

    def delete(self, request):
        config = ThirdPartyAPI.objects.filter(provider="wawp").first()
        if config:
            config.delete()
            AuditLogger.log(request, "WAWP_CONFIGURATION_DELETED", "wawp")
        return Response(status=status.HTTP_204_NO_CONTENT)


class WAWPActionView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, action):
        config = ThirdPartyAPI.objects.filter(provider="wawp").first()
        if action in {"activate", "deactivate"}:
            if not config:
                return Response({"success": False, "error_code": "WAWP_NOT_CONFIGURED", "message": "WAWP is not configured."}, status=404)
            config.is_active = action == "activate"
            try:
                config.save(update_fields=["is_active", "updated_at"])
            except IntegrityError:
                return Response({"success": False, "error_code": "WAWP_ALREADY_ACTIVE", "message": "Another WAWP configuration is already active."}, status=status.HTTP_409_CONFLICT)
            AuditLogger.log(request, f"WAWP_{action.upper()}D", "wawp", config.id)
            return Response({"success": True, "is_active": config.is_active})
        try:
            if action == "test-connection":
                result = WAWPService.test_connection()
                AuditLogger.log(request, "WAWP_CONNECTION_TESTED", "wawp", config.id if config else None, {"status": result.get("status")})
                return Response(result, status=200 if result.get("success") else 502)
            if action == "test-message":
                serializer = WAWPTestMessageSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                data = serializer.validated_data
                phone = data.get("phone") or data["user_id"].phone
                result = WAWPService.send_text(phone, data["message"])
                AuditLogger.log(request, "WAWP_TEST_MESSAGE_REQUESTED", "wawp", config.id if config else None, {"recipient_type": "user" if data.get("user_id") else "manual"})
                return Response(result)
        except WAWPServiceError as exc:
            return Response(_result_error(exc), status=502)
        return Response({"success": False, "error_code": "INVALID_ACTION", "message": "Unsupported WAWP action."}, status=400)
