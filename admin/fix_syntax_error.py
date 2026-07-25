# Read the current file
with open('src/contexts/AuthContext.js', 'r') as f:
    lines = f.readlines()

# Find and fix the issue - look for the checkAuth function end
fixed_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    fixed_lines.append(line)
    
    # Look for the problematic area around line 93
    if 'setLoading(false);' in line and i < len(lines) - 1:
        next_line = lines[i + 1]
        if '  };' in next_line:
            # This is correct, already has closing brace
            i += 1
            fixed_lines.append(next_line)
        elif 'useEffect' in next_line or '  // Legacy login' in next_line:
            # Missing closing brace, add it
            fixed_lines.append('  };\n')
    
    i += 1

# Write the fixed content
with open('src/contexts/AuthContext.js', 'w') as f:
    f.writelines(fixed_lines)

print("✓ Fixed syntax error in AuthContext")
