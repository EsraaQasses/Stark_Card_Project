from django.core.exceptions import ObjectDoesNotExist
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsAdminUser
from ..services.customer_admin import CustomerAdministrationService, CustomerAdminError


class CustomerAggregateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, customer_id):
        try:
            return Response(CustomerAdministrationService.aggregate(
                request.user, customer_id, request.query_params.get("limit", 25)
            ))
        except ObjectDoesNotExist:
            return Response({"error": "Customer not found", "error_code": "CUSTOMER_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, TypeError):
            return Response({"error": "limit must be an integer", "error_code": "INVALID_LIMIT"}, status=status.HTTP_400_BAD_REQUEST)


class CustomerActionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, customer_id, action):
        service = CustomerAdministrationService
        reason = request.data.get("reason", "")
        try:
            if action == "ban":
                target = service.set_banned(request.user, customer_id, True, reason, request)
                return Response({"success": True, "id": target.id, "is_banned": target.is_banned})
            if action == "unban":
                target = service.set_banned(request.user, customer_id, False, reason, request)
                return Response({"success": True, "id": target.id, "is_banned": target.is_banned})
            if action == "activate":
                target = service.set_active(request.user, customer_id, True, reason, request)
                return Response({"success": True, "id": target.id, "is_active": target.is_active})
            if action == "deactivate":
                target = service.set_active(request.user, customer_id, False, reason, request)
                return Response({"success": True, "id": target.id, "is_active": target.is_active})
            if action == "category":
                target = service.assign_category(request.user, customer_id, request.data.get("category_id"), request.data.get("notes", ""), request)
                return Response({"success": True, "id": target.id, "category_id": target.category_id})
            if action == "agent":
                target = service.assign_agent(request.user, customer_id, request.data.get("agent_id"), request)
                return Response({"success": True, "id": target.id, "agent_id": target.agent_id})
            if action == "role":
                target = service.change_role(request.user, customer_id, request.data.get("role"), request.data.get("make_superuser", False), request)
                return Response({"success": True, "id": target.id, "role": target.role})
            if action == "password-reset":
                return Response(service.send_password_reset(request.user, customer_id, reason, request))
            if action == "revoke-sessions":
                return Response(service.revoke_sessions(request.user, customer_id, reason, request))
            return Response({"error": "Unknown customer action", "error_code": "UNKNOWN_ACTION"}, status=status.HTTP_404_NOT_FOUND)
        except ObjectDoesNotExist:
            return Response({"error": "Target not found", "error_code": "TARGET_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)
        except CustomerAdminError as exc:
            return Response({"error": str(exc), "error_code": getattr(exc, "code", "CUSTOMER_ADMIN_ERROR")}, status=status.HTTP_403_FORBIDDEN)
        except Exception as exc:
            if hasattr(exc, "detail"):
                return Response({"error": str(exc.detail), "error_code": "VALIDATION_ERROR"}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"error": str(exc), "error_code": "CUSTOMER_ADMIN_FAILED"}, status=status.HTTP_400_BAD_REQUEST)


class CustomerBalanceAdjustmentRequestView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, customer_id):
        try:
            adjustment = CustomerAdministrationService.request_adjustment(
                request.user, customer_id, request.data.get("amount"), request.data.get("currency"),
                request.data.get("reason", ""), request.data.get("idempotency_key"), request,
            )
            return Response({"id": adjustment.id, "status": adjustment.status, "amount": str(adjustment.amount),
                             "currency": adjustment.currency, "idempotency_key": adjustment.idempotency_key,
                             "transaction_id": adjustment.transaction_id},
                            status=status.HTTP_200_OK if adjustment.pk else status.HTTP_201_CREATED)
        except ObjectDoesNotExist:
            return Response({"error": "Customer or wallet not found", "error_code": "TARGET_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return Response({"error": str(getattr(exc, "detail", exc)), "error_code": getattr(exc, "code", "ADJUSTMENT_INVALID")}, status=status.HTTP_400_BAD_REQUEST)


class CustomerBalanceAdjustmentDecisionView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, adjustment_id, decision):
        try:
            adjustment = CustomerAdministrationService.decide_adjustment(
                request.user, adjustment_id, decision == "approve", request.data.get("reason", ""), request,
            )
            return Response({"id": adjustment.id, "status": adjustment.status, "transaction_id": adjustment.transaction_id})
        except ObjectDoesNotExist:
            return Response({"error": "Adjustment not found", "error_code": "ADJUSTMENT_NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return Response({"error": str(getattr(exc, "detail", exc)), "error_code": getattr(exc, "code", "ADJUSTMENT_FAILED")}, status=status.HTTP_400_BAD_REQUEST)
