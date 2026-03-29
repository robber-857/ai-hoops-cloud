# API Spec Draft

Base path: `/api/v1`

## Auth

- `POST /auth/register/send-code`
- `POST /auth/register`
- `POST /auth/login/password-code`
- `POST /auth/login/phone/send-code`
- `POST /auth/login/email/send-code`
- `POST /auth/password/send-reset-code`
- `POST /auth/password/reset`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Notes

- HTTP status codes follow standard REST semantics instead of wrapping custom `code` fields.
- This first backend scaffold focuses on auth. Uploads and reports should be added next under `app/api/v1/uploads.py` and `app/api/v1/reports.py`.
