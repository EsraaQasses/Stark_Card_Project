with open('stark_backend/settings.py', 'r') as f:
    content = f.read()
    
import re

# Find relevant settings
settings_to_check = [
    'CORS_', 'CSRF_', 'SESSION_', 'SECURE_'
]

for prefix in settings_to_check:
    matches = re.findall(rf'{prefix}.*', content)
    if matches:
        print(f"\n{prefix}* Settings:")
        for match in matches:
            print(f"  {match}")
