import re

# Read the current views.py
with open('users/views.py', 'r') as f:
    content = f.read()

# Step 1: Add JWTAuthentication import if not present
if 'from rest_framework_simplejwt.authentication import JWTAuthentication' not in content:
    # Find the right place to add the import (after other authentication imports)
    lines = content.split('\n')
    updated_lines = []
    auth_import_added = False
    
    for line in lines:
        updated_lines.append(line)
        # Add after rest_framework authentication imports
        if 'from rest_framework.authentication import' in line and not auth_import_added:
            updated_lines.append('from rest_framework_simplejwt.authentication import JWTAuthentication')
            auth_import_added = True
    
    content = '\n'.join(updated_lines)

# Step 2: Update UserProfileView to include JWT authentication
# Find the UserProfileView class and add authentication_classes
class_pattern = r'(class UserProfileView\\(.*?\\):)(\\s+serializer_class = UserProfileSerializer)'
replacement = r'\\1\\n    authentication_classes = [JWTAuthentication, TokenAuthentication, SessionAuthentication]\\2'

content = re.sub(class_pattern, replacement, content, flags=re.DOTALL)

# Write the updated content back
with open('users/views.py', 'w') as f:
    f.write(content)

print("Successfully updated UserProfileView with JWT authentication")
