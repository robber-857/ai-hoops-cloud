# AI Hoops Cloud Architecture

## Current direction

- `web/` keeps the existing Next.js application and pose analysis UI.
- `server/` is the FastAPI backend. PostgreSQL is the system of record for accounts, class memberships and invitations, lessons, player measurements, upload metadata, reports, feedback and notifications.
- Analysis videos use the existing Supabase client upload with backend-issued object metadata. Class videos use a separate private bucket. The API handles class-video upload and signs playback only after an authenticated class authorization check.
- The student, coach and admin workspaces share authentication, route guards and a browser-level theme preference. The API enforces resource and role permissions, including system-administrator-only Admin assignment.
- Repeated original report saves are keyed by training session. Age comparisons create separate report snapshots and are excluded from normal training totals. Coach feedback is stored alongside the report in a separate table.
- AI Coach selects the authenticated player's context server-side and sends a bounded summary to the configured model. Recommendations resolve to application routes; the model has no application permissions or state-changing tools.

## Backend layering

- `app/api`: HTTP entrypoints, request parsing, status code mapping, and dependency injection.
- `app/services`: business workflows such as registration, login, reset password, upload metadata orchestration, report persistence, personal-center aggregation, and template lookup.
- `app/models`: SQLAlchemy ORM models.
- `app/schemas`: Pydantic request and response schemas.
- `app/core`: configuration, database wiring, auth helpers, logging, and infrastructure clients.

## Status code policy

- `200`: request succeeded
- `201`: resource created
- `204`: resource deleted or logout with no body
- `400`: bad request
- `401`: unauthenticated
- `403`: forbidden
- `404`: resource not found
- `409`: conflict
- `422`: validation failed
- `500`: server error
