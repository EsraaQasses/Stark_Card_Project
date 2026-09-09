from django.test import TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from users.models import User
from .models import Notification, PushDeviceToken


class NotificationApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(
			name="notification-user", email="notification-user@example.com", password="Password-9!"
		)
		self.other_user = User.objects.create_user(
			name="other-user", email="other-user@example.com", password="Password-9!"
		)
		self.notification = Notification.objects.create(
			recipient=self.user,
			type="transfer_received",
			title="Transfer received",
			message="You received 5 USD.",
			details={"transaction_id": 12, "amount": "5.00", "currency": "USD"},
			icon="arrow-down-left",
		)

	def test_user_receives_structured_notification_with_icon_key(self):
		self.client.force_authenticate(self.user)
		response = self.client.get("/api/system/notifications/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 1)
		item = response.data["results"][0]
		self.assertEqual(item["type"], "transfer_received")
		self.assertEqual(item["details"]["transaction_id"], 12)
		self.assertEqual(item["icon"], "arrow-down-left")
		self.assertFalse(item["is_read"])
		self.assertIsNotNone(item["created_at"])

	def test_user_can_mark_one_or_all_notifications_read(self):
		self.client.force_authenticate(self.user)
		self.assertEqual(self.client.get("/api/system/notifications/unread-count/").data, {"unread": 1})

		response = self.client.patch(
			f"/api/system/notifications/{self.notification.id}/", {"is_read": True}, format="json"
		)
		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data["is_read"])
		self.assertEqual(self.client.get("/api/system/notifications/unread-count/").data, {"unread": 0})

		Notification.objects.create(recipient=self.user, title="Second", message="Second message")
		response = self.client.post("/api/system/notifications/mark-all-read/")
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data, {"updated": 1})

	def test_users_cannot_create_delete_or_read_each_others_notifications(self):
		self.client.force_authenticate(self.user)
		self.assertEqual(
			self.client.post("/api/system/notifications/", {"title": "Fake", "message": "Fake"}, format="json").status_code,
			405,
		)
		self.assertEqual(self.client.delete(f"/api/system/notifications/{self.notification.id}/").status_code, 405)

		self.client.force_authenticate(self.other_user)
		self.assertEqual(self.client.get(f"/api/system/notifications/{self.notification.id}/").status_code, 404)

	def test_user_can_register_and_unregister_push_token(self):
		self.client.force_authenticate(self.user)
		token = "ExpoPushToken[test-device]"

		response = self.client.post(
			"/api/system/push-tokens/register/",
			{"token": token, "platform": "android"},
			format="json",
		)
		self.assertEqual(response.status_code, 201)
		device = PushDeviceToken.objects.get(token=token)
		self.assertEqual(device.user, self.user)
		self.assertTrue(device.is_active)

		response = self.client.post(
			"/api/system/push-tokens/register/",
			{"token": token, "platform": "ios"},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		self.assertEqual(PushDeviceToken.objects.filter(token=token).count(), 1)
		self.assertEqual(PushDeviceToken.objects.get(token=token).platform, "ios")

		response = self.client.post(
			"/api/system/push-tokens/unregister/",
			{"token": token},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		self.assertFalse(PushDeviceToken.objects.get(token=token).is_active)

	def test_notification_creation_sends_push_but_read_update_does_not(self):
		self.client.force_authenticate(self.user)
		PushDeviceToken.objects.create(
			user=self.user,
			token="ExpoPushToken[push-test]",
			platform="android",
		)
		with patch("system.services.push_notifications.requests.post") as post:
			post.return_value.json.return_value = {"data": [{"status": "ok"}]}
			post.return_value.raise_for_status.return_value = None
			with self.captureOnCommitCallbacks(execute=True):
				notification = Notification.objects.create(
					recipient=self.user,
					title="Push title",
					message="Push body",
				)
			self.assertEqual(post.call_count, 1)

			self.client.patch(
				f"/api/system/notifications/{notification.id}/",
				{"is_read": True},
				format="json",
			)
			self.assertEqual(post.call_count, 1)

	def test_invalid_expo_ticket_deactivates_device(self):
		device = PushDeviceToken.objects.create(
			user=self.user,
			token="ExpoPushToken[invalid-device]",
			platform="android",
		)
		with patch("system.services.push_notifications.requests.post") as post:
			post.return_value.json.return_value = {
				"data": [{
					"status": "error",
					"details": {"error": "DeviceNotRegistered"},
				}]
			}
			post.return_value.raise_for_status.return_value = None
			from .services.push_notifications import send_push_to_user
			send_push_to_user(user_id=self.user.id, title="Title", body="Body")
		device.refresh_from_db()
		self.assertFalse(device.is_active)
