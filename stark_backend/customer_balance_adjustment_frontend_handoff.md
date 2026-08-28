# customer_balance_adjustment

## Operation

Admin immediately changes a customer's wallet balance. The frontend confirmation dialog is the safety step; there is no backend approval workflow.

## Request

`POST /api/users/admin/customers/{customer_id}/balance-adjustments/`

```json
{
  "amount": "50.00",
  "currency": "USD",
  "reason": "Manual balance recharge by administrator",
  "idempotency_key": "7fe26f45-cbb4-4cd5-b30c-123456789abc"
}
```

## Frontend Flow

1. Admin fills in the amount, currency, and reason.
2. Frontend generates a new UUID `idempotency_key` for each new adjustment.
3. Frontend displays a confirmation dialog.
4. On **Yes**, frontend sends the POST request.
5. Disable the submit control while the request is in progress.
6. On success, refresh the customer's wallet and show the approved result.

Do not call the adjustment decision endpoint after this request. The balance is already changed when this request succeeds.

## Success Response

HTTP `200 OK` for a new adjustment or an idempotent retry:

```json
{
  "id": 15,
  "status": "approved",
  "amount": "50.00",
  "currency": "USD",
  "idempotency_key": "7fe26f45-cbb4-4cd5-b30c-123456789abc",
  "transaction_id": 42
}
```

The amount is reflected in the customer's `available_balance`. Positive amounts add funds; negative amounts subtract funds and require sufficient available funds.

## Idempotency

Reuse the same key when retrying the same request after a timeout. The backend returns the existing adjustment and does not change the balance twice. Generate a new UUID for a new adjustment. Reusing a key with different amount, currency, or reason returns an error.

## Errors

- `400 ADJUSTMENT_INVALID`: invalid amount, currency, reason, or insufficient funds.
- `403 CUSTOMER_ADMIN_FORBIDDEN`: authenticated user is not an administrator.
- `404 TARGET_NOT_FOUND`: customer or wallet does not exist.

## Important Status Behavior

A successful response always has `status: "approved"`. The frontend should not display or wait for a `pending` state for this operation.
