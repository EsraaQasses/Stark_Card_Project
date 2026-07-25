# Read the settings file
settings_file = 'stark_backend/settings.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Add REST framework authentication settings if not present
rest_framework_settings = '''
# Django REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
'''

# Add REST framework settings if not already there
if 'REST_FRAMEWORK' not in content:
    content += rest_framework_settings

with open(settings_file, 'w') as f:
    f.write(content)

print("✅ Updated authentication settings")
