# 2026-05-02 Architecture Update

- The first coach portal frontend is now implemented in `web/src/app/coach/*`.
- The coach portal uses `web/src/services/coach.ts` to call the existing `/api/v1/coach/*` backend surface.
- Coach UI components live under `web/src/components/coach/*`.
- The coach portal is protected by the existing auth bootstrap and route protection flow.
- The coach shell includes a client-side 3D Canvas background powered by React Three Fiber / Drei, plus Framer Motion transitions for navigation and tab state.
- Current coach frontend scope covers class list, class detail, student list, report list, task publishing, and announcement publishing.
- Remaining coach architecture gaps are task management, announcement management, student profile views, coach dashboard aggregation, and automated E2E coverage against real backend data.

# AI Hoops Cloud Architecture

## Current direction

- `web/` keeps the existing Next.js application and pose analysis UI.
- `server/` is the new Python backend service built with FastAPI.
- PostgreSQL is the system of record for users, verification codes, training sessions, upload metadata, reports, tasks, growth snapshots, and achievements.
- Supabase Storage is the current raw video object store. S3-compatible object storage can still be treated as a future-compatible storage direction.
- The frontend no longer directly reads or writes Supabase report tables. It still uploads raw video objects through the Supabase Storage client using backend-issued bucket and object-key metadata.
- The first backend surface for the coach portal is available under `/api/v1/coach/*`; the coach frontend is the next planned product layer on top of those APIs.
- Report persistence is now session-idempotent: repeated saves for the same training session update the existing report and keep task progress based on unique training sessions.

## Backend layering

- `app/api`: HTTP entrypoints, request parsing, status code mapping, and dependency injection.
- `app/services`: business workflows such as registration, login, reset password, upload metadata orchestration, report persistence, personal-center aggregation, and template lookup.
- `app/repositories`: database access helpers for larger query logic.
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
