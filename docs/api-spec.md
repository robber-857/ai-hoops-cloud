# API Spec Draft

Base path: `/api/v1`

## Status

This document reflects the current local training-camp main flow as of 2026-04-30.

The API no longer only covers auth. Uploads, reports, personal center aggregation, and training templates are now part of the active backend surface.

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
