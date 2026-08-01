from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from unittest import SkipTest

from django.db import close_old_connections, connection
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import PasswordResetAuthorization, PasswordResetChallenge, User


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PasswordConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if connection.vendor != "postgresql":
            raise SkipTest("Password concurrency tests require PostgreSQL row-lock semantics")

    def setUp(self):
        self.user = User.objects.create_user(
            name="concurrency-user", email="concurrency@example.com",
            password="Old-password-9!", full_name="Concurrency User", is_active=True,
        )

    def _parallel_posts(self, payloads, endpoint):
        barrier = Barrier(len(payloads))

        def submit(payload):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return APIClient().post(endpoint, payload, format="json")
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=len(payloads)) as pool:
            return list(pool.map(submit, payloads))

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    def test_simultaneous_verification_consumes_once(self, send_code):
        client = APIClient()
        client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        code = send_code.call_args.args[1]
        responses = self._parallel_posts(
            [{"request_id": challenge.request_id, "code": code}] * 2,
            reverse("password-reset-verify"),
        )
        self.assertEqual(sum(response.status_code == 200 for response in responses), 1)
        self.assertEqual(PasswordResetAuthorization.objects.filter(user=self.user).count(), 1)
        challenge.refresh_from_db()
        self.assertIsNotNone(challenge.consumed_at)

    @patch("users.services.password_reset.EmailService.send_secure_password_reset_code", return_value=True)
    @patch("users.services.password_reset.EmailService.send_password_changed_notification", return_value=True)
    def test_simultaneous_confirmation_changes_once(self, notify, send_code):
        client = APIClient()
        client.post(reverse("password-reset-request"), {"email": self.user.email}, format="json")
        challenge = PasswordResetChallenge.objects.get(user=self.user)
        verified = client.post(reverse("password-reset-verify"), {"request_id": challenge.request_id, "code": send_code.call_args.args[1]}, format="json")
        token = verified.data["reset_token"]
        payload = {"reset_token": token, "new_password": "New-password-10!", "confirm_password": "New-password-10!"}
        responses = self._parallel_posts([payload, payload], reverse("password-reset-confirm"))
        self.assertEqual(sum(response.status_code == 200 for response in responses), 1)
        self.assertEqual(PasswordResetAuthorization.objects.filter(user=self.user, consumed_at__isnull=False).count(), 1)
        self.assertEqual(PasswordResetChallenge.objects.filter(user=self.user, consumed_at__isnull=False).count(), 1)
