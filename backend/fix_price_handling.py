# Read the current connectors file
with open('third_party_apis/utils/connectors.py', 'r') as f:
    content = f.read()

# Update the price handling in get_products method
new_price_section = '''            # Price handling - convert string prices to float
            price_fields = ['default_price', 'price', 'base_price', 'cost', 'amount', 'final_price', 'custom_price']
            base_price = 0
            for field in price_fields:
                price_val = product.get(field)
                if price_val is not None:
                    try:
                        # Handle string prices like "1.10"
                        if isinstance(price_val, str):
                            # Remove any currency symbols or spaces
                            price_val = price_val.replace('$', '').replace('€', '').replace('£', '').strip()
                        base_price = float(price_val)
                        break
                    except (ValueError, TypeError) as e:
                        print(f"⚠️  Could not convert price {price_val} from field {field}: {e}")
                        continue'''

import re

# Replace the price handling section
pattern = r'# Price handling - convert string prices to float.*?base_price = float\(price_val\)'
new_content = re.sub(pattern, new_price_section, content, flags=re.DOTALL)

with open('third_party_apis/utils/connectors.py', 'w') as f:
    f.write(new_content)

print("✅ Updated price handling in connector")
