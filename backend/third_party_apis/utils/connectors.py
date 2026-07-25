import requests
import json
import logging
from typing import Dict, Optional, Any
from django.utils import timezone
from ..models import ThirdPartyAPI, APITransaction

logger = logging.getLogger(__name__)

class BaseConnector:
    
    def __init__(self, api_config: ThirdPartyAPI):
        self.api_config = api_config
        self.base_url = api_config.base_url.rstrip('/')  # Remove trailing slash
        self.headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'StarkPayments/1.0'
        }
        self.setup_authentication()
    
    def setup_authentication(self):
        api_key = self.api_config.get_api_key()
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'
    
    def make_request(self, endpoint: str, method: str = 'GET', data: Dict = None, 
                    timeout: int = 30) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                timeout=timeout
            )
            
            # Handle non-JSON responses gracefully
            response_data = {}
            if response.content:
                try:
                    response_data = response.json()
                except ValueError:
                    # Not JSON, return text content
                    response_data = {'text': response.text[:1000]}
            
            return {
                'success': 200 <= response.status_code < 300,
                'status_code': response.status_code,
                'data': response_data,
                'headers': dict(response.headers),
                'text': response.text[:1000] if response.content else ''
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'status_code': None
            }
    
    def test_connection(self) -> bool:
        raise NotImplementedError("Subclasses must implement test_connection")
    
    def get_balance(self) -> Dict[str, Any]:
        raise NotImplementedError("Subclasses must implement get_balance")
    
    def get_products(self) -> list:
        raise NotImplementedError("Subclasses must implement get_products")
    
    def execute_purchase(self, product_data: Dict, user_data: Dict, transaction_data: Dict) -> Dict[str, Any]:
        raise NotImplementedError("Subclasses must implement execute_purchase")

class DailyConnector(BaseConnector):
    
    def test_connection(self) -> bool:
        result = self.make_request('/api/health', 'GET')
        return result.get('success', False)
    
    def get_balance(self) -> Dict[str, Any]:
        result = self.make_request('/api/balance', 'GET')
        return result
    
    def get_products(self) -> list:
        result = self.make_request('/api/products', 'GET')
        if result.get('success'):
            return result.get('data', {}).get('products', [])
        return []
    
    def execute_purchase(self, product_data: Dict, user_data: Dict, transaction_data: Dict) -> Dict[str, Any]:
        payload = {
            'product_id': product_data.get('external_id'),
            'quantity': product_data.get('quantity', 1),
            'user_inputs': product_data.get('user_inputs', {}),
            'amount': transaction_data.get('amount')
        }
        
        result = self.make_request('/api/purchase', 'POST', payload)
        return result

class AlfaourConnector(BaseConnector):
    
    def setup_authentication(self):
        api_key = self.api_config.get_api_key()
        if api_key:
            self.headers['X-API-Key'] = api_key
    
    def test_connection(self) -> bool:
        result = self.make_request('/v1/auth/verify', 'GET')
        return result.get('success', False)
    
    def get_balance(self) -> Dict[str, Any]:
        result = self.make_request('/v1/balance', 'GET')
        return result
    
    def get_products(self) -> list:
        result = self.make_request('/v1/products', 'GET')
        if result.get('success'):
            return result.get('data', {}).get('products', [])
        return []
    
    def execute_purchase(self, product_data: Dict, user_data: Dict, transaction_data: Dict) -> Dict[str, Any]:
        payload = {
            'product_id': product_data.get('external_id'),
            'quantity': product_data.get('quantity', 1),
            'customer_email': user_data.get('email'),
            'amount': transaction_data.get('amount')
        }
        
        result = self.make_request('/v1/purchase', 'POST', payload)
        return result

class AlaaeddinConnector(BaseConnector):
    """Connector for Alaaeddin API"""
    
    def setup_authentication(self):
        api_key = self.api_config.get_api_key()
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'
    
    def test_connection(self) -> bool:
        """Test connection by checking balance"""
        result = self.get_balance()
        return result.get('success', False)
    
    def get_balance(self) -> Dict[str, Any]:
        """Get account balance"""
        result = self.make_request('/api/balance', 'GET')
        return result
    
    def get_products(self) -> list:
        """Get available products with proper field mapping for Alaaeddin API"""
        result = self.make_request('/api/products', 'GET')
        print(f"🔍 Alaaeddin API raw result: {result}")
        
        if not result.get('success'):
            print(f"❌ Alaaeddin API call failed: {result.get('error')}")
            return []
        
        data = result.get('data', {})
        print(f"📦 Alaaeddin data type: {type(data)}, keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        
        # Handle different response formats
        products = []
        if isinstance(data, dict):
            products = data.get('products', [])
        elif isinstance(data, list):
            products = data
        
        print(f"🎯 Found {len(products)} raw products")
        
        if not products:
            print("❌ No products found in response")
            return []
        
        # Transform products
        transformed_products = []
        for i, product in enumerate(products):
            # Flexible field mapping
            external_id = product.get('id') or product.get('product_id') or str(i)
            name = product.get('name') or product.get('title') or f'Product {i}'
            description = product.get('description') or product.get('desc') or ''
            
            # Price handling
            price_fields = ['default_price', 'price', 'base_price', 'cost', 'amount']
            base_price = 0
            for field in price_fields:
                price_val = product.get(field)
                if price_val is not None:
                    try:
                        if isinstance(price_val, str):
                            price_val = price_val.replace('$', '').replace('€', '').replace('£', '').strip()
                        base_price = float(price_val)
                        break
                    except (ValueError, TypeError):
                        continue
            
            # Required fields
            required_fields = product.get('fields', []) or product.get('inputs', []) or []
            
            transformed_product = {
                'external_id': str(external_id),
                'name': name,
                'base_price': base_price,
                'description': description,
                'required_fields': required_fields,
                'category': product.get('category', 'general'),
                'original_data': product
            }
            transformed_products.append(transformed_product)
        
        print(f"✅ Transformed {len(transformed_products)} products")
        return transformed_products
    
    def execute_purchase(self, product_data: Dict, user_data: Dict, transaction_data: Dict) -> Dict[str, Any]:
        """Execute a purchase"""
        payload = {
            'product_id': product_data.get('external_id'),
            'quantity': product_data.get('quantity', 1),
            'user_details': user_data,
            'transaction_details': transaction_data
        }
        
        result = self.make_request('/api/purchase', 'POST', payload)
        return result

class ConnectorFactory:
    
    @staticmethod
    def get_connector(api_config: ThirdPartyAPI) -> BaseConnector:
        connectors = {
            'daily': DailyConnector,
            'alfaour': AlfaourConnector,
            'alaaeddin': AlaaeddinConnector,
        }
        
        connector_class = connectors.get(api_config.provider)
        if not connector_class:
            raise ValueError(f"No connector found for provider: {api_config.provider}")
        
        return connector_class(api_config)
