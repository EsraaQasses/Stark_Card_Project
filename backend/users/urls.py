from django.urls import path
from .views import (
    AdminLoginView, TwoFAStatusView, VerifyEmailView, verify_email, RegisterView, 
    UserLoginView, UserProfileView, VerifyOTPView, ChangePasswordView, 
    LogoutView, ResetPasswordView, ForgotPasswordView, resend_otp,
    ban_user, unban_user, list_users, promote_to_sub_admin, user_list, user_stats,
    simple_user_list, make_user_agent, AdminStep1LoginView, AdminStep2LoginView, 
    AdminStep3LoginView, SetupSecondPasswordView, CheckSecondPasswordSetupView,make_user_admin, SetAdminSecondPasswordView, list_admin_users, 
    admin_user_detail, remove_admin_role,FirstTimeSetupSecondPasswordView,debug_session,
    Check2FAStatusView, AdminProfileUpdateView, TwoFactorSetupView, TwoFactorVerifyView, TwoFactorDisableView, TwoFactorStatusView
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Authentication endpoints
    path("register/", RegisterView.as_view(), name="register"),
    path('login/admin/', AdminLoginView.as_view(), name='admin-login'),
    path('login/', UserLoginView.as_view(), name='user-login'),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", UserProfileView.as_view(), name="user-profile"), 
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", resend_otp, name="resend-otp"),
    path("logout/", LogoutView.as_view(), name="logout"),
    
    # Admin 3-step login endpoints
    path('login/admin/step1/', AdminStep1LoginView.as_view(), name='admin-login-step1'),
    path('login/admin/step2/', AdminStep2LoginView.as_view(), name='admin-login-step2'),
    path('login/admin/step3/', AdminStep3LoginView.as_view(), name='admin-login-step3'),
    path('setup-second-password/', SetupSecondPasswordView.as_view(), name='setup-second-password'),
    path('check-second-password/', CheckSecondPasswordSetupView.as_view(), name='check-second-password'),
    
    # Admin management endpoints
    path("ban/<int:user_id>/", ban_user, name="ban_user"),
    path("unban/<int:user_id>/", unban_user, name="unban_user"),
    path("banned-users/", list_users, name="banned_list_users"),
    path("promote/<int:user_id>/", promote_to_sub_admin, name="promote_to_sub_admin"),
    path("make-agent/<int:user_id>/", make_user_agent, name="make_user_agent"),
    path("make-admin/<int:user_id>/", make_user_admin, name="make_user_admin"),
    path("set-admin-password/<int:user_id>/", SetAdminSecondPasswordView.as_view(), name="set_admin_password"),
    path("admin-users/", list_admin_users, name="list_admin_users"),
    path("admin-users/<int:user_id>/", admin_user_detail, name="admin_user_detail"),
    path("remove-admin/<int:user_id>/", remove_admin_role, name="remove_admin_role"),
    path("debug-session/", debug_session, name="debug-session"),
    
    # User list endpoints
    path("users/", user_list, name="user-list"),
    path("users-simple/", simple_user_list, name="user-list-simple"),
    path("stats/", user_stats, name="user-stats"),
    path('setup-first-password/', FirstTimeSetupSecondPasswordView.as_view(), name='setup-first-password'),
    
    # 2FA endpoints
    path('2fa/setup/', TwoFactorSetupView.as_view(), name='2fa-setup'),
    path('2fa/verify/', TwoFactorVerifyView.as_view(), name='2fa-verify'),
    path('2fa/disable/', TwoFactorDisableView.as_view(), name='2fa-disable'),
    path('2fa/status/', TwoFactorStatusView.as_view(), name='2fa-status'),
    path('2fa/status/', TwoFAStatusView.as_view(), name='2fa-status'),
    
    # Admin profile management
    path("admin/profile/", AdminProfileUpdateView.as_view(), name="admin-profile-update"),
    
    # Email verification
    path("verify-email/", verify_email, name="verify-email"),
    path("verify-email-token/", VerifyEmailView.as_view(), name="verify-email-token"),
]