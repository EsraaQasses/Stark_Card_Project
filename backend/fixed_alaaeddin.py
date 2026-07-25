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
        
        if result.get('success'):
            products = result.get('data', {}).get('products', [])
            
            # Transform Alaaeddin API response to match our expected format
            transformed_products = []
            for product in products:
                # Handle price conversion - Alaaeddin prices might be multipliers
                default_price = product.get('default_price')
                try:
                    base_price = float(default_price) if default_price else 0
                except (ValueError, TypeError):
                    base_price = 0
                
                transformed_product = {
                    'external_id': str(product.get('id')),
                    'name': product.get('name'),
                    'base_price': base_price,
                    'description': product.get('description'),
                    'required_fields': product.get('fields', []),
                    'category': product.get('category', 'general'),
                    'original_data': {
                        'default_price': product.get('default_price'),
                        'custom_price': product.get('custom_price'),
                        'final_price': product.get('final_price')
                    }
                }
                transformed_products.append(transformed_product)
            
            print(f"🔄 Alaaeddin connector: Transformed {len(transformed_products)} products")
            return transformed_products
        
        print(f"❌ Alaaeddin connector: API call failed - {result.get('error')}")
        return []
    
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
