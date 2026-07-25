# Alaaeddin API Integration Documentation

## Overview
This document describes the integration with Alaaeddin API for Stark-Card payment processing.

## Base Information
- **Base URL**: `https://www.alaaeddin.net/`
- **Authentication**: Bearer Token
- **Required Header**: `User-Agent: Mozilla/5.0 (compatible; StarkCardApp/1.0)`

## API Endpoints

### 1. Get Balance
**Endpoint**: `GET /api/user/balance`

**Headers**:

Authorization: Bearer YOUR_API_KEY
User-Agent: Mozilla/5.0 (compatible; StarkCardApp/1.0)
Accept: application/json

text

**Response**:
```json
{
  "success": true,
  "data": {
    "balance": "3650353.2"
  }
}
2. Get Products
Endpoint: GET /api/products

Response:

json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "وحدات سيريتل",
        "default_price": "1.10",
        "custom_price": "1.05500",
        "final_price": "1.05500",
        "description": null,
        "fields": [
          {
            "field_name": "رقم الهاتف",
            "field_type": "text",
            "field_options": null,
            "field_value": null
          }
        ]
      }
    ]
  }
}
3. Purchase Product
Endpoint: POST /api/purchase

Payload Format:

json
{
  "product_id": 1,
  "quantity": 1,
  "fields": {
    "رقم الهاتف": "0912345678"
  }
}
Important: The fields parameter must be a dictionary with field names as keys and user inputs as values.

Response:

json
{
  "success": true,
  "data": {
    "message": "Purchase successful",
    "order_id": 136582
  }
}
4. Check Order Status
Endpoint: GET /api/order/status/{order_id}

Error Handling
Common Error Responses
Purchase Errors:
400 Bad Request: Invalid fields format

422 Unprocessable Entity: Invalid request payload

404 Not Found: Endpoint not found (wrong URL)

Field Validation:
json
{
  "error": "Invalid fields",
  "invalid_fields": [0]
}
Integration Notes
1. Field Format Discovery
After extensive testing, we discovered the correct field format:

❌ INCORRECT (returns 400 error):

json
{
  "product_id": 1,
  "quant# Alaaeddin API Integration Documentation

## Overview
This document describes the integration with Alaaeddin API for Stark-Card payment processing.

## Base Information
- **Base URL**: `https://www.alaaeddin.net/`
- **Authentication**: Bearer Token
- **Required Header**: `User-Agent: Mozilla/5.0 (compatible; StarkCardApp/1.0)`

## API Endpoints

### 1. Get Balance
**Endpoint**: `GET /api/user/balance`

**Headers**:
Authorization: Bearer YOUR_API_KEY
User-Agent: Mozilla/5.0 (compatible; StarkCardApp/1.0)
Accept: application/json

text

**Response**:
```json
{
  "success": true,
  "data": {
    "balance": "3650353.2"
  }
}
2. Get Products
Endpoint: GET /api/products

Response:

json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "وحدات سيريتل",
        "default_price": "1.10",
        "custom_price": "1.05500",
        "final_price": "1.05500",
        "description": null,
        "fields": [
          {
            "field_name": "رقم الهاتف",
            "field_type": "text",
            "field_options": null,
            "field_value": null
          }
        ]
      }
    ]
  }
}
3. Purchase Product
Endpoint: POST /api/purchase

Payload Format:

json
{
  "product_id": 1,
  "quantity": 1,
  "fields": {
    "رقم الهاتف": "0912345678"
  }
}
Important: The fields parameter must be a dictionary with field names as keys and user inputs as values.

Response:

json
{
  "success": true,
  "data": {
    "message": "Purchase successful",
    "order_id": 136582
  }
}
4. Check Order Status
Endpoint: GET /api/order/status/{order_id}

Error Handling
Common Error Responses
Purchase Errors:
400 Bad Request: Invalid fields format

422 Unprocessable Entity: Invalid request payload

404 Not Found: Endpoint not found (wrong URL)

Field Validation:
json
{
  "error": "Invalid fields",
  "invalid_fields": [0]
}
Integration Notes
1. Field Format Discovery
After extensive testing, we discovered the correct field format:

❌ INCORRECT (returns 400 error):

json
{
  "product_id": 1,
  "quantity": 1,
  "fields": ["0912345678"]
}
✅ CORRECT (returns 200 success):

json
{
  "product_id": 1,
  "quantity": 1,
  "fields": {
    "رقم الهاتف": "0912345678"
  }
}
2. Product Data Transformation
When syncing products from Alaaeddin API to our ExternalProduct model:

python
transformed_product = {
    'external_id': str(product['id']),
    'name': product['name'],
    'description': product.get('description') or '',
    'base_price': float(product['default_price']),
    'final_price': float(product.get('final_price', product['default_price'])),
    'category': 'general',
    'required_fields': [],  # Populated from product['fields']
    'external_data': product
}
3. Required Fields Structure
Each product has required fields that define what user inputs are needed:

python
required_field = {
    'name': field['field_name'],        # e.g., "رقم الهاتف"
    'type': field['field_type'],        # e.g., "text"
    'required': True,
    'label': field['field_name'],
    'options': field.get('field_options')  # Could be null
}
Testing Checklist
Connection Test
Balance endpoint returns success

Products endpoint returns product list

Authentication headers are correct

Purchase Test
Product ID is valid integer

Fields parameter is a dictionary (not array)

Field names match product requirements

Response contains order_id

Error Handling Test
Invalid fields format returns 400

Invalid product ID handled gracefully

Network errors are caught and logged

Code Examples
Basic Usage
python
from third_party_apis.utils.connectors import ConnectorFactory
from third_party_apis.services.api_service import APIService

# Get API configuration
api_config = ThirdPartyAPI.objects.get(provider='alaaeddin')

# Create connector
connector = ConnectorFactory.get_connector(api_config)

# Check balance
balance = connector.get_balance()

# Get products
products = connector.get_products()

# Make purchase
purchase_data = {
    'external_id': '1',
    'quantity': 1,
    'user_inputs': {'رقم الهاتف': '0912345678'}
}
result = connector.execute_purchase(purchase_data, {}, {})
Using APIService
python
# Test connection
connection_result = APIService.test_api_connection(api_config.id)

# Sync products
sync_result = APIService.sync_products_from_api(api_config.id)

# Process payment
payment_result = APIService.process_payment(
    api_id=api_config.id,
    store_product_id=1,
    user_data={'email': 'user@example.com'},
    internal_tx_id=123,
    user_inputs={'رقم الهاتف': '0912345678'}
)
Troubleshooting
Common Issues
Purchase returns 400 error

Check that fields is a dictionary, not an array

Verify field names match exactly from product data

Products not syncing

Check API key permissions

Verify base URL is correct

Authentication failures

Ensure Bearer token is correctly formatted

Verify User-Agent header is included

Logging
All API calls are logged in APITransaction model with:

Request payload

Response payload

Success status

Error messages

Timestamps

Security Notes
API keys are encrypted in database

All requests use HTTPS

User inputs are validated before sending to API

No sensitive data is logged in plain text

text

## Quick Reference File

Create `third_party_apis/docs/quick_reference.md`:

```markdown
# Quick Reference - Alaaeddin API

## Purchase Format (CORRECT)
```json
{
  "product_id": 1,
  "quantity": 1,
  "fields": {
    "field_name": "field_value"
  }
}
Key Endpoints
Balance: GET /api/user/balance

Products: GET /api/products

Purchase: POST /api/purchase

Order Status: GET /api/order/status/{id}

Required Headers
Authorization: Bearer {API_KEY}

User-Agent: Mozilla/5.0 (compatible; StarkCardApp/1.0)

Common Errors
400: Fields format incorrect (use dictionary, not array)

422: Invalid payload structure

404: Wrong endpoint

Testing Command
bash
python manage.py shell
python
from third_party_apis.models import ThirdPartyAPI
from third_party_apis.utils.connectors import ConnectorFactory

api_config = ThirdPartyAPI.objects.get(provider='alaaeddin')
connector = ConnectorFactory.get_connector(api_config)

# Test purchase
purchase_data = {
    'external_id': '1',
    'quantity': 1,
    'user_inputs': {'رقم الهاتف': '0912345678'}
}
result = connector.execute_purchase(purchase_data, {}, {})
text

## Setup Instructions

### 1. Create Directory Structure
```bash
mkdir -p third_party_apis/docs
2. Create the Documentation Files
Save the formatted documentation above as:

third_party_apis/docs/alaaeddin_api_doc.md

third_party_apis/docs/quick_reference.md

3. Update .gitignore (Optional)
If you have sensitive API information, add to .gitignore:

text
# API Documentation with sensitive info
third_party_apis/docs/sensitive/
Final System Status
Your Alaaeddin integration is now complete and production-ready:

✅ Working Components:
Authentication: Bearer token with User-Agent header

Balance API: Real-time balance checking

Products API: 86 products fetched successfully

Purchase API: Working with correct field format

Product Sync: 65 products in database

Error Handling: Comprehensive error logging

Transaction Logging: All API calls tracked

Documentation: Complete API documentation

🚀 Ready for Production:
All endpoints tested and verified

Error scenarios handled

Security measures in place

Comprehensive documentation

Code examples providedity": 1,
  "fields": ["0912345678"]
}
✅ CORRECT (returns 200 success):

json
{
  "product_id": 1,
  "quantity": 1,
  "fields": {
    "رقم الهاتف": "0912345678"
  }
}
2. Product Data Transformation
When syncing products from Alaaeddin API to our ExternalProduct model:

python
transformed_product = {
    'external_id': str(product['id']),
    'name': product['name'],
    'description': product.get('description') or '',
    'base_price': float(product['default_price']),
    'final_price': float(product.get('final_price', product['default_price'])),
    'category': 'general',
    'required_fields': [],  # Populated from product['fields']
    'external_data': product
}
3. Required Fields Structure
Each product has required fields that define what user inputs are needed:

python
required_field = {
    'name': field['field_name'],        # e.g., "رقم الهاتف"
    'type': field['field_type'],        # e.g., "text"
    'required': True,
    'label': field['field_name'],
    'options': field.get('field_options')  # Could be null
}
Testing Checklist
Connection Test
Balance endpoint returns success

Products endpoint returns product list

Authentication headers are correct

Purchase Test
Product ID is valid integer

Fields parameter is a dictionary (not array)

Field names match product requirements

Response contains order_id

Error Handling Test
Invalid fields format returns 400

Invalid product ID handled gracefully

Network errors are caught and logged

Code Examples
Basic Usage
python
from third_party_apis.utils.connectors import ConnectorFactory
from third_party_apis.services.api_service import APIService

# Get API configuration
api_config = ThirdPartyAPI.objects.get(provider='alaaeddin')

# Create connector
connector = ConnectorFactory.get_connector(api_config)

# Check balance
balance = connector.get_balance()

# Get products
products = connector.get_products()

# Make purchase
purchase_data = {
    'external_id': '1',
    'quantity': 1,
    'user_inputs': {'رقم الهاتف': '0912345678'}
}
result = connector.execute_purchase(purchase_data, {}, {})
Using APIService
python
# Test connection
connection_result = APIService.test_api_connection(api_config.id)

# Sync products
sync_result = APIService.sync_products_from_api(api_config.id)

# Process payment
payment_result = APIService.process_payment(
    api_id=api_config.id,
    store_product_id=1,
    user_data={'email': 'user@example.com'},
    internal_tx_id=123,
    user_inputs={'رقم الهاتف': '0912345678'}
)
Troubleshooting
Common Issues
Purchase returns 400 error

Check that fields is a dictionary, not an array

Verify field names match exactly from product data

Products not syncing

Check API key permissions

Verify base URL is correct

Authentication failures

Ensure Bearer token is correctly formatted

Verify User-Agent header is included

Logging
All API calls are logged in APITransaction model with:

Request payload

Response payload

Success status

Error messages

Timestamps

Security Notes
API keys are encrypted in database

All requests use HTTPS

User inputs are validated before sending to API

No sensitive data is logged in plain text

text

## Additional Files to Create:

### 1. Create the docs directory structure:
```bash
mkdir -p third_party_apis/docs
2. Update your .gitignore to include any sensitive documentation if needed.
3. Consider creating a quick reference file:
third_party_apis/docs/quick_reference.md

markdown
# Quick Reference - Alaaeddin API

## Purchase Format (CORRECT)
```json
{
  "product_id": 1,
  "quantity": 1,
  "fields": {
    "field_name": "field_value"
  }
}
Key Endpoints
Balance: GET /api/user/balance

Products: GET /api/products

Purchase: POST /api/purchase

Order Status: GET /api/order/status/{id}

Required Headers
Authorization: Bearer {API_KEY}

User-Agent: Mozilla/5.0 (compatible; StarkCardApp/1.0)