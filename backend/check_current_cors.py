# Read the settings file
with open('stark_backend/settings.py', 'r') as f:
    content = f.read()
    
# Extract CORS related settings
import re

cors_settings = re.findall(r'CORS_.*?=.*?(?:\n|$)', content)
csrf_settings = re.findall(r'CSRF_.*?=.*?(?:\n|$)', content)

print("🔧 Current CORS Settings:")
for setting in cors_settings:
    print(f"  {setting.strip()}")

print("\n🔧 Current CSRF Settings:")
for setting in csrf_settings:
    print(f"  {setting.strip()}")

# Check session cookie settings
session_settings = re.findall(r'SESSION_.*?=.*?(?:\n|$)', content)
print("\n🔧 Current Session Settings:")
for setting in session_settings:
    print(f"  {setting.strip()}")
