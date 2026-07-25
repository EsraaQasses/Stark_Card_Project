import requests
from third_party_apis.models import ThirdPartyAPI

try:
    api = ThirdPartyAPI.objects.get(id=1)
    print(f"🔍 Testing API: {api.name}")
    print(f"🌐 Base URL: {api.base_url}")
    print(f"🔑 Has API Key: {bool(api.get_api_key())}")
    
    # Test the products endpoint directly
    url = f"{api.base_url}/api/products"
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'StarkPayments/1.0'
    }
    
    # Add API key if exists
    api_key = api.get_api_key()
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    
    print(f"🔗 Testing URL: {url}")
    print(f"🔑 Headers: {headers}")
    
    response = requests.get(url, headers=headers, timeout=30)
    print(f"📊 Response Status: {response.status_code}")
    print(f"📋 Response Headers: {dict(response.headers)}")
    
    # Check content type
    content_type = response.headers.get('content-type', '')
    print(f"📄 Content-Type: {content_type}")
    
    if response.content:
        # Try to parse as JSON
        try:
            data = response.json()
            print(f"✅ Valid JSON response:")
            print(f"📦 Response keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        except Exception as e:
            print(f"❌ Not valid JSON: {e}")
            print(f"📄 Raw response (first 500 chars): {response.text[:500]}")
    else:
        print("❌ Empty response")
        
except Exception as e:
    print(f"💥 Error: {e}")
    import traceback
    traceback.print_exc()
