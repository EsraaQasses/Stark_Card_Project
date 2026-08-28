# Notification System Frontend Handoff

## Purpose

Notifications are created by backend business operations and delivered to one authenticated user. The frontend reads notifications, renders the backend icon key with its own icon library, and controls read state.

## Notification Object

```json
{
  "id": 15,
  "type": "transfer_received",
  "title": "Transfer received",
  "message": "You received 50 USD from Ahmed.",
  "details": {
    "transaction_id": 42,
    "sender_id": 7,
    "amount": "50.00",
    "currency": "USD"
  },
  "icon": "arrow-down-left",
  "created_at": "2026-08-28T10:30:00Z",
  "is_read": false
}
```

`created_at` is the server timestamp. `is_read: false` means the notification is unread/new. After the user opens or acknowledges it, mark it read through the API.

## Icon Contract

`icon` is a string key, never an image URL and never an uploaded image. The frontend maps the key to an icon from its installed library.

Recommended mapping examples:

| Backend key | Suggested icon |
|---|---|
| `arrow-down-left` | incoming transfer |
| `arrow-up-right` | outgoing transfer |
| `check-circle` | approved/success |
| `x-circle` | rejected/failed |
| `clock` | processing/pending |
| `inbox` | new request |
| empty or unknown | generic notification |

Unknown keys must use the generic fallback icon so a new backend notification cannot break rendering.

## Notification Types

The backend supports free-form type keys. Current typed examples include:

- `transfer_received`
- `transfer_sent`

Older notifications may have `type: "general"`. The frontend should render their title and message normally.

`details` is structured operation data. Use it for navigation and display, not for the human-readable fallback message. Values such as amounts are strings to preserve decimal precision.

## Endpoints

### List notifications

`GET /api/system/notifications/`

Authenticated users receive only their own notifications. The response is paginated:

```json
{
  "count": 25,
  "next": "...",
  "previous": null,
  "results": []
}
```

Optional query parameters:

- `page=1`
- `page_size=20` if supported by the deployed pagination settings

### Read one notification

`PATCH /api/system/notifications/{id}/`

Only `is_read` is mutable:

```json
{
  "is_read": true
}
```

Title, message, type, details, icon, and timestamps are backend-controlled.

### Unread count

`GET /api/system/notifications/unread-count/`

Response:

```json
{
  "unread": 4
}
```

### Mark all read

`POST /api/system/notifications/mark-all-read/`

Response:

```json
{
  "updated": 4
}
```

### Unsupported operations

The frontend must not create or delete notifications. These operations return `405 Method Not Allowed`:

- `POST /api/system/notifications/`
- `DELETE /api/system/notifications/{id}/`

## Suggested Frontend Behavior

1. Fetch the first notification page and unread count after login.
2. Display unread items using `is_read === false`.
3. Render `icon` through a whitelist/map from backend keys to frontend library icons.
4. Format `created_at` in the user’s local timezone.
5. When a notification is opened, send `PATCH {"is_read": true}`.
6. Use `details.transaction_id`, request IDs, or other operation IDs for navigation when present.
7. Refresh or invalidate the list and unread-count cache after marking read.
8. Treat missing `details`, empty `icon`, and unknown `type` as valid fallback cases.

## Delivery Guarantees

Notification delivery is best effort. A completed financial operation must not be reported as failed just because notification persistence failed. The frontend should trust the operation response/status and use notifications as an additional user-facing signal.

For transfers, the receiver notification contains the receiver transaction ID, sender ID, amount, and currency. The receiver’s transaction history also exposes the sender name separately.

## Security

The API filters every list/retrieve/update query by the authenticated recipient. A user cannot read or mark another user’s notification. Notification content is backend-controlled; do not expose a client-side notification creation form.