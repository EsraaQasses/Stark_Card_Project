# system/middleware.py
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model
from system.models import LastAction, SystemLog

User = get_user_model()

def _safe_request_data(request):
    """ارجع بيانات الطلب بشكل متوافق مع DRF و Django Admin."""
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
        return getattr(request, 'data', None) or request.POST or {}
    return getattr(request, 'data', None) or request.GET or {}

def _is_admin_asset(request):
    """تجاوز الستاتيك/الميديا ولوحة الأدمن إذا بدك."""
    p = request.path or ""
    return p.startswith('/static/') or p.startswith('/media/')

class SystemLogMiddleware(MiddlewareMixin):
    def process_view(self, request, view_func, view_args, view_kwargs):
        # سجل فقط طلبات التعديل
        if request.method not in ('POST', 'PUT', 'DELETE'):
            return None

        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return None

        # ما نسجل الأدمن هون (إله ميدلوير خاص)
        if getattr(user, 'role', None) == 'admin':
            return None

        # تجنب الستاتيك/الميديا
        if _is_admin_asset(request):
            return None

        data = _safe_request_data(request)

        device_info = request.META.get('HTTP_USER_AGENT', '')
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')

        SystemLog.objects.create(
            user=user,
            operation_type={
                'POST': SystemLog.OTHER,
                'PUT' : SystemLog.UPDATE,
                'DELETE': SystemLog.DELETE
            }.get(request.method, SystemLog.OTHER),
            operation_name=f"{request.method} {request.path}",
            url=request.build_absolute_uri(),
            description=str(data)[:500],
            device_info=device_info,
            ip_address=ip
        )
        return None

class AdminActionMiddleware(MiddlewareMixin):
    def process_view(self, request, view_func, view_args, view_kwargs):
        user = getattr(request, 'user', None)

        # لازم يكون أدمن ومصادق
        if not user or not user.is_authenticated or getattr(user, "role", None) != "admin":
            return None

        # سجل فقط عمليات التعديل
        if request.method not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return None

        data = _safe_request_data(request)

        # حاول جلب الهدف إذا موجود
        target_user = None
        target_user_id = data.get('user_id') or data.get('agent_id')
        if target_user_id:
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                target_user = None

        LastAction.objects.create(
            admin=user,
            target_user=target_user,
            action_type=f"{request.method} {request.path}",
            description=str(data)[:500]
        )
        return None
