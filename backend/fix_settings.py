# Read the current settings
with open('stark_backend/settings.py', 'r') as f:
    lines = f.readlines()

# Find the DATABASES section and replace it
new_lines = []
i = 0
while i < len(lines):
    if 'DATABASES = {' in lines[i]:
        # Skip until we find the end of the DATABASES section
        while '}' not in lines[i] or lines[i].count('{') != lines[i].count('}'):
            i += 1
        i += 1
        
        # Add the new DATABASES configuration
        new_lines.append('''
# Database configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
''')
    else:
        new_lines.append(lines[i])
        i += 1

# Write the fixed file
with open('stark_backend/settings.py', 'w') as f:
    f.writelines(new_lines)

print("✓ Fixed DATABASES configuration")
