settings_file = 'stark_backend/settings.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Add production cookie settings
cookie_settings = '''
# Production cookie settings
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_AGE = 1209600  # 2 weeks

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_USE_SESSIONS = True

# For production with HTTPS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_DOMAIN = '.stark-card-app.com'
CSRF_COOKIE_DOMAIN = '.stark-card-app.com'
'''

# Add cookie settings if not present
if 'SESSION_COOKIE_SECURE' not in content:
    content += cookie_settings

with open(settings_file, 'w') as f:
    f.write(content)

print("✅ Updated production cookie settings")
