config_file = '/etc/nginx/sites-available/stark-card-app'

with open(config_file, 'r') as f:
    content = f.read()

# Ensure backend API location has proper authentication headers
backend_config = '''
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Critical for authentication
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
        proxy_pass_header Authorization;
        
        # Cookie settings for cross-origin
        proxy_cookie_path / "/; Secure; SameSite=None";
        proxy_cookie_flags ~ secure samesite=none;
        
        # CORS headers
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-CSRFToken' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400 always;
            add_header 'Content-Length' 0 always;
            return 204;
        }
        
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-CSRFToken' always;
    }'''

# Replace the backend location block
import re
pattern = r'location /api/.*?^\s*}'
content = re.sub(pattern, backend_config, content, flags=re.DOTALL|re.MULTILINE)

with open(config_file, 'w') as f:
    f.write(content)

print("✅ Updated Nginx authentication configuration")
