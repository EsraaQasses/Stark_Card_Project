nginx_config = '/etc/nginx/sites-available/stark-backend'

try:
    with open(nginx_config, 'r') as f:
        content = f.read()
    
    if 'proxy_set_header Host' in content:
        print("✅ Nginx has proxy settings")
    else:
        print("❌ Nginx might need proxy settings for cookies")
        
except FileNotFoundError:
    print("ℹ️  Nginx config not found at standard location")
