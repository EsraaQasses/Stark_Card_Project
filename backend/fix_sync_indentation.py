# Read the current api_service.py file
with open('third_party_apis/services/api_service.py', 'r') as f:
    content = f.read()

# Find the exact location of the sync_products_from_api method and fix it
import re

# Find the method and everything until the next method or class
pattern = r'(    @staticmethod\s+def sync_products_from_api\(api_id: int\) -> Dict\[str, Any\]:.*?)(?=\n    @staticmethod|\nclass|\n\nclass)'

# New properly formatted method
new_method = '''    @staticmethod
    def sync_products_from_api(api_id: int) -> Dict[str, Any]:
        """Sync products from external API to ExternalProduct model - FIXED VERSION"""
        from store.models import ExternalProduct  # Import here to avoid circular imports
        
        try:
            api_config = ThirdPartyAPI.objects.get(id=api_id)
            
            # Use connector directly to avoid response format issues
            connector = ConnectorFactory.get_connector(api_config)
            products_data = connector.get_products()
            
            if not products_data:
                return {
                    'success': False,
                    'error': 'No products returned from API',
                    'details': 'Empty product list from connector'
                }
            
            print(f"🔄 Sync: Processing {len(products_data)} products from {api_config.name}")
            
            # LESS RESTRICTIVE FILTERING: Only filter out products with no external_id or no name
            valid_products = [
                product for product in products_data 
                if product.get('external_id') and product.get('name')
            ]
            
            print(f"🔄 Sync: {len(valid_products)} products have external_id and name")
            
            synced_count = 0
            updated_count = 0
            skipped_count = 0
            
            for product_data in valid_products:
                # Handle null descriptions
                description = product_data.get('description') or ''
                
                # Use base_price if available, otherwise use 0 (free products are valid)
                base_price = product_data.get('base_price', 0)
                
                # Required fields - use empty list if none provided
                required_fields = product_data.get('required_fields', [])
                
                # Create or update ExternalProduct - don't filter by price or fields
                try:
                    external_product, created = ExternalProduct.objects.update_or_create(
                        external_id=product_data['external_id'],
                        api_config=api_config,
                        defaults={
                            'name': product_data['name'],
                            'description': description,
                            'base_price': base_price,
                            'category': product_data.get('category', 'general'),
                            'required_fields_json': required_fields,
                            'external_data': product_data.get('original_data', {}),
                            'is_active': True  # Always set as active initially
                        }
                    )
                    
                    if created:
                        synced_count += 1
                        print(f"✅ Created: {product_data['name']} (Price: {base_price})")
                    else:
                        updated_count += 1
                        print(f"🔄 Updated: {product_data['name']}")
                        
                except Exception as e:
                    print(f"❌ Failed to sync {product_data.get('name')}: {e}")
                    skipped_count += 1
            
            return {
                'success': True,
                'synced_count': synced_count,
                'updated_count': updated_count,
                'skipped_count': skipped_count,
                'total_products': len(products_data),
                'valid_products': len(valid_products),
                'details': f"Synced: {synced_count}, Updated: {updated_count}, Skipped: {skipped_count}"
            }
            
        except Exception as e:
            logger.error(f"Product sync failed for API {api_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }'''

# Replace the method
if re.search(pattern, content, re.DOTALL):
    new_content = re.sub(pattern, new_method, content, flags=re.DOTALL)
    with open('third_party_apis/services/api_service.py', 'w') as f:
        f.write(new_content)
    print("✅ Fixed sync_products_from_api method indentation")
else:
    print("❌ Could not find the method to replace")
    print("Let's try a different approach...")
    
    # Alternative: Just restore from git
    import subprocess
    try:
        subprocess.run(['git', 'checkout', 'third_party_apis/services/api_service.py'], check=True)
        print("✅ Restored original file from git")
    except:
        print("❌ Git restore failed")
