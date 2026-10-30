from django.urls import reverse
from unittest.mock import patch, MagicMock
from django.test import TestCase

from .models import ThirdPartyAPI
from .services.api_service import APIService
from .utils.connectors import AlaaeddinConnector, StarkCardConnector, BaseConnector


class ConnectorTests(TestCase):
    def setUp(self):
        self.alaaeddin_api = ThirdPartyAPI.objects.create(
            name="Alaaeddin API",
            provider="alaaeddin",
            base_url="https://www.alaaeddin.net/",
            is_active=True
        )
        self.stark_api = ThirdPartyAPI.objects.create(
            name="Stark API",
            provider="stark-card",
            base_url="https://api.stark-card.com/",
            is_active=True
        )

    @patch("subprocess.run")
    def test_alaaeddin_connector_prefixes_api_v2(self, mock_run):
        from pathlib import Path

        def respond(args, **kwargs):
            Path(args[args.index("--output") + 1]).write_text('{}')
            return MagicMock(returncode=0, stdout="200")

        mock_run.side_effect = respond
        connector = AlaaeddinConnector(self.alaaeddin_api)
        with patch.object(self.alaaeddin_api, "get_api_key", return_value="test-token"):
            for endpoint in ("/orders", "/v2/orders", "/api/v2/orders"):
                with self.subTest(endpoint=endpoint):
                    result = connector.make_request(endpoint, "POST", data={"test": True})
                    self.assertTrue(result["success"])
                    args = mock_run.call_args.args[0]
                    self.assertIn("-4", args)
                    self.assertEqual(args[args.index("--url") + 1],
                                     "https://www.alaaeddin.net/api/v2/orders")
                    self.assertNotIn("test-token", " ".join(args))
                    self.assertIn("Authorization: Bearer test-token", mock_run.call_args.kwargs["input"])

    @patch.object(BaseConnector, "make_request")
    def test_stark_connector_execute_purchase(self, mock_make_request):
        mock_make_request.return_value = {"success": True}
        connector = StarkCardConnector(self.stark_api)
        product_data = {
            "external_id": "123",
            "quantity": 4026,
            "user_inputs": {"phone_number": "0982416135"}
        }
        connector.execute_purchase(product_data, {}, {})

        mock_make_request.assert_called_once()
        args, kwargs = mock_make_request.call_args
        self.assertEqual(args[0], "/client/api/newOrder/123/params")
        self.assertEqual(args[1], "GET")
        query_params = kwargs.get("query_params", {})
        self.assertEqual(query_params.get("qty"), 4026)
        self.assertEqual(query_params.get("phone_number"), "0982416135")
        self.assertIn("order_uuid", query_params)


class APIConnectionTests(TestCase):
    def test_test_api_connection_success(self):
        api = ThirdPartyAPI.objects.create(
            name="Alaaeddin API",
            provider="alaaeddin",
            base_url="https://www.alaaeddin.net/",
            is_active=True
        )

        dummy_connector = MagicMock()
        dummy_connector.test_connection.return_value = True

        with patch("third_party_apis.services.api_service.ConnectorFactory.get_connector", return_value=dummy_connector):
            result = APIService.test_api_connection(api.id)

        self.assertTrue(result.get("success"))
        self.assertTrue(result.get("connected"))

    def test_test_api_connection_stark(self):
        api = ThirdPartyAPI.objects.create(
            name="Stark API",
            provider="stark-card",
            base_url="https://api.stark-card.com/",
            is_active=True
        )

        dummy_connector = MagicMock()
        dummy_connector.test_connection.return_value = True

        with patch("third_party_apis.services.api_service.ConnectorFactory.get_connector", return_value=dummy_connector):
            result = APIService.test_api_connection(api.id)

        self.assertTrue(result.get("success"))
        self.assertTrue(result.get("connected"))


class APIDeletionTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient

        User = get_user_model()
        self.admin = User.objects.create_user(
            name="delete-test-admin",
            password="TestPassword123!",
            role="admin",
        )
        self.regular = User.objects.create_user(
            name="delete-test-user",
            password="TestPassword123!",
            role="user",
        )
        self.client = APIClient()

    def make_api(self, name):
        return ThirdPartyAPI.objects.create(
            name=name,
            provider="alaaeddin",
            base_url="https://www.alaaeddin.net",
        )

    def test_admin_cannot_delete_api_with_linked_records(self):
        api = self.make_api("Linked API")
        self.client.force_authenticate(user=self.admin)

        from third_party_apis.models import APITransaction

        APITransaction.objects.create(
            api_config=api,
            endpoint_used="/test",
        )

        response = self.client.delete(
            reverse("thirdpartyapi-detail", kwargs={"pk": api.id})
        )

        self.assertEqual(response.status_code, 409)
        self.assertTrue(ThirdPartyAPI.objects.filter(pk=api.pk).exists())
        self.assertTrue(APITransaction.objects.filter(api_config=api).exists())

    def test_admin_can_delete_unlinked_api(self):
        api = self.make_api("Empty API")
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(
            reverse("thirdpartyapi-detail", kwargs={"pk": api.id})
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(ThirdPartyAPI.objects.filter(pk=api.pk).exists())

    def test_regular_user_cannot_delete_api(self):
        api = self.make_api("Protected API")
        self.client.force_authenticate(user=self.regular)

        response = self.client.delete(
            reverse("thirdpartyapi-detail", kwargs={"pk": api.id})
        )

        self.assertEqual(response.status_code, 403)
        self.assertTrue(ThirdPartyAPI.objects.filter(pk=api.pk).exists())
