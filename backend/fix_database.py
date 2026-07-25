# Read the current settings
with open('stark_backend/settings.py', 'r') as f:
    content = f.read()

# Replace the entire database configuration section
# Find the line with "if DEBUG:" and replace everything until the end of DATABASES
import re

# Pattern to find from "if DEBUG:" to the end of DATABASES
pattern = r"if DEBUG:.*?DATABASES = \{.*?\n\}"
replacement = '''# Database configuration - Always use SQLite
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}'''

# Use a more specific pattern
new_content = re.sub(r"# Database configuration.*?(if DEBUG:.*?else:.*?DATABASES = \{.*?\n\})", replacement, content, flags=re.DOTALL)

# If that didn't work, try a simpler approach - just comment out PostgreSQL
if "postgresql" in new_content:
    lines = new_content.split('\n')
    new_lines = []
    in_databases = False
    for line in lines:
        if 'DATABASES = {' in line:
            in_databases = True
            new_lines.append('''# Database configuration - Always use SQLite
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}''')
            # Skip old database configuration
            while '}' not in line or line.count('{') != line.count('}'):
                line = next(lines)
            continue
        elif in_databases and '}' in line and line.count('{') == line.count('}'):
            in_databases = False
            continue
        elif not in_databases:
            new_lines.append(line)
    
    new_content = '\n'.join(new_lines)

with open('stark_backend/settings.py', 'w') as f:
    f.write(new_content)

print("✓ Fixed database configuration")
