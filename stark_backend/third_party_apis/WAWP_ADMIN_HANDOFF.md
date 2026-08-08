# WAWP Phase 1 admin handoff

The repository contains the compiled `stark-admin/build` artifact but no React source or package manifest. The backend contract below is therefore the implementation handoff for the next frontend build; no generated JavaScript was modified.

Use the existing admin JWT client and render a `WhatsApp / WAWP Settings` page with these calls:

| Action | Method and path | Body |
| --- | --- | --- |
| Load config | `GET /api/third_party_apis/wawp/config/` | — |
| Create | `POST /api/third_party_apis/wawp/config/` | `{instance_id, access_token}` |
| Update / replace token | `PATCH /api/third_party_apis/wawp/config/` | Any of `{instance_id, access_token}` |
| Activate | `POST /api/third_party_apis/wawp/activate/` | — |
| Deactivate | `POST /api/third_party_apis/wawp/deactivate/` | — |
| Test connection | `POST /api/third_party_apis/wawp/test-connection/` | — |
| Send test message | `POST /api/third_party_apis/wawp/test-message/` | `{phone, message}` or `{user_id, message}` |
| Remove local config | `DELETE /api/third_party_apis/wawp/config/` | — |

The config response includes `instance_id`, `is_active`, `has_access_token`, timestamps, and never includes the token. The token input must always be blank on edit and must mean “replace the stored token” when supplied.

Connection results are normalized to `connected`/`disconnected`; test-message results are normalized to `accepted` or a stable `error_code`. Do not render raw provider response bodies.

For the existing-user selector, use the existing admin-only `GET /api/users/users-simple/` endpoint and submit only the selected user’s `id`; the server resolves `User.phone` authoritatively.
