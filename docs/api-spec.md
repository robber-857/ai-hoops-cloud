# API Guide

Base path: `/api/v1`

## Status

See the locally served FastAPI OpenAPI schema for complete request and response fields. The product rules and acceptance scenarios for the student workspace are documented in the [current PRD](student-workspace-prd.md).

## Class invitations and videos

| Route | Access and behavior |
| --- | --- |
| `POST /class-invitations/preview` | An invitation token reveals the class name and link validity. |
| `POST /class-invitations/apply` | An authenticated player submits an application for coach review. |
| `GET/POST/DELETE /coach/classes/{class_public_id}/invitation` | Scoped coach or admin checks, issues or revokes the active link. A new raw token is returned at issuance. |
| `GET /coach/classes/{class_public_id}/join-requests` | Scoped coach or admin reads applications. |
| `PATCH /coach/classes/{class_public_id}/join-requests/{request_public_id}` | Approve or decline an application. Membership and decision notification are updated transactionally. |
| `GET/POST /coach/classes/{class_public_id}/videos` | Scoped list and upload. The upload has a title query parameter and an MP4 or WebM body. |
| `DELETE /coach/classes/{class_public_id}/videos/{video_public_id}` | Scoped soft archive. |
| `GET /me/class-videos` | Lists videos available to the authenticated player. |
| `GET /class-videos/{video_public_id}/playback` | Returns a short-lived signed URL after a fresh access check. |

## Coach feedback and AI

- `GET /reports/{report_public_id}/feedback` returns the private thread and `can_write`.
- `POST /reports/{report_public_id}/feedback` accepts `body` and UUID `request_id`, creates the comment and notification atomically, and returns the original item on retries with the same ID and body.
- `GET /me/notifications` and mark-read responses can contain `report_public_id` for direct navigation from feedback notifications.
- `POST /me/assistant` accepts alternating `user` and `assistant` messages ending with a question, up to nine messages. It returns an answer and zero to three trusted recommendation links. Authenticated student or legacy player accounts only.
- `POST /admin/users` and `PATCH /admin/users/{user_public_id}` require a system administrator to assign or revoke `admin`. Existing admins retain ordinary operations.

## Auth

- `POST /auth/register/email/send-code`
- `POST /auth/register`
- `POST /auth/login/password`
- `POST /auth/login/password-code`
- `POST /auth/login/phone`
- `POST /auth/login/email/send-code`
- `POST /auth/login/email`
- `POST /auth/password/send-reset-code`
- `POST /auth/password/reset`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Uploads

- `POST /uploads/init`
- `POST /uploads/complete`

Current upload strategy:

- Backend creates `training_session` and `upload_task`
- Backend returns `bucket_name` and `object_key`
- Frontend uploads the raw video object to Supabase Storage
- Frontend calls `uploads/complete`
- Backend records `video`, updates `upload_task`, and marks the `training_session` as uploaded

Current limitation:

- Backend does not yet sign Supabase upload URLs
- Frontend still uses the Supabase Storage client for the raw object upload

## Reports

- `POST /reports`
- `GET /reports/mine`
- `GET /reports/{report_public_id}`

Current report strategy:

- Frontend performs local analysis and scoring
- Frontend submits `score_data`, `timeline_data`, `summary_data`, `overall_score`, `grade`, and `session_public_id`
- Backend writes `analysis_reports`
- Backend writes `report_snapshots`
- Backend updates training session status
- Backend writes related notifications and growth/achievement records where applicable
- Saving another report payload for the same `session_public_id` updates the existing report instead of creating a duplicate report
- The report page can recalculate scores for a selected template and save that selected template score back to the same report

## Personal Center

- `GET /me/dashboard`
- `GET /me/reports`
- `GET /me/training-sessions`
- `GET /me/tasks`
- `GET /me/achievements`
- `GET /me/trends`

Current frontend usage:

- `/me` uses these backend aggregation endpoints instead of directly querying Supabase report tables.

## Training Templates

- `GET /training-templates`
- `GET /training-templates/{template_code}`

## Coach

- `GET /coach/classes`
- `GET /coach/classes/{class_public_id}/students`
- `GET /coach/classes/{class_public_id}/reports`
- `POST /coach/classes/{class_public_id}/tasks`
- `POST /coach/classes/{class_public_id}/announcements`

Current coach API strategy:

- `coach` users can access classes where they are an active class coach member
- `admin` users can access classes globally
- Task publishing creates one assignment for each active student member in the class
- Class reports reuse the existing class ownership model used by report detail access

## Notes

- HTTP status codes follow standard REST semantics instead of wrapping custom `code` fields.
- PostgreSQL is the business system of record for training sessions, upload metadata, reports, and personal center data.
- Supabase Storage is still the current raw video object storage.
- Admin APIs are planned but not implemented yet.
