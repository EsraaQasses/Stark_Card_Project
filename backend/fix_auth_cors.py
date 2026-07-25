# Read the settings file
settings_file = 'stark_backend/settings.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Remove the problematic CORS_ALLOW_ALL_ORIGINS and replace with proper settings
new_cors_settings = '''
# CORS Settings for frontend-backend communication
CORS_ALLOWED_ORIGINS = [
    "https://stark-card-app.com",
    "http://stark-card-app.com", 
    "https://www.stark-card-app.com",
    "http://www.stark-card-app.com",
    "http://37.120.185.235",
    "https://37.120.185.235",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CSRF_TRUSTED_ORIGINS = [
    "https://stark-card-app.com",
    "http://stark-card-app.com",
    "https://www.stark-card-app.com",
    "http://www.stark-card-app.com",
    "http://37.120.185.235",
    "https://37.120.185.235",
]

# Session and authentication settings
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 1209600  # 2 weeks in seconds

CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read CSRF token

# For development, you might need to adjust these:
# SESSION_COOKIE_DOMAIN = '.stark-card-app.com'  # Uncomment if using subdomains
'''

# Remove existing CORS settings and add new ones
import re

# Remove existing CORS settings
content = re.sub(r'# CORS Settings.*?CORS_ALLOW_ALL_ORIGINS.*?\n', '', content, flags=re.DOTALL)
content = re.sub(r'CORS_ALLOW_ALL_ORIGINS.*?\n', '', content)
content = re.sub(r'CORS_ALLOWED_ORIGINS.*?\]', '', content, flags=re.DOTALL)
content = re.sub(r'CORS_ALLOW_CREDENTIALS.*?\n', '', content)
content = re.sub(r'CSRF_TRUSTED_ORIGINS.*?\]', '', content, flags=re.DOTALL)
content = re.sub(r'REST_FRAMEWORK.*?\]\n\}', '', content, flags=re.DOTALL)

# Add the new CORS settings at the end
content += new_cors_settings

with open(settings_file, 'w') as f:
    f.write(content)

print("✅ Updated CORS settings for authentication")
