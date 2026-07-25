# Read the original file
with open('third_party_apis/services/api_service.py', 'r') as f:
    lines = f.readlines()

# Find the line numbers for the sync_products_from_api method
start_line = -1
end_line = -1
in_method = False
method_indent = ""

for i, line in enumerate(lines):
    if 'def sync_products_from_api(api_id: int) -> Dict[str, Any]:' in line:
        start_line = i
        in_method = True
        # Get the indentation level
        method_indent = line[:len(line) - len(line.lstrip())]
        continue
    
    if in_method and line.strip() and not line.startswith(method_indent) and not line.startswith(' ' * (len(method_indent) + 4)):
        # Found the end of the method
        end_line = i
        break

if start_line == -1:
    print("❌ Could not find sync_products_from_api method")
    exit(1)

print(f"📝 Method found from line {start_line} to {end_line}")

# Read the current method to understand its structure
current_method = ''.join(lines[start_line:end_line])
print("Current method structure:")
print(current_method[:500] + "..." if len(current_method) > 500 else current_method)

# Let's just fix the filtering part by finding and replacing that specific section
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Look for the filtering section that's too restrictive
    if 'active_products = [' in line and 'if product.get' in lines[i+1] if i+1 < len(lines) else False:
        print(f"🔧 Found restrictive filtering at line {i}")
        
        # Replace with less restrictive filtering
        new_lines.append(line)  # Keep the 'active_products = [' line
        
        # Skip the old filtering lines
        while i < len(lines) and ']' not in lines[i]:
            i += 1
        
        # Add new filtering logic
        new_lines.append('                product for product in products_data \n')
        new_lines.append('                if product.get(\'external_id\') and product.get(\'name\')\n')
        new_lines.append('            ]\n')
        new_lines.append('            \n')
        new_lines.append('            synced_count = 0\n')
        new_lines.append('            updated_count = 0\n')
        new_lines.append('            \n')
        new_lines.append('            for product_data in active_products:\n')
        
        # Skip the old loop
        while i < len(lines) and 'for product_data in active_products:' not in lines[i]:
            i += 1
        i += 1  # Skip the for loop line
        while i < len(lines) and lines[i].startswith('                '):
            i += 1  # Skip the loop body
        
    else:
        new_lines.append(line)
        i += 1

# Write the fixed file
with open('third_party_apis/services/api_service.py', 'w') as f:
    f.writelines(new_lines)

print("✅ Applied targeted fix to filtering logic")
