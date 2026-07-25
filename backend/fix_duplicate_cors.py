# Read the settings file
settings_file = 'stark_backend/settings.py'
with open(settings_file, 'r') as f:
    content = f.read()

# Remove duplicate 'corsheaders' from INSTALLED_APPS
lines = content.split('\n')
new_lines = []
cors_count = 0

for line in lines:
    if "'corsheaders'" in line or '"corsheaders"' in line:
        cors_count += 1
        # Only keep the first occurrence
        if cors_count == 1:
            new_lines.append(line)
    else:
        new_lines.append(line)

# Join back and write
new_content = '\n'.join(new_lines)
with open(settings_file, 'w') as f:
    f.write(new_content)

print(f"✅ Removed duplicate corsheaders entries (kept 1, removed {cors_count-1})")
