from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.core.cache import cache
import time

class AdminLoginThrottle(AnonRateThrottle):
    """Custom throttle for admin login"""
    scope = 'admin_login'
    rate = '5/minute'  # 5 attempts per minute
    
    def get_cache_key(self, request, view):
        # Throttle by username for login attempts
        if request.method == 'POST' and 'name' in request.data:
            return f"throttle_admin_login_{request.data['name']}"
        return super().get_cache_key(request, view)

class OTPRequestThrottle(AnonRateThrottle):
    """Throttle OTP requests"""
    scope = 'otp_requests'
    rate = '3/minute'  # 3 OTP requests per minute
    
    def get_cache_key(self, request, view):
        if request.method == 'POST' and 'name' in request.data:
            return f"throttle_otp_{request.data['name']}"
        return super().get_cache_key(request, view)


class PasswordResetRequestThrottle(AnonRateThrottle):
    scope = 'password_reset_request'
    rate = '10/hour'

    def get_cache_key(self, request, view):
        email = str(request.data.get('email', '')).strip().lower()
        return f'password-reset-request:{self.get_ident(request)}:{email}'


class PasswordResetVerifyThrottle(AnonRateThrottle):
    scope = 'password_reset_verify'
    rate = '30/hour'


class PasswordResetResendThrottle(AnonRateThrottle):
    scope = 'password_reset_resend'
    rate = '10/hour'


class PasswordChangeThrottle(UserRateThrottle):
    scope = 'password_change'
    rate = '10/hour'


class AdminPasswordResetThrottle(UserRateThrottle):
    scope = 'admin_password_reset'
    rate = '20/hour'
