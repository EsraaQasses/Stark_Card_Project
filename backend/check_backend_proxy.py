import os

configs = [
    '/etc/nginx/sites-available/stark-card-app',
    '/etc/nginx/sites-available/stark-admin',
    '/etc/nginx/sites-available/stark',
    '/etc/nginx/sites-available/stark-ip-ssl'
]

for config in configs:
    if os.path.exists(config):
        print(f"\n🔍 Checking {config}:")
        with open(config, 'r') as f:
            content = f.read()
            if 'proxy_pass' in content and '8000' in content:
                print("✅ Found backend proxy configuration")
                # Extract the backend location block
                import re
                backend_match = re.search(r'location /api.*?\{.*?proxy_pass.*?8000.*?\}', content, re.DOTALL)
                if backend_match:
                    print("Backend location block:")
                    print(backend_match.group(0))
            elif 'proxy_pass' in content:
                print("⚠️  Has proxy_pass but not on port 8000")
