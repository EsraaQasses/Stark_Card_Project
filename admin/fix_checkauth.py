import re

# Read the current AuthContext
with open('src/contexts/AuthContext.js', 'r') as f:
    content = f.read()

# Define the new checkAuth function
new_checkAuth = '''  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userData = localStorage.getItem('user');

      if (!token || !userData) {
        setLoading(false);
        return;
      }

      // Verify token is still valid and user is admin
      const response = await axiosInstance.get('users/me/');
      const currentUser = response.data;

      // Ensure user is still admin and not banned
      if (currentUser.role === 'admin' && !currentUser.is_banned) {
        setUser(currentUser);
      } else {
        // Don't logout immediately, just clear invalid data
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setUser(null);
      }
    } catch (error) {
      // Don't logout on network errors, only clear if it's an auth error
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setUser(null);
      }
      // For other errors (network issues), just continue
    } finally {
      setLoading(false);
    }
  };'''

# Find and replace the old checkAuth function
old_pattern = r'const checkAuth = async \(\) => {[^}]*?} catch \(error\) {[^}]*?logout\(\);[\s\S]*?} finally {[\s\S]*?setLoading\(false\);[\s\S]*?};\s*}'

if re.search(old_pattern, content):
    content = re.sub(old_pattern, new_checkAuth, content)
    print("✓ Successfully replaced checkAuth function")
else:
    print("✗ Could not find the exact pattern, trying alternative method...")
    # Alternative: Replace line by line
    lines = content.split('\n')
    new_lines = []
    in_checkauth = False
    replaced = False
    
    for line in lines:
        if 'const checkAuth = async () => {' in line and not replaced:
            new_lines.append(new_checkAuth)
            in_checkauth = True
            replaced = True
        elif in_checkauth:
            if '};' in line and line.strip() == '  };':
                in_checkauth = False
                new_lines.append(line)
            # Skip old lines
        else:
            new_lines.append(line)
    
    content = '\n'.join(new_lines)

# Write the fixed content back
with open('src/contexts/AuthContext.js', 'w') as f:
    f.write(content)

print("✓ AuthContext has been fixed")
