config_file = '/etc/nginx/sites-available/stark-card-app'

with open(config_file, 'r') as f:
    content = f.read()

# Find and update the backend proxy location
import re

# Pattern to find the backend location block
pattern = r'(location /api.*?\{[^}]*proxy_pass[^}]*\})'

def update_backend_proxy(match):
    old_block = match.group(1)
    
    # Check if it already has proper proxy settings
    if 'proxy_set_header' in old_block and 'Host' in old_block:
        print("✅ Backend proxy already has proper settings")
        return old_block
    
    # Create new backend proxy block with proper headers
    new_block = '''
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Cookie and session handling
        proxy_cookie_path / "/; HTTPOnly; Secure; SameSite=Lax";
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
        proxy_pass_header Cookie;
        
        # CORS headers for preflight
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400 always;
            add_header 'Content-Type' 'text/plain; charset=utf-8' always;
            add_header 'Content-Length' 0 always;
            return 204;
        }
        
        # CORS headers for actual requests
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }'''
    
    print("🔄 Updating backend proxy configuration...")
    return new_block

# Replace the backend location block
new_content = re.sub(pattern, update_backend_proxy, content, flags=re.DOTALL)

with open(config_file, 'w') as f:
    f.write(new_content)

print("✅ Updated Nginx backend proxy configuration")
