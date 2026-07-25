import re

with open('src/components/TwoFASetup.jsx', 'r') as f:
    content = f.read()

# Simple fix: ensure React import is first
if "import React" in content and "import axiosInstance" in content:
    # Extract the React import
    react_import = re.search(r"import React[^;]+;", content).group(0)
    # Remove it from current position
    content = content.replace(react_import, "")
    # Add it back at the top (after any existing React imports)
    lines = content.split('\n')
    new_lines = []
    react_added = False
    
    for line in lines:
        if not react_added and line.strip().startswith('import') and 'react' not in line.lower():
            new_lines.append(react_import)
            react_added = True
        new_lines.append(line)
    
    if not react_added:
        new_lines.insert(0, react_import)
    
    content = '\n'.join(new_lines)

with open('src/components/TwoFASetup.jsx', 'w') as f:
    f.write(content)

print("✓ Fixed import order in TwoFASetup.jsx")
