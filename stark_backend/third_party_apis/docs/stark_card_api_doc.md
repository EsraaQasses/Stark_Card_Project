# Stark-Card API Integration Documentation

## Overview
This document describes the integration with Stark-Card API for payment processing and digital purchases (PUBG UC, gaming items, etc.).

## Base Information
- **Base URL**: `https://api.stark-card.com/`
- **Authentication**: API Token Header
- **Required Header**: `api-token: `

---

## API Endpoints

### 1. Profile
**Endpoint**: `GET /client/api/profile`

**Description**: Retrieves the user's balance and profile information.

**Headers**:
```
api-token:
Content-Type: application/json
```

**Response Example**:
```json
{
    "balance": "8788.683",
    "email": "user@email.com",
    "towFactor": true
}
```

**Status Codes**:
- `200`: Success
- `120`: API Token is required
- `121`: Token error
- `122`: Not allowed to use API
- `123`: IP not allowed
- `130`: The site is under maintenance

---

### 2. Products

#### Get All Products
**Endpoint**: `GET /client/api/products`

**Description**: Retrieves all available products.

**Response Example**:
```json
[
    {
        "id": 365,
        "name": "UC 60",
        "price": 0.104,
        "params": ["ادخل الايدي الاعب"],
        "category_name": "UC 60",
        "available": true,
        "qty_values": {
            "min": 1,
            "max": "15000"
        },
        "product_type": "amount",
        "parent_id": 0,
        "base_price": 0.10,
        "category_img": ""
    },
    {
        "id": 18,
        "name": "UC 60",
        "price": 1.094,
        "params": ["ادخل الايدي الاعب"],
        "category_name": "PUBG Global ID UC",
        "available": true,
        "qty_values": null,
        "product_type": "package",
        "parent_id": 7,
        "base_price": 0.877,
        "category_img": "images/category/1710948113.webp"
    }
]
```

#### Filter Products by IDs
**Endpoint**: `GET /client/api/products?products_id=id1,id2,id3`

**Description**: Retrieves specific products by their IDs.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| products_id | string | Comma-separated product IDs |

#### Get Minimal Product Data
**Endpoint**: `GET /client/api/products?base=1`

**Description**: Retrieves only product IDs and names (minimal data for faster loading).

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| base | boolean | Set to 1 for minimal data |

#### Quantity Values Reference
The `qty_values` field determines allowed quantities:

| qty_values | Meaning | Example |
|-----------|---------|---------|
| `null` | Quantity in order must be 1 | Must order exactly 1 unit |
| `["110", "150", "210"]` | Only these specific quantities allowed | Can order 110, 150, or 210 units |
| `{"min": "500", "max": "500000"}` | Quantity must be within this range | Can order any value between min and max |

---

### 3. Content (Categories)

#### Get Home Page Content
**Endpoint**: `GET /client/api/content/0`

**Description**: Retrieves products and categories for the home page (parent ID = 0).

#### Get Content for Specific Category
**Endpoint**: `GET /client/api/content/[category.id]`

**Description**: Replace `[category.id]` with the desired category ID to retrieve its products and subcategories.

**Example**: `GET /client/api/content/7` (retrieves PUBG products)

---

### 4. Create Order

**Endpoint**: `GET /client/api/newOrder/[product_id]/params?qty=[quantity]&order_uuid=[uuid]&[additional_params]`

**Method**: `GET` (not POST)

**Description**: Creates a new order for a product with idempotency support via `order_uuid`.

**Important: Idempotent Requests with order_uuid**
- The `order_uuid` parameter is **required** and serves as a unique identifier
- When you send a request with the same `order_uuid` more than once:
  - The system will **NOT create a duplicate order**
  - It will return the **original order data** instead
  - This prevents duplicate charges and ensures order idempotency
- Always generate a **new UUIDv4** for each unique order attempt

**URL Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_id | integer | Yes | Product ID (replace in URL path) |
| qty | integer | Yes | Quantity of product |
| order_uuid | string (UUID) | Yes | Unique UUIDv4 identifier |
| [additional] | string | Depends | User-provided data (e.g., phone number, player ID) |

**Example Request**:
```
GET /client/api/newOrder/364/params?qty=1&playerId=test123&رقم_الهاتف=0982416135&order_uuid=ecbdd545-e616-4aee-8770-7eefa977bcd
```

**Response Example (Success)**:
```json
{
    "status": "OK",
    "data": {
        "order_id": "ID_9fffb0d849a45215",
        "status": "accept",
        "price": 1.26048,
        "data": {
            "playerId": "test123"
        },
        "replay_api": [
            {
                "replay": ["erg3eg"]
            }
        ]
    }
}
```

**Order Status Values**:
- `accept` - Order accepted and completed
- `reject` - Order rejected (insufficient balance, product not available, etc.)
- `wait` - Order is pending (in progress, waiting for provider)

**Error Response (Product Not Available)**:
```json
{
    "status": "ERROR",
    "msg": {
        "status": "not_available"
    },
    "code": 110
}
```

---

### 5. Check Order Status

#### Check by Order ID
**Endpoint**: `GET /client/api/check?orders=[ID_a37aaa06,ID2,ID3]`

**Description**: Checks the status of one or multiple orders by their order IDs.

#### Check by Order UUID
**Endpoint**: `GET /client/api/check?orders=[yourOrderUUID]&uuid=1`

**Description**: Checks order status by UUID instead of order ID.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| orders | string | Comma-separated order IDs or UUIDs in brackets |
| uuid | integer | Set to 1 to use UUIDs instead of order IDs (optional) |

**Response Example**:
```json
{
    "status": "OK",
    "data": [
        {
            "order_id": "ID_9fffb0d849a45215",
            "quantity": 1,
            "data": {
                "playerId": "test"
            },
            "created_at": "2025-04-10 13:55:48",
            "product_name": "A-60UC-stock",
            "price": "1.2604800000000000",
            "status": "accept",
            "replay_api": ["erg3eg"]
        }
    ]
}
```

**Order Status Values**:
- `accept` - Order completed successfully
- `reject` - Order failed
- `wait` - Order still processing

---

## Error Codes

### Public Error Codes
| Code | Message | Description |
|------|---------|-------------|
| 120 | Api Token is required! | Missing api-token header |
| 121 | Token error | Invalid or expired token |
| 122 | Not allowed to use API | Account restricted from API usage |
| 123 | IP not allowed | Your IP address is not whitelisted |
| 130 | The site is under maintenance | API temporarily unavailable |

### Order Error Codes
| Code | Message | Description |
|------|---------|-------------|
| 100 | Insufficient balance | Account balance too low for order |
| 105 | Quantity not available | Requested quantity exceeds stock |
| 106 | Quantity not allowed | Quantity not in allowed values list |
| 107 | Player ID blocked | Player account is blocked by provider |
| 108 | 2FA required | Two-factor authentication required |
| 109 | Product deleted or not found | Product ID doesn't exist or was deleted |
| 110 | Product not available now | Product temporarily unavailable |
| 111 | Try again after 1 minute | Rate limit exceeded, retry after 1 minute |
| 112 | Quantity is too small | Quantity below minimum |
| 113 | Quantity is too large | Quantity above maximum |
| 114 | Unknown error | Unspecified server error |
| 500 | Unknown error | Server error |

---

## Integration Examples

### Python - Using Django and ConnectorFactory

```python
from third_party_apis.models import ThirdPartyAPI
from third_party_apis.utils.connectors import ConnectorFactory

# Get Stark-Card API configuration
api_config = ThirdPartyAPI.objects.get(provider='stark-card', is_active=True)

# Create connector
connector = ConnectorFactory.get_connector(api_config)

# 1. Check balance
balance = connector.get_balance()
print(f"Account balance: ${balance['data']['balance']}")

# 2. Get products
products = connector.get_products()
print(f"Available products: {len(products)}")

# 3. Make purchase
purchase_data = {
    'external_id': '365',  # UC 60 product
    'quantity': 1,
    'user_inputs': {
        'ادخل الايدي الاعب': 'test123'  # Player ID
    }
}
result = connector.execute_purchase(purchase_data, user_data={}, transaction_data={})
if result['success']:
    print(f"Order created: {result['data']['order_id']}")
else:
    print(f"Order failed: {result['data']['msg']}")

# 4. Check order status
order_id = result['data']['order_id']
status = connector.check_order_status([order_id])
print(f"Order status: {status['data'][0]['status']}")
```

### Web Request Example

```bash
# 1. Get profile/balance
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
     https://api.stark-card.com/client/api/profile

# 2. Get all products
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
     https://api.stark-card.com/client/api/products

# 3. Create order (PUBG UC 60)
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
     "https://api.stark-card.com/client/api/newOrder/365/params?qty=1&playerId=test123&order_uuid=ecbdd545-e616-4aee-8770-7eefa977bcd"

# 4. Check order status
curl -H "Authorization: Bearer <YOUR_TOKEN>" \
     "https://api.stark-card.com/client/api/check?orders=[ID_9fffb0d849a45215]"
```

---

## Common Workflows

### Complete Payment Flow

1. **Get Products** → Show available items to user
2. **User Selects Product** → User chooses item and quantity
3. **Validate Quantity** → Check qty_values rules
4. **Get Current Balance** → Verify sufficient funds
5. **Create Order** → Send purchase request with order_uuid
6. **Check Status** → Poll order status endpoint
7. **Complete Transaction** → Update internal transaction record

### Handling Errors

- **Code 110 (Not Available)** → Product temporarily unavailable, retry after 1 minute
- **Code 111 (Rate Limited)** → Wait 1 minute before retry
- **Code 100 (Insufficient Balance)** → Ask user to add funds
- **Code 106 (Quantity Not Allowed)** → Show allowed quantities from qty_values
- **Code 107 (Player Blocked)** → Contact support

---

## Testing with Stark-Card Test Token

The integration has been tested with a real provider token during internal validation.

### Test Results

✅ **Connection**: Profile endpoint responsive  
✅ **Authentication**: Token accepted  
✅ **Products**: 428+ products available  
✅ **Balance**: Account balance retrieved  
✅ **Order Requests**: Orders accepted and processed  

---

## Notes for Development

- Always use UUIDv4 for `order_uuid` to ensure uniqueness
- Implement retry logic for codes 111 (rate limit)
- Cache product list locally and refresh periodically
- Store order IDs and UUIDs for status checks
- Handle both `order_id` (for status checks) and `order_uuid` (for idempotency)
- The `replay_api` field contains provider responses (may be null or array)

---

## Support & Contact

For issues or questions about Stark-Card API:
- Base URL: https://api.stark-card.com/
- Refer to error codes section for debugging
- Check product availability status before ordering
- Verify account balance and API token validity
