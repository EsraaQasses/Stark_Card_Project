from datetime import timedelta

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from users.authentication import issue_tokens
from users.models import AdminLoginSession, User, UserLoginSession


class AuthenticationConsolidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            name="auth-user", email="auth@example.com", password="Password-9!",
            full_name="Auth User", is_active=True,
        )

    def test_legacy_admin_login_is_quarantined(self):
        admin = User.objects.create_user(
            name="auth-admin", email="admin@example.com", password="Password-9!",
            full_name="Auth Admin", role="admin", is_active=True,
        )
        response = self.client.post(reverse("admin-login"), {"name": admin.name, "password": "Password-9!"}, format="json")
        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.data["code"], "ADMIN_LOGIN_DEPRECATED")

    def test_logout_revokes_access_refresh_and_temporary_sessions(self):
        refresh, access = issue_tokens(self.user)
        now = timezone.now()
        UserLoginSession.objects.create(
            user=self.user, session_token="user-session", otp_sent=True,
            expires_at=now + timedelta(minutes=5),
        )
        AdminLoginSession.objects.create(
            user=self.user, session_token="admin-session", expires_at=now + timedelta(minutes=5),
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(reverse("logout"), {"refresh": str(refresh)}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["code"], "LOGOUT_SUCCESS")
        self.assertFalse(UserLoginSession.objects.filter(user=self.user).exists())
        self.assertFalse(AdminLoginSession.objects.filter(user=self.user).exists())
        self.assertEqual(self.client.get(reverse("user-profile")).status_code, 401)
        self.assertEqual(APIClient().post(reverse("token_refresh"), {"refresh": str(refresh)}, format="json").status_code, 401)

    def test_logout_rejects_refresh_token_owned_by_another_user(self):
        other = User.objects.create_user(
            name="other-auth-user", email="other-auth@example.com", password="Password-9!",
            full_name="Other Auth User", is_active=True,
        )
        own_refresh, own_access = issue_tokens(self.user)
        other_refresh, _ = issue_tokens(other)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {own_access}")
        response = self.client.post(reverse("logout"), {"refresh": str(other_refresh)}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["code"], "LOGOUT_TOKEN_USER_MISMATCH")
        self.assertEqual(APIClient().post(reverse("token_refresh"), {"refresh": str(own_refresh)}, format="json").status_code, 200)

    def test_refresh_tokens_rotate_and_old_token_is_rejected(self):
        refresh, _ = issue_tokens(self.user)
        response = self.client.post(reverse("token_refresh"), {"refresh": str(refresh)}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("refresh", response.data)
        replay = self.client.post(reverse("token_refresh"), {"refresh": str(refresh)}, format="json")
        self.assertEqual(replay.status_code, 401)

    def test_expired_user_and_admin_sessions_are_cleaned(self):
        expired = timezone.now() - timedelta(seconds=1)
        UserLoginSession.objects.create(user=self.user, session_token="expired-user", expires_at=expired)
        AdminLoginSession.objects.create(user=self.user, session_token="expired-admin", expires_at=expired)
        call_command("cleanup_auth_sessions", stdout=None)
        self.assertFalse(UserLoginSession.objects.filter(session_token="expired-user").exists())
        self.assertFalse(AdminLoginSession.objects.filter(session_token="expired-admin").exists())
