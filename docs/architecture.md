# AI Hoops Cloud Architecture

## Current direction

- `web/` keeps the existing Next.js application and pose analysis UI.
- `server/` is the new Python backend service built with FastAPI.
- PostgreSQL is the system of record for users, verification codes, uploads, and reports.
- S3-compatible object storage is responsible for raw video objects.

## Backend layering

- `app/api`: HTTP entrypoints, request parsing, status code mapping, and dependency injection.
- `app/services`: business workflows such as registration, login, reset password, upload signing, and report persistence.
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
