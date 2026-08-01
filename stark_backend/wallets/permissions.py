# wallets/permissions.py
from rest_framework.permissions import BasePermission

class IsAdminUser(BasePermission):
    """
    Allows access only to admin users.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "admin"


class CanManageExchangeRates(BasePermission):
    """Dedicated permission for quote activation and rate history management."""

    message = "FX_RATE_PERMISSION_DENIED"

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "admin"
        )


class IsAgentOrAdmin(BasePermission):
    """
    Allows access to agents and admins.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ["agent", "admin"]
