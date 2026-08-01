import os
import requests
import json
import logging
import uuid
import time
from typing import Dict, Optional, Any, List
from django.utils import timezone
from ..models import ThirdPartyAPI, APITransaction

logger = logging.getLogger(__name__)
# Provider-specific timeouts (in seconds)
DEFAULT_TIMEOUT = int(os.getenv('API_CONNECTOR_TIMEOUT', '30'))
ALAAEDDIN_TIMEOUT = int(os.getenv('ALAAEDDIN_TIMEOUT', '45'))  # Alaaeddin needs more time
DEFAULT_RETRIES = int(os.getenv('API_CONNECTOR_RETRIES', '3'))  # Increased from 1 to 3
DEFAULT_BACKOFF_SECONDS = float(os.getenv('API_CONNECTOR_BACKOFF', '1.0'))  # Increased from 0.5

class BaseConnector:
    
    def __init__(self, api_config: ThirdPartyAPI):
        self.api_config = api_config
        self.base_url = api_config.base_url.rstrip('/')  # Remove trailing slash
        self.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'StarkPayments/1.0'
        }
        self.setup_authentication()
    
    def setup_authentication(self):
        api_key = self.api_config.get_api_key()
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'
    
    def make_request(self, endpoint: str, method: str = 'GET', data: Dict = None,
                    query_params: Dict = None, timeout: int = None) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        
        # Add query parameters to URL if provided
        if query_params:
            from urllib.parse import urlencode
            query_string = urlencode(query_params)
            url = f"{url}?{query_string}"
        
        if timeout is None and hasattr(self, "timeout"):
            timeout = getattr(self, "timeout")
        timeout = timeout if timeout is not None else DEFAULT_TIMEOUT
        retries = getattr(self, "retries", DEFAULT_RETRIES)
        last_error = None

        for attempt in range(retries + 1):
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

                # Standardize response format
                success = 200 <= response.status_code < 300
                error_message = None
                if not success:
                    if isinstance(response_data, dict):
                        error_message = (
                            response_data.get('message')
                            or response_data.get('error')
                            or response_data.get('msg')
                        )
                    if not error_message:
                        error_message = response.text[:200] if response.content else f"HTTP {response.status_code}"

                result = {
                    'success': success,
                    'status_code': response.status_code,
                    'data': response_data,
                    'headers': dict(response.headers),
                    'text': response.text[:1000] if response.content else '',
                    'url': url,
                    'error': error_message
                }

                # Retry on transient HTTP status codes
                if response.status_code in (408, 429, 500, 502, 503, 504) and attempt < retries:
                    last_error = f"HTTP {response.status_code}"
                    backoff = DEFAULT_BACKOFF_SECONDS * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Retrying {method} {url} after {last_error} (attempt {attempt + 1}/{retries}), waiting {backoff}s")
                    time.sleep(backoff)
                    continue

                # Log request details for debugging
                logger.debug(f"API Request: {method} {url}")
                logger.debug(f"Status: {response.status_code}")

                return result

            except requests.exceptions.Timeout:
                last_error = 'Request timeout'
                logger.warning(f"API request timed out: {url} (attempt {attempt + 1}/{retries}). Timeout was {timeout}s")
            except requests.exceptions.ConnectionError as e:
                last_error = f'Connection error: {str(e)}'
                logger.warning(f"Connection error: {url} (attempt {attempt + 1}/{retries}) - {str(e)}")
            except requests.exceptions.RequestException as e:
                last_error = str(e)
                logger.error(f"API request failed: {e}")
                if attempt >= retries:
                    break

            if attempt < retries:
                backoff = DEFAULT_BACKOFF_SECONDS * (2 ** attempt)  # Exponential backoff
                logger.info(f"Waiting {backoff}s before retry {attempt + 2}/{retries + 1}...")
                time.sleep(backoff)

        return {
            'success': False,
            'error': last_error or 'Request failed',
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
    """Connector for Alaaeddin V2 API - uses /v2/ path"""
    
    def __init__(self, api_config):
        super().__init__(api_config)
        # Force base URL to correct domain
        self.base_url = "https://www.alaaeddin.net"
        # Set provider-specific timeout for Alaaeddin
        self.timeout = ALAAEDDIN_TIMEOUT
        self.retries = 3  # Alaaeddin needs more retries
        self.setup_authentication()
    
    def setup_authentication(self):
        """V2 uses full Sanctum token format 'id|token'"""
        api_key = self.api_config.get_api_key()
        
        # V2 ACCEPTS FULL SANCTUM FORMAT: "6|Yge3BbFv..."
        self.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',  # Use FULL token
            'User-Agent': 'StarkApp/1.0'
        }
    
    def make_request(self, endpoint: str, method: str = 'GET', data: Dict = None,
                    query_params: Dict = None, timeout: int = None) -> Dict[str, Any]:
        """Override to ensure all requests use /v2/ path with Alaaeddin-specific timeout.

        If the API returns a route-not-found for /v2, retry once with /api/v2/.
        """
        # Ensure endpoint starts with /v2/ (per latest API docs)
        if not endpoint.startswith('/v2/'):
            if endpoint.startswith('/'):
                endpoint = f'/v2{endpoint}'
            else:
                endpoint = f'/v2/{endpoint}'

        # Use Alaaeddin-specific timeout if not provided
        if timeout is None:
            timeout = self.timeout

        # First attempt with /v2
        result = super().make_request(endpoint, method, data, query_params, timeout)

        # Fallback to /api/v2 if route is not found
        if result.get('status_code') == 404:
            error_text = (result.get('error') or '').lower()
            if 'route' in error_text and 'v2' in error_text:
                if endpoint.startswith('/v2/'):
                    fallback_endpoint = '/api' + endpoint
                else:
                    fallback_endpoint = f'/api/v2/{endpoint.lstrip("/")}'
                return super().make_request(fallback_endpoint, method, data, query_params, timeout)

        return result
    
    def test_connection(self) -> bool:
        """Test V2 connection using /v2/me"""
        result = self.make_request('/me', 'GET')
        if result.get('success'):
            # Check V2 response structure
            response_data = result.get('data', {})
            return response_data.get('success', False)
        return False
    
    def get_balance(self) -> Dict[str, Any]:
        """Get wallet balance from V2"""
        result = self.make_request('/wallets/balance', 'GET')
        
        if result.get('success'):
            response_data = result.get('data', {})
            
            if response_data.get('success'):
                data = response_data.get('data', {})
                wallets = data.get('wallets', [])
                
                # Find primary wallet
                primary = next((w for w in wallets if w.get('is_primary')), wallets[0] if wallets else {})
                
                return {
                    'success': True,
                    'data': {
                        'balance': primary.get('balance', 0),
                        'currency': primary.get('currency', 'USD'),
                        'wallets': wallets,
                        'totals': data.get('totals', {})
                    },
                    'status_code': result.get('status_code', 200)
                }
        
        return result
    
    def get_products(self) -> list:
        """Get products with V2 pagination - FIXED PATH"""
        all_products = []
        page = 1
        
        while True:
            result = self.make_request(
                '/products', 
                'GET', 
                query_params={'per_page': 50, 'page': page}
            )
            
            if not result.get('success'):
                logger.error(f"Failed to get products page {page}: {result.get('error')}")
                break
            
            response_data = result.get('data', {})
            if not response_data.get('success'):
                logger.error(f"API error on page {page}: {response_data.get('error', {})}")
                break
            
            data = response_data.get('data', {})
            items = data.get('items', [])
            
            if not items:
                break
            
            # Transform products
            for product in items:
                transformed = self._transform_product_v2(product)
                if transformed:
                    all_products.append(transformed)
            
            # Check pagination
            pagination = data.get('pagination', {})
            current_page = pagination.get('current_page', page)
            last_page = pagination.get('last_page', 1)
            
            logger.info(f"Fetched page {current_page}/{last_page}, {len(items)} products")
            
            if current_page >= last_page:
                break
            
            page += 1
        
        logger.info(f"Total products fetched: {len(all_products)}")
        return all_products

    def check_order_status(self, local_id: str) -> Dict[str, Any]:
        """Check order status by local_id (V2)."""
        result = self.make_request(f'/orders/by-local/{local_id}', 'GET')
        if result.get('success'):
            return result

        # Some deployments expose a /status suffix
        if result.get('status_code') in (400, 404):
            return self.make_request(f'/orders/by-local/{local_id}/status', 'GET')

        return result
    
    def _transform_product_v2(self, product: Dict) -> Dict:
        """Transform V2 product format to our internal format"""
        try:
            # Extract fields according to V2 documentation
            fields = product.get('fields', [])
            required_fields = []
            
            for field in fields:
                field_data = {
                    'field_name': field.get('name'),
                    'field_type': field.get('type', 'text'),
                    'required': field.get('required', True),
                    'placeholder': field.get('name'),
                    'options': field.get('options'),
                    'validation': {
                        'min_length': field.get('min_length'),
                        'max_length': field.get('max_length'),
                        'regex': field.get('regex'),
                        'min_value': field.get('min_value'),
                        'max_value': field.get('max_value'),
                        'numeric_only': field.get('numeric_only', False)
                    }
                }
                required_fields.append(field_data)
            
            # Quantity information
            quantity_data = product.get('quantity', {})
            
            inquiry_enabled_raw = product.get('inquiry_enabled', 0)
            inquiry_enabled = str(inquiry_enabled_raw).lower() in {"1", "true", "yes"}

            return {
                'external_id': str(product.get('id')),
                'name': product.get('name', ''),
                'description': product.get('description', ''),
                'base_price': float(product.get('price', 0)),
                'required_fields': required_fields,
                'category': product.get('category', 'general'),
                'status': product.get('status', 'active'),
                'inquiry_enabled': inquiry_enabled,
                'quantity_enabled': quantity_data.get('enabled', False),
                'quantity_options': quantity_data.get('options'),
                'quantity_min': quantity_data.get('min'),
                'quantity_max': quantity_data.get('max'),
                'allowed_wallet': product.get('allowed_wallet'),
                'image': product.get('image'),
                'original_data': product
            }
            
        except Exception as e:
            logger.error(f"Error transforming product {product.get('id')}: {e}")
            return None
    
    def execute_purchase(self, product_data: Dict, user_data: Dict, 
                        transaction_data: Dict) -> Dict[str, Any]:
        """Execute purchase with V2 API - FIXED PATH"""
        
        try:
            # Generate unique client reference for idempotency
            client_ref = f"stark_{transaction_data.get('internal_tx_id', '')}_{int(time.time())}"
            
            # Alaaeddin V2 quantity can be decimal options; preserve string form when decimals exist
            qty = product_data.get('quantity', 1)
            quantity_value = 1
            try:
                if isinstance(qty, str):
                    q = qty.strip()
                    if "." in q:
                        quantity_value = q  # keep exact string (e.g., "48.08")
                    else:
                        quantity_value = int(float(q))
                else:
                    qf = float(qty)
                    quantity_value = int(qf) if qf.is_integer() else str(qf)
            except Exception:
                quantity_value = 1
            # Keep minimum 1 for integer quantities only
            try:
                if isinstance(quantity_value, int) and quantity_value < 1:
                    quantity_value = 1
            except Exception:
                pass
            
            # Prepare payload according to V2 documentation
            payload = {
                "product_id": int(product_data.get('external_id')),
                "quantity": quantity_value,  # Pass quantity in appropriate format
                "fields": product_data.get('user_inputs', {}),
                "wallet_id": None,  # Optional - set if specific wallet needed
                "callback_url": None,  # Optional - for webhook callbacks
                "client_reference": client_ref,  # CRITICAL: Prevents duplicate orders
            }
            
            print(
                "Alaaeddin payload:",
                {
                    "product_id": payload.get("product_id"),
                    "quantity": payload.get("quantity"),
                    "fields": list(payload.get("fields", {}).keys()),
                },
                flush=True,
            )

            logger.warning(
                "[Alaaeddin] payload preview -> product_id=%s, quantity=%s, fields=%s",
                payload.get("product_id"),
                payload.get("quantity"),
                list(payload.get("fields", {}).keys()),
            )
            logger.info(
                "Making purchase: product_id=%s, quantity=%s, client_ref=%s",
                payload.get("product_id"),
                quantity_value,
                client_ref,
            )

            result = self.make_request('/orders', 'POST', data=payload, timeout=self.timeout)
            
            if result.get('success'):
                response_data = result.get('data', {})
                
                if response_data.get('success'):
                    data = response_data.get('data', {})
                    order_data = data.get('order', {})
                    
                    return {
                        'success': True,
                        'external_transaction_id': str(order_data.get('id', '')),
                        'local_id': order_data.get('local_id', ''),  # UUID from V2
                        'order_id': str(order_data.get('id', '')),
                        'message': order_data.get('message', 'Purchase successful'),
                        'status': order_data.get('status', 'pending'),
                        'processing': data.get('processing', True),
                        'product_name': order_data.get('product_name', ''),
                        'quantity': order_data.get('quantity', 1),
                        'unit_price': order_data.get('unit_price'),
                        'total_price': order_data.get('total_price'),
                        'currency': order_data.get('currency'),
                        'created_at': order_data.get('created_at'),
                        'client_reference': client_ref,
                        'status_code': result.get('status_code', 201)
                    }
                else:
                    error_info = response_data.get('error', {})
                    logger.warning(
                        "[Alaaeddin] error response -> status=%s, error=%s",
                        result.get("status_code"),
                        error_info,
                    )
                    return {
                        'success': False,
                        'error': error_info.get('message', 'API call failed'),
                        'error_code': error_info.get('code', ''),
                        'error_details': error_info.get('details', ''),
                        'client_reference': client_ref,
                        'status_code': result.get('status_code', 400)
                    }
            else:
                logger.warning(
                    "[Alaaeddin] raw response -> status=%s, data=%s, text=%s",
                    result.get("status_code"),
                    result.get("data"),
                    result.get("text"),
                )
                # Try to extract structured error from response payload (V2)
                resp = result.get('data') or {}
                err = None
                if isinstance(resp, dict):
                    err = resp.get('error') or resp.get('errors')
                if not err:
                    err = result.get('error')

                logger.warning(
                    "[Alaaeddin] request failed -> status=%s, error=%s",
                    result.get("status_code"),
                    err,
                )
                return {
                    'success': False,
                    'error': err.get('message', 'Request failed') if isinstance(err, dict) else (err or 'Request failed'),
                    'error_code': err.get('code', '') if isinstance(err, dict) else '',
                    'error_details': err.get('details', '') if isinstance(err, dict) else '',
                    'status_code': result.get('status_code', 400)
                }
                
        except ValueError as e:
            logger.error(f"Invalid data for purchase: {e}")
            return {
                'success': False,
                'error': f'Invalid data: {str(e)}',
                'status_code': 400
            }
        except Exception as e:
            logger.error(f"Unexpected error in purchase: {e}")
            return {
                'success': False,
                'error': str(e),
                'status_code': 500
            }
    
    def check_order_status(self, local_id: str) -> Dict[str, Any]:
        """Check order status by local_id"""
        result = self.make_request(f'/orders/by-local/{local_id}', 'GET')
        return result
    
    def create_inquiry(self, product_data: Dict, user_inputs: Dict = None) -> Dict[str, Any]:
        """Create inquiry for products with inquiry_enabled"""
        try:
            client_ref = f"stark_inquiry_{int(time.time())}"
            
            payload = {
                "product_id": int(product_data.get('external_id')),
                "fields": user_inputs or {},
                "callback_url": None,
                "client_reference": client_ref
            }
            
            result = self.make_request('/queries', 'POST', data=payload)
            return result
            
        except Exception as e:
            logger.error(f"Error creating inquiry: {e}")
            return {'success': False, 'error': str(e)}

    def get_query_by_local(self, local_id: str) -> Dict[str, Any]:
        """Fetch inquiry status/result by local_id"""
        try:
            return self.make_request(f'/queries/by-local/{local_id}', 'GET')
        except Exception as e:
            logger.error(f"Error fetching inquiry {local_id}: {e}")
            return {'success': False, 'error': str(e)}
class StarkCardConnector(BaseConnector):
    """Connector for Stark-Card API"""
    
    def setup_authentication(self):
        api_key = self.api_config.get_api_key()
        if api_key:
            self.headers['api-token'] = api_key 
    
    def test_connection(self) -> bool:
        """Test connection by checking profile/balance"""
        result = self.get_balance()
        return result.get('success', False)
    
    def get_balance(self) -> Dict[str, Any]:
        """Get account balance and profile"""
        result = self.make_request('/client/api/profile', 'GET', timeout=30)
        
        # Stark-Card returns 'status': 'OK' in response, convert to our format
        if result.get('status_code') and 200 <= result.get('status_code') < 300:
            data = result.get('data', {})
            # Check if API returned success in the data
            if data.get('status') == 'OK' or isinstance(data, dict) and 'balance' in data:
                result['success'] = True
            else:
                result['success'] = False
        
        return result
    
    def get_products(self) -> list:
        """Get available products from Stark-Card API"""
        result = self.make_request('/client/api/products', 'GET', timeout=30)
        logger.debug(f"🔍 Stark-Card API raw result status code: {result.get('status_code')}")
        
        # Stark-Card returns HTTP 200 with data in response
        if not (result.get('status_code') and 200 <= result.get('status_code') < 300):
            logger.error(f"❌ Stark-Card API call failed: HTTP {result.get('status_code')}")
            logger.debug(f"Response: {result}")
            return []
        
        # Get the data - Stark returns array directly
        data = result.get('data', [])
        if isinstance(data, dict) and data.get('text'):
            logger.warning("Stark-Card API non-JSON response: %s", data.get('text')[:300])
        
        # Handle different response formats
        products = []
        if isinstance(data, list):
            products = data
        elif isinstance(data, dict) and 'products' in data:
            products = data['products']
        elif isinstance(data, dict) and 'data' in data and isinstance(data['data'], list):
            products = data['data']
        else:
            logger.warning(
                "Unexpected response format. Data type: %s, Keys: %s",
                type(data),
                data.keys() if isinstance(data, dict) else 'N/A'
            )
        
        logger.info(f"🎯 Found {len(products)} raw products")
        
        if not products:
            logger.warning("❌ No products found in response")
            logger.debug(f"Full response data: {data}")
            return []
        
        # Transform products to match our system format
        transformed_products = []
        for product in products:
            # Handle different product types and quantity rules
            product_type = product.get('product_type', 'package')
            qty_values = product.get('qty_values')
            
            # Determine required fields from params
            required_fields = []
            params = product.get('params', [])
            for param in params:
                if param:  # Only add non-empty params
                    required_fields.append({
                        'field_name': param,
                        'field_type': 'text',  # Default to text input
                        'required': True
                    })
            
            # Handle quantity validation
            quantity_rules = self._parse_quantity_rules(qty_values, product_type)
            
            # Get price
            price = 0
            if 'price' in product:
                price = float(product['price'])
            elif 'cost' in product:
                price = float(product['cost'])
            
            transformed_product = {
                'external_id': str(product.get('id') or product.get('product_id')),
                'name': product.get('name', 'Unnamed Product'),
                'base_price': price,
                'description': f"{product.get('category_name', '')} - {product.get('name', '')}",
                'required_fields': required_fields,
                'category': product.get('category_name', 'general'),
                'product_type': product_type,
                'quantity_rules': quantity_rules,
                'is_available': product.get('available', True),
                'original_data': product
            }
            transformed_products.append(transformed_product)
        
        logger.info(f"✅ Transformed {len(transformed_products)} products")
        return transformed_products

    def check_order_status(self, order_id_or_uuid: str) -> Dict[str, Any]:
        """Check order status by order_id or order_uuid (uuid=1)."""
        try:
            order_val = str(order_id_or_uuid)
            use_uuid = False
            # UUIDv4 heuristic
            if len(order_val) == 36 and order_val.count("-") == 4:
                use_uuid = True

            query_params = {
                "orders": f"[{order_val}]"
            }
            if use_uuid:
                query_params["uuid"] = 1

            result = self.make_request('/client/api/check', 'GET', query_params=query_params, timeout=30)
            if not (result.get('status_code') and 200 <= result.get('status_code') < 300):
                return {
                    'success': False,
                    'error': f"HTTP {result.get('status_code')} error",
                    'status_code': result.get('status_code')
                }

            data = result.get('data', {})
            if isinstance(data, dict) and data.get('status') == 'OK':
                return {
                    'success': True,
                    'data': data,
                    'status_code': result.get('status_code', 200)
                }
            # Some responses may be list directly
            if isinstance(data, list):
                return {
                    'success': True,
                    'data': {"data": data},
                    'status_code': result.get('status_code', 200)
                }

            return {
                'success': False,
                'error': 'Unexpected response format',
                'status_code': result.get('status_code', 400)
            }
        except Exception as e:
            logger.error(f"Error checking Stark-Card order status: {e}")
            return {'success': False, 'error': str(e)}
    
    def _parse_quantity_rules(self, qty_values, product_type):
        """Parse quantity rules based on Stark-Card API documentation"""
        if qty_values is None:
            return {'type': 'fixed', 'value': 1}
        
        elif isinstance(qty_values, list):
            return {'type': 'specific', 'values': qty_values}
        
        elif isinstance(qty_values, dict):
            return {
                'type': 'range',
                'min': float(qty_values.get('min', 1)),
                'max': float(qty_values.get('max', 1))
            }
        
        else:
            return {'type': 'fixed', 'value': 1}
    
    def execute_purchase(self, product_data: Dict, user_data: Dict, transaction_data: Dict) -> Dict[str, Any]:
        """Execute a purchase with Stark-Card API"""
        try:
            product_id = product_data.get('external_id')
            quantity = product_data.get('quantity', 1)
            user_inputs = product_data.get('user_inputs', {})
            
            # Generate unique order UUID (required by API)
            order_uuid = str(uuid.uuid4())
            
            # Build the endpoint - Stark-Card uses GET with query params
            endpoint = f"/client/api/newOrder/{product_id}/params"
            
            # Build query parameters
            query_params = {
                'qty': int(quantity),
                'order_uuid': order_uuid
            }
            
            # Add user inputs as query parameters
            for key, value in user_inputs.items():
                query_params[key] = str(value)
            
            logger.info(f"Making Stark purchase: product_id={product_id}, qty={quantity}, uuid={order_uuid}")
            
            # Make GET request (Stark-Card API uses GET, not POST)
            result = self.make_request(endpoint, 'GET', query_params=query_params, timeout=30)
            
            # Check HTTP status
            if not (result.get('status_code') and 200 <= result.get('status_code') < 300):
                return {
                    'success': False,
                    'error': f"HTTP {result.get('status_code')} error",
                    'status_code': result.get('status_code')
                }
            
            # Parse Stark response - check for 'status' field
            data = result.get('data', {})
            
            # Stark returns {"status": "OK", "data": {...}} or {"status": "ERROR", ...}
            if isinstance(data, dict) and data.get('status') == 'OK':
                order_data = data.get('data', {})
                return {
                    'success': True,
                    'external_transaction_id': str(order_data.get('order_id', '')),
                    'order_id': str(order_data.get('order_id', '')),
                    'order_uuid': order_uuid,
                    'message': 'Purchase successful',
                    'status': order_data.get('status', 'accept'),
                    'price': order_data.get('price'),
                    'data': order_data.get('data', {}),
                    'status_code': result.get('status_code', 200)
                }
            elif isinstance(data, dict) and data.get('status') == 'ERROR':
                error_msg = data.get('msg', {}).get('status', 'Unknown error')
                error_code = data.get('code', 'N/A')
                return {
                    'success': False,
                    'error': f"API Error ({error_code}): {error_msg}",
                    'error_code': error_code,
                    'status_code': result.get('status_code', 400)
                }
            else:
                # Unexpected response format
                return {
                    'success': False,
                    'error': 'Unexpected response format',
                    'status_code': result.get('status_code', 400)
                }
            
        except Exception as e:
            logger.error(f"Error in Stark-Card purchase: {e}")
            return {
                'success': False,
                'error': str(e)
            }

class ConnectorFactory:
    
    @staticmethod
    def get_connector(api_config: ThirdPartyAPI) -> BaseConnector:
        connectors = {
            'daily': DailyConnector,
            'alfaour': AlfaourConnector,
            'alaaeddin': AlaaeddinConnector,
            'stark-card': StarkCardConnector,
        }
        
        connector_class = connectors.get(api_config.provider)
        if not connector_class:
            raise ValueError(f"No connector found for provider: {api_config.provider}")
        
        return connector_class(api_config)
