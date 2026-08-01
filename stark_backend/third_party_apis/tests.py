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

    @patch.object(BaseConnector, "make_request")
    def test_alaaeddin_connector_prefixes_api_v2(self, mock_make_request):
        connector = AlaaeddinConnector(self.alaaeddin_api)
        connector.make_request("/orders", "POST", data={"test": True})

        mock_make_request.assert_called_once()
        args, _ = mock_make_request.call_args
        self.assertTrue(args[0].startswith("/v2/"))

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
        dummy_connector.get_balance.return_value = {"success": True, "data": {"balance": 100}}
        dummy_connector.get_products.return_value = [{"external_id": "1"}]

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
        dummy_connector.get_balance.return_value = {"success": True, "data": {"balance": 200}}
        dummy_connector.get_products.return_value = [{"external_id": "2"}]

        with patch("third_party_apis.services.api_service.ConnectorFactory.get_connector", return_value=dummy_connector):
            result = APIService.test_api_connection(api.id)

        self.assertTrue(result.get("success"))
        self.assertTrue(result.get("connected"))
