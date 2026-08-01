# users/urls.py - FIXED IMPORTS
from django.urls import path, include
from rest_framework.routers import DefaultRouter
# Update urls.py imports to:
from .views.authentication import (
    RegisterView, UserLoginView, UserLoginOTPView, AdminLoginView, VerifyOTPView,
    LogoutView, resend_otp, verify_email, VerifyEmailView
)

from .views.admin import (
    ban_user, unban_user, make_user_agent, make_user_admin,
    list_admin_users, admin_user_detail, remove_admin_role, delete_user,
    promote_to_sub_admin, list_users, user_stats
)

from .views.user_management import (
    UserProfileView, user_list, simple_user_list, delete_my_account
)

from .views.categories import (
    CustomerCategoryViewSet, assign_user_category,
    bulk_assign_category, user_categories_report
)

from .views.security import (
    AdminStep1LoginView, AdminStep2LoginView, AdminStep3LoginView,
    SetupSecondPasswordView, CheckSecondPasswordSetupView,
    FirstTimeSetupSecondPasswordView, SetAdminSecondPasswordView,
    AdminProfileUpdateView, debug_session
)

from .views.audit import AuditLogViewSet
from .views.password_views import (
    PasswordResetRequestView, PasswordResetVerifyView, PasswordResetConfirmView,
    PasswordResetResendView, PasswordChangeView, AdminPasswordResetSendView,
    DeprecatedPasswordResetView,
)
from .views.versioned_token import VersionedTokenRefreshView

# Add these imports:
from .views.role_management import change_user_role
from .views.customer_admin import (
    CustomerAggregateView, CustomerActionView, CustomerBalanceAdjustmentRequestView,
    CustomerBalanceAdjustmentDecisionView,
)
from .views.admin import promote_to_sub_admin  # Already imported

router = DefaultRouter()
router.register(r'categories', CustomerCategoryViewSet, basename='customercategory')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = [
    # Authentication endpoints
    path("register/", RegisterView.as_view(), name="register"),
    path('login/admin/', AdminLoginView.as_view(), name='admin-login'),
    path('login/', UserLoginView.as_view(), name='user-login'),
    path('login/verify-otp/', UserLoginOTPView.as_view(), name='user-login-otp'),
    path("token/refresh/", VersionedTokenRefreshView.as_view(), name="token_refresh"),
    path("me/", UserProfileView.as_view(), name="user-profile"), 
    path("me/delete/", delete_my_account, name="delete-my-account"),
    path("change-password/", DeprecatedPasswordResetView.as_view(), name="change-password"),
    path("password-change/", PasswordChangeView.as_view(), name="password-change"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/verify/", PasswordResetVerifyView.as_view(), name="password-reset-verify"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("password-reset/resend/", PasswordResetResendView.as_view(), name="password-reset-resend"),
    path("forgot-password/", DeprecatedPasswordResetView.as_view(), name="forgot-password"),
    path("reset-password/", DeprecatedPasswordResetView.as_view(), name="reset-password"),
    path("forgot-password-code/", DeprecatedPasswordResetView.as_view(), name="forgot-password-code"),
    path("reset-password-code/", DeprecatedPasswordResetView.as_view(), name="reset-password-code"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", resend_otp, name="resend-otp"),
    path("logout/", LogoutView.as_view(), name="logout"),
    
    # Admin 3-step login endpoints
    path('login/admin/step1/', AdminStep1LoginView.as_view(), name='admin-login-step1'),
    path('login/admin/step2/', AdminStep2LoginView.as_view(), name='admin-login-step2'),
    path('login/admin/step3/', AdminStep3LoginView.as_view(), name='admin-login-step3'),
    path('setup-second-password/', SetupSecondPasswordView.as_view(), name='setup-second-password'),
    path('check-second-password/', CheckSecondPasswordSetupView.as_view(), name='check-second-password'),
    path('setup-first-password/', FirstTimeSetupSecondPasswordView.as_view(), name='setup-first-password'),
    
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
    path("admin/users/<int:user_id>/password-reset/send/", AdminPasswordResetSendView.as_view(), name="admin-password-reset-send"),
    path("remove-admin/<int:user_id>/", remove_admin_role, name="remove_admin_role"),
    path("delete/<int:user_id>/", delete_user, name="delete_user"),
    path("debug-session/", debug_session, name="debug-session"),
    
    # User list endpoints
    path("users/", user_list, name="user-list"),
    path("users-simple/", simple_user_list, name="user-list-simple"),
    path("stats/", user_stats, name="user-stats"),
    
    # Admin profile management
    path("admin/profile/", AdminProfileUpdateView.as_view(), name="admin-profile-update"),
    
    # Email verification
    path("verify-email/", verify_email, name="verify-email"),
    path("verify-email-token/", VerifyEmailView.as_view(), name="verify-email-token"),
    
    # Category Management Endpoints
    path('assign-category/', assign_user_category, name='assign-category'),
    path('bulk-assign-category/', bulk_assign_category, name='bulk-assign-category'),
    path('category-report/', user_categories_report, name='category-report'),
    
    # Audit logs
    path('', include(router.urls)),
    
    # ✅ NEW: Unified role management endpoint
    path("change-role/<int:user_id>/", change_user_role, name="change-user-role"),
    path("admin/customers/<int:customer_id>/", CustomerAggregateView.as_view(), name="customer-admin-aggregate"),
    path("admin/customers/<int:customer_id>/balance-adjustments/", CustomerBalanceAdjustmentRequestView.as_view(), name="customer-balance-adjustment-request"),
    path("admin/customers/<int:customer_id>/<str:action>/", CustomerActionView.as_view(), name="customer-admin-action"),
    path("admin/balance-adjustments/<int:adjustment_id>/<str:decision>/", CustomerBalanceAdjustmentDecisionView.as_view(), name="customer-balance-adjustment-decision"),
]
