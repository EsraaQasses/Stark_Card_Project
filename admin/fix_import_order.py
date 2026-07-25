import re

# Fix TwoFAManagement.jsx
with open('src/components/TwoFAManagement.jsx', 'r') as f:
    content = f.read()

# Move react import to top if needed
lines = content.split('\n')
react_imports = []
other_imports = []
other_lines = []
in_imports = True

for line in lines:
    if line.strip().startswith('import') and in_imports:
        if 'react' in line.lower():
            react_imports.append(line)
        else:
            other_imports.append(line)
    else:
        in_imports = False
        other_lines.append(line)

# Reorder imports: react first, then others
fixed_content = '\n'.join(react_imports + other_imports + other_lines)
with open('src/components/TwoFAManagement.jsx', 'w') as f:
    f.write(fixed_content)

print("✓ Fixed import order in TwoFAManagement.jsx")
