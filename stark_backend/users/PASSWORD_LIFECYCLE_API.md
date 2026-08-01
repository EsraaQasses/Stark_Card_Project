# Password lifecycle API

The replacement flow is available under `/api/users/`. All reset request/resend responses are account-enumeration safe and use the bilingual `{code, message: {en, ar}}` structure.

| Method | Endpoint | Auth | Success |
|---|---|---|---|
| POST | `/password-reset/request/` | Public | `PASSWORD_RESET_REQUEST_ACCEPTED`, opaque `request_id`, `expires_in=600`, `resend_after=60` |
| POST | `/password-reset/verify/` | Public | `PASSWORD_RESET_CODE_VERIFIED`, short-lived single-use `reset_token` |
| POST | `/password-reset/resend/` | Public | New opaque request metadata; 60-second cooldown |
| POST | `/password-reset/confirm/` | Public | `PASSWORD_RESET_COMPLETED`; refresh tokens and server sessions are revoked |
| POST | `/password-change/` | Authenticated | `PASSWORD_CHANGE_COMPLETED`; refresh tokens and server sessions are revoked |
| POST | `/admin/users/{user_id}/password-reset/send/` | Admin + hierarchy | Starts the normal email-code flow; no secret returned |

Request bodies:

- request: `{ "email": "user@example.com" }`
- verify: `{ "request_id": "opaque-id", "code": "123456" }`
- resend: `{ "request_id": "opaque-id" }`
- confirm: `{ "reset_token": "opaque-token", "new_password": "Example-password-9!", "confirm_password": "Example-password-9!" }`
- authenticated change: `{ "current_password": "Current-password-9!", "new_password": "New-password-9!", "confirm_password": "New-password-9!" }`
- admin email reset: `{ "reason": "User requested account recovery through support." }`

Policy defaults are configurable: six ASCII digits, ten-minute code and reset-authorization expiry, five failed attempts, 60-second resend cooldown, five requests/hour, ten requests/day, and a single active challenge per user/purpose. OTPs and reset authorizations are stored only as hashes. Verification locks the challenge atomically; authorization and password consumption use row locks and a transaction.

Errors include `PASSWORD_RESET_CODE_INVALID`, `PASSWORD_RESET_CODE_EXPIRED`, `PASSWORD_RESET_CODE_TOO_MANY_ATTEMPTS`, `PASSWORD_RESET_RESEND_COOLDOWN`, `PASSWORD_RESET_TOKEN_INVALID`, `PASSWORD_RESET_PASSWORD_MISMATCH`, `PASSWORD_RESET_PASSWORD_POLICY`, `PASSWORD_RESET_OLD_PASSWORD_REUSE`, `PASSWORD_CHANGE_CURRENT_INVALID`, `PASSWORD_RESET_ROLE_HIERARCHY`, and `PASSWORD_RESET_REASON_REQUIRED`.

The supported admin reset operation sends the normal secure reset email. Temporary-password generation is intentionally not supported in this release. The old `forgot-password/`, `reset-password/`, `forgot-password-code/`, `reset-password-code/`, and `change-password/` routes are disabled/deprecated; migrate clients to the replacement flow.

## Authentication invalidation

Every newly issued access and refresh token contains the user's non-negative `auth_version`. JWT authentication and refresh reject missing, malformed, or stale versions. Password reset completion and authenticated password change increment the version atomically, blacklist outstanding refresh tokens where supported, and invalidate custom login sessions. Clients must clear local authentication state and sign in again after a successful password operation. Django session invalidation is attempted for the affected user; deployments using Django sessions should verify their session backend during rollout.
