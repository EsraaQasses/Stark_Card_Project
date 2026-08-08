# WAWP frontend handoff

This is the contract for the Stark Admin frontend. WAWP Phase 1 is backend-only configuration and test messaging. It is not connected to login, password reset, or OTP delivery. The mobile app must not configure WAWP or call WAWP directly.

## Shared rules

All endpoints below are admin-only and use the existing Stark admin authentication. Send `Authorization: Bearer <access-token>`. Never display, cache, log, or send the saved WAWP access token anywhere except the protected create/patch request. Disable duplicate actions while a request is pending. Never render raw provider response bodies.

The backend stores the WAWP access token encrypted and returns only `has_access_token`. `instance_id` is a provider identifier and is returned by the configuration serializer; it is not the access token. WAWP requests include credentials in the provider query string because that is the WAWP v2 contract, so production reverse-proxy, tracing, APM, and HTTP debug logging must redact query parameters.

## Admin endpoints

### Configuration

`GET /api/third_party_apis/wawp/config/`

Returns `null` when no configuration exists, otherwise:

```json
{
  "id": 1,
  "instance_id": "provider-instance-id",
  "is_active": false,
  "has_access_token": true,
  "created_at": "2026-08-08T15:00:00Z",
  "updated_at": "2026-08-08T15:00:00Z"
}
```

The access token is never returned.

`POST /api/third_party_apis/wawp/config/`

Request fields:

```json
{"instance_id":"provider-instance-id","access_token":"new-secret"}
```

Both fields are required for creation. Success is `201` with the safe response above.

`PATCH /api/third_party_apis/wawp/config/` accepts `instance_id` and/or `access_token`. Omitting `access_token` preserves the existing encrypted token. Supplying a non-empty token replaces it. The response never contains the token.

`DELETE /api/third_party_apis/wawp/config/` returns `204`. This removes only Stark’s local configuration; it does not delete the remote WAWP instance.

Common errors: `WAWP_ALREADY_CONFIGURED` (`409`), `WAWP_NOT_CONFIGURED` (`404`), serializer validation (`400`), and `403` for non-admin users.

### Activation

`POST /api/third_party_apis/wawp/activate/` and `POST /api/third_party_apis/wawp/deactivate/` take no body. Success returns `{success, is_active}`. Activation requires a local configuration. A second active WAWP configuration returns `WAWP_ALREADY_ACTIVE` (`409`); missing configuration returns `WAWP_NOT_CONFIGURED` (`404`).

### Connection test

`POST /api/third_party_apis/wawp/test-connection/` takes no body. A connected session returns `{success:true,status:"connected"}`. A provider session that is not working returns HTTP `502` with `WAWP_SESSION_DISCONNECTED`.

Other normalized codes include `WAWP_NOT_CONFIGURED`, `WAWP_INVALID_CONFIGURATION`, `WAWP_INVALID_CREDENTIALS`, `WAWP_SESSION_NOT_FOUND`, `WAWP_RATE_LIMITED`, `WAWP_TIMEOUT`, `WAWP_CONNECTION_ERROR`, `WAWP_MALFORMED_RESPONSE`, `WAWP_BAD_REQUEST`, and `WAWP_PROVIDER_ERROR`.

### Test message

`POST /api/third_party_apis/wawp/test-message/` accepts exactly one recipient and a message.

Manual phone:

```json
{"phone":"+963912345678","message":"Test message from Stark Card"}
```

Selected Stark user:

```json
{"user_id":123,"message":"Test message from Stark Card"}
```

The backend resolves `User.phone` for `user_id`; the frontend must not submit a second phone value. Success returns `{success:true,status:"accepted",message_id}`. Phone numbers accept international `+` format and common separators; `00` is converted to `+`. The normalized provider chat ID is not a frontend concern.

Validation/errors include exactly-one-recipient, `WAWP_INVALID_PHONE`, selected user without a phone, `WAWP_INVALID_MESSAGE`, `WAWP_MESSAGE_TOO_LONG`, inactive/missing configuration, disconnected session, timeout, connection, rate-limit, and provider errors.

## Admin UI states

Provide loading, saved, unsaved-secret, active/inactive, connected/disconnected/unknown, validation, permission, conflict, timeout, and retry states. Confirm deletion, activation, deactivation, and test-message sending. Keep the access-token field blank on edit and label entered token as “replace access token,” never “current token.”

Recommended sections: WAWP Settings, connection status, Instance ID, replace access token, Save, Activate, Deactivate, Test Connection, Delete Configuration, and Test Message with Manual Phone/Stark User modes.

## Mobile frontend

No mobile UI or API changes are required in this phase. Mobile must not store WAWP credentials, call `/api/third_party_apis/wawp/*`, or know the WAWP token. Email/phone/WhatsApp OTP selection is a future phase; Stark will own OTP generation, expiry, verification, throttling, replay protection, and auditing.

## Test scenarios

Test admin permission denial, safe configuration response, create/update token replacement, omitted-token preservation, activation conflict, connection success/disconnect/timeout, invalid phone, user without phone, empty/long message, provider errors, duplicate-click prevention, redaction, and mobile non-use of WAWP endpoints.
