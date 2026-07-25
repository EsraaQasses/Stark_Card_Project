from rest_framework.permissions import BasePermission

class IsAdminUser(BasePermission):
    """
    يسمح بالوصول فقط للمستخدمين الذين دورهم 'admin'.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


from rest_framework.permissions import BasePermission

class IsRegularUser(BasePermission):
    """
    يسمح بالوصول فقط للمستخدمين الذين دورهم 'user' أو 'agent'.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['user', 'agent']
