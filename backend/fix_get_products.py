# Read the connectors file
with open('third_party_apis/utils/connectors.py', 'r') as f:
    content = f.read()

# Update the get_products method to be more robust
new_get_products = '''    def get_products(self) -> list:
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
            # Return empty list instead of None
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
        return transformed_products'''

import re

# Replace the get_products method
pattern = r'    def get_products\(self\) -> list:.*?return \[\]'
new_content = re.sub(pattern, new_get_products, content, flags=re.DOTALL)

with open('third_party_apis/utils/connectors.py', 'w') as f:
    f.write(new_content)

print("✅ Updated get_products method to be more robust")
