# Read the settings file
settings_file = 'stark_backend/settings.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Add corsheaders to INSTALLED_APPS
if "'corsheaders'" not in content:
    content = content.replace(
        "INSTALLED_APPS = [",
        "INSTALLED_APPS = [\n    'corsheaders',"
    )

# Add CorsMiddleware to MIDDLEWARE (at the top)
if "'corsheaders.middleware.CorsMiddleware'" not in content:
    content = content.replace(
        "MIDDLEWARE = [",
        "MIDDLEWARE = [\n    'corsheaders.middleware.CorsMiddleware',"
    )

# Add CORS settings at the end of the file
cors_settings = '''
# CORS Settings
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://stark-card-app.com", 
    "http://stark-card-app.com",
    "https://www.stark-card-app.com",
    "http://www.stark-card-app.com",
    "http://37.120.185.235",
    "https://37.120.185.235",
]

CSRF_TRUSTED_ORIGINS = [
    "https://stark-card-app.com",
    "http://stark-card-app.com",
    "https://www.stark-card-app.com", 
    "http://www.stark-card-app.com",
    "http://37.120.185.235",
    "https://37.120.185.235",
]

# For API views, exempt from CSRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
'''

# Add CORS settings if they don't exist
if 'CORS_ALLOW_ALL_ORIGINS' not in content:
    content += cors_settings

with open(settings_file, 'w') as f:
    f.write(content)

print("✅ Configured CORS settings")
