# Read the connectors file
with open('third_party_apis/utils/connectors.py', 'r') as f:
    content = f.read()

# Update the make_request method to handle non-JSON responses
new_make_request = '''    def make_request(self, endpoint: str, method: str = 'GET', data: Dict = None, 
                    timeout: int = 30) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=self.headers,
                json=data,
                timeout=timeout
            )
            
            # Handle non-JSON responses gracefully
            response_data = {}
            if response.content:
                try:
                    response_data = response.json()
                except ValueError:
                    # Not JSON, return text content
                    response_data = {'text': response.text[:1000]}  # Limit length
            
            return {
                'success': 200 <= response.status_code < 300,
                'status_code': response.status_code,
                'data': response_data,
                'headers': dict(response.headers),
                'text': response.text[:1000] if response.content else ''
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'status_code': None
            }'''

import re

# Replace the make_request method
pattern = r'    def make_request\(self, endpoint: str, method: str = .GET., data: Dict = None,.*?return \{.*?success.*?False.*?error.*?str\(e\).*?\}'
new_content = re.sub(pattern, new_make_request, content, flags=re.DOTALL)

with open('third_party_apis/utils/connectors.py', 'w') as f:
    f.write(new_content)

print("✅ Updated connector to handle non-JSON responses")
