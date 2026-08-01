from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import PasswordResetAuthorization, PasswordResetChallenge, User
from users.authentication import issue_tokens


@override_settings(
    PASSWORD_RESET_CODE_LIFETIME=600,
    PASSWORD_RESET_RESEND_COOLDOWN=60,
    PASSWORD_RESET_MAX_ATTEMPTS=5,
    PASSWORD_RESET_AUTHORIZATION_LIFETIME=600,
    PASSWORD_RESET_REQUESTS_PER_HOUR=20,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class PasswordLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            name="password-user", email="user@example.com", password="Old-password-9!",
            full_name="Password User", is_active=True,
        )

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    def test_request_is_generic_for_unknown_email_and_code_is_hashed(self, send_code):
        existing = self.client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        missing = self.client.post(reverse("password-reset-request"), {"email": "missing@example.com"}, format="json")
        self.assertEqual(existing.status_code, missing.status_code)
        self.assertEqual(set(existing.data), set(missing.data))
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        self.assertNotEqual(challenge.code_hash, "123456")
        self.assertTrue(challenge.code_hash.startswith("pbkdf2_"))
        send_code.assert_called_once()

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    def test_invalid_attempts_lock_challenge(self, send_code):
        self.client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        for _ in range(5):
            response = self.client.post(reverse("password-reset-verify"), {"request_id": challenge.request_id, "code": "000000"}, format="json")
        challenge.refresh_from_db()
        self.assertEqual(response.data["code"], "PASSWORD_RESET_CODE_INVALID")
        self.assertIsNotNone(challenge.locked_at)
        self.assertEqual(challenge.attempts, 5)

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    @patch("users.services.password_reset.EmailService.send_password_changed_notification", return_value=True)
    def test_code_token_and_password_are_single_use(self, notify, send_code):
        self.client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        # Derive the test code from the mocked email invocation without persisting plaintext.
        code = send_code.call_args.args[1]
        verified = self.client.post(reverse("password-reset-verify"), {"request_id": challenge.request_id, "code": code}, format="json")
        token = verified.data["reset_token"]
        self.assertTrue(PasswordResetAuthorization.objects.filter(user=self.user).exists())
        completed = self.client.post(reverse("password-reset-confirm"), {"reset_token": token, "new_password": "New-password-9!", "confirm_password": "New-password-9!"}, format="json")
        self.assertEqual(completed.status_code, 200)
        self.assertTrue(self.user.__class__.objects.get(pk=self.user.pk).check_password("New-password-9!"))
        reused = self.client.post(reverse("password-reset-confirm"), {"reset_token": token, "new_password": "Another-password-9!", "confirm_password": "Another-password-9!"}, format="json")
        self.assertEqual(reused.data["code"], "PASSWORD_RESET_TOKEN_INVALID")
        notify.assert_called_once()

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    def test_expired_challenge_is_rejected(self, send_code):
        self.client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        challenge.expires_at = timezone.now() - timedelta(seconds=1)
        challenge.save(update_fields=["expires_at"])
        response = self.client.post(reverse("password-reset-verify"), {"request_id": challenge.request_id, "code": "123456"}, format="json")
        self.assertEqual(response.data["code"], "PASSWORD_RESET_CODE_EXPIRED")

    @patch("users.services.password_reset.EmailService.send_password_changed_notification", return_value=True)
    def test_authenticated_password_change_uses_set_password_and_revokes_auth_state(self, notify):
        self.client.force_authenticate(self.user)
        response = self.client.post(reverse("password-change"), {"current_password": "Old-password-9!", "new_password": "New-password-9!", "confirm_password": "New-password-9!"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("New-password-9!"))
        self.assertFalse(self.user.check_password("Old-password-9!"))
        notify.assert_called_once()

    def test_tokens_carry_auth_version_and_old_access_token_is_rejected(self):
        refresh, access = issue_tokens(self.user)
        self.assertEqual(refresh["auth_version"], self.user.auth_version)
        self.assertEqual(access["auth_version"], self.user.auth_version)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        with patch("users.services.password_reset.EmailService.send_password_changed_notification", return_value=True):
            response = self.client.post(reverse("password-change"), {"current_password": "Old-password-9!", "new_password": "New-password-10!", "confirm_password": "New-password-10!"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(reverse("user-profile")).status_code, 401)
        refresh_response = APIClient().post(reverse("token_refresh"), {"refresh": str(refresh)}, format="json")
        self.assertEqual(refresh_response.status_code, 401)

    def test_missing_auth_version_claim_is_rejected(self):
        access = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get(reverse("user-profile")).status_code, 401)

    def test_malformed_auth_version_claim_is_rejected(self):
        for malformed in (True, -1, "not-an-integer"):
            with self.subTest(malformed=malformed):
                access = RefreshToken.for_user(self.user).access_token
                access["auth_version"] = malformed
                self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
                self.assertEqual(self.client.get(reverse("user-profile")).status_code, 401)

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    @patch("users.services.password_reset.EmailService.send_password_changed_notification", return_value=True)
    def test_forgot_password_completion_rejects_old_access_token(self, notify, send_code):
        _, access = issue_tokens(self.user)
        client = APIClient()
        client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        verified = client.post(reverse("password-reset-verify"), {"request_id": challenge.request_id, "code": send_code.call_args.args[1]}, format="json")
        client.post(reverse("password-reset-confirm"), {"reset_token": verified.data["reset_token"], "new_password": "Reset-password-10!", "confirm_password": "Reset-password-10!"}, format="json")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(client.get(reverse("user-profile")).status_code, 401)
