settings_file = 'stark_backend/settings.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Critical fixes for frontend authentication
critical_fixes = '''
# CRITICAL FIXES FOR FRONTEND AUTHENTICATION
CORS_ALLOW_CREDENTIALS = True
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

CSRF_TRUSTED_ORIGINS = [
    "https://stark-card-app.com",
    "http://stark-card-app.com",
    "https://www.stark-card-app.com",
    "http://www.stark-card-app.com", 
    "http://37.120.185.235",
    "https://37.120.185.235",
]

# Session settings for frontend compatibility
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'None'  # Changed from Lax to None
SESSION_COOKIE_AGE = 1209600

CSRF_COOKIE_SECURE = True  
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript access
CSRF_COOKIE_SAMESITE = 'None'  # Changed from Lax to None

# Remove domain restrictions for now
# SESSION_COOKIE_DOMAIN = '.stark-card-app.com'
# CSRF_COOKIE_DOMAIN = '.stark-card-app.com'

# HTTPS settings
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
'''

# Remove existing CORS/CSRF settings and add new ones
import re

# Remove existing settings
patterns_to_remove = [
    r'CORS_ALLOW_ALL_ORIGINS.*\n',
    r'CORS_ALLOW_CREDENTIALS.*\n', 
    r'CORS_ALLOWED_ORIGINS.*?\]',
    r'CSRF_TRUSTED_ORIGINS.*?\]',
    r'SESSION_COOKIE_.*?\n',
    r'CSRF_COOKIE_.*?\n',
    r'SECURE_PROXY_SSL_HEADER.*\n'
]

for pattern in patterns_to_remove:
    content = re.sub(pattern, '', content, flags=re.DOTALL|re.MULTILINE)

# Add the critical fixes
content += critical_fixes

with open(settings_file, 'w') as f:
    f.write(content)

print("✅ Applied critical authentication fixes")
