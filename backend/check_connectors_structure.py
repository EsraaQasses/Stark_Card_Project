import ast

with open('third_party_apis/utils/connectors.py', 'r') as f:
    content = f.read()

try:
    # Try to parse the Python syntax
    ast.parse(content)
    print("✅ Python syntax is valid")
except SyntaxError as e:
    print(f"❌ Syntax error: {e}")
    print("The file has syntax errors that need to be fixed")

# Check if all classes are defined
classes_to_check = ['BaseConnector', 'DailyConnector', 'AlfaourConnector', 'AlaaeddinConnector', 'ConnectorFactory']
for class_name in classes_to_check:
    if f"class {class_name}" in content:
        print(f"✅ {class_name} is defined")
    else:
        print(f"❌ {class_name} is missing")
