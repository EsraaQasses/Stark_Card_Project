# Read the restored file
with open('third_party_apis/services/api_service.py', 'r') as f:
    content = f.read()

# Replace just the restrictive filtering line with less restrictive filtering
# Find: if product.get('base_price', 0) > 0 and product.get('required_fields')
# Replace with: if product.get('external_id') and product.get('name')
new_content = content.replace(
    "if product.get('base_price', 0) > 0 and product.get('required_fields')",
    "if product.get('external_id') and product.get('name')"
)

# Also update the variable name from active_products to valid_products for clarity
new_content = new_content.replace(
    "active_products = [",
    "valid_products = ["
).replace(
    "for product_data in active_products:",
    "for product_data in valid_products:"
).replace(
    "'active_products': len(active_products)",
    "'valid_products': len(valid_products)"
)

with open('third_party_apis/services/api_service.py', 'w') as f:
    f.write(new_content)

print("✅ Applied minimal filtering fix")
