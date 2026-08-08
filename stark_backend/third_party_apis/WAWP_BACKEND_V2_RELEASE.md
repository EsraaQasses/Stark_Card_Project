# WAWP Backend V2 release

## Status

WAWP Phase 1 backend integration is ready for `backend-v2`. It provides admin configuration and test messaging only. It does not connect WAWP to login, password reset, or OTP.

## Capabilities

- WAWP provider configuration with encrypted access-token storage.
- Safe serializer responses with `has_access_token`; the token is write-only.
- One active WAWP configuration enforced by a database constraint.
- Admin-only create, update, delete, activate, deactivate, connection-test, and test-message operations.
- Manual international phone testing and authoritative Stark-user phone testing.
- Phone normalization, message validation, timeout handling, stable provider error codes, audit events, and tests.

## Endpoints

- `GET/POST/PATCH/DELETE /api/third_party_apis/wawp/config/`
- `POST /api/third_party_apis/wawp/activate/`
- `POST /api/third_party_apis/wawp/deactivate/`
- `POST /api/third_party_apis/wawp/test-connection/`
- `POST /api/third_party_apis/wawp/test-message/`

## Security

The access token is encrypted with the existing Fernet helper and is not serialized, audited, or logged. Provider response bodies are not returned to clients. The WAWP v2 API currently receives `instance_id` and `access_token` in the outgoing query string; production infrastructure must redact URLs in proxy logs, tracing/APM, debug logs, and exception monitoring. `instance_id` is stored as a provider identifier; it is not the secret token.

## Verification

WAWP-specific PostgreSQL tests: 13 discovered, 13 passed, 0 skipped, 0 failed, 0 errors. Coverage includes permissions, encryption/redaction, connection states, normalized provider errors, phone formatting, message validation, and selected-user delivery.

## Frontend status

Admin frontend: backend contract ready; configuration/testing UI remains to be implemented using [WAWP_FRONTEND_HANDOFF.md](WAWP_FRONTEND_HANDOFF.md).

Mobile frontend: no Phase 1 changes required. Mobile must not call WAWP or handle credentials. Future OTP delivery integration is not included.

## Production configuration required

Production still requires a real WAWP instance ID, real access token, activation, connection verification, and one real test message. Confirm reverse-proxy and observability redaction before entering credentials.

## Follow-up

The next separate phase is backend-controlled Email + Phone/WhatsApp OTP delivery. Do not implement it as part of this release.
