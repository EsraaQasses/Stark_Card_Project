from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    """Check if user is admin"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated 
                   and request.user.role == "admin")

class IsSuperAdmin(permissions.BasePermission):
    """Check if user is super admin"""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated 
                   and request.user.role == "admin" 
                   and request.user.is_superuser)

class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admin"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        return bool(request.user and request.user.is_authenticated 
                   and request.user.role == "admin")
        
class IsRegularUser(permissions.BasePermission):
    """Allow any authenticated (used for user-facing endpoints)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
