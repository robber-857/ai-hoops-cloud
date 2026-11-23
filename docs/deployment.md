# Deployment Guide

## Production targets

- Frontend: Vercel project `ai-hoops-cloud`, repository branch `main`, root directory `web`.
- Public website: `https://apexsportai.com`; Vercel alias: `https://ai-hoops-cloud.vercel.app`.
- API: Render service `ai-hoops-cloud-api` (`srv-d75t2e0gjchc73evv5vg`), root directory `server`.
- Public API base: `https://api.apexsportai.com/api/v1`.
- Database: Render Postgres `dpg-d7redsn7f7vs73ctu88g-a`, database `ai_hoops`.

These targets were checked on 2026-10-05. Recheck live service settings before future releases.

## Environment separation

Frontend local development reads `web/.env.local`. Production reads Vercel Environment Variables. Configure `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; these public variables are compiled into the frontend. Never commit local environment files or service-role credentials.

Backend local development reads only `server/.env` and `server/.env.local`. Production must receive real Render environment variables. `server/.env.production` is ignored by the application and must not be committed; merely adding it as a Secret File does not configure this version.

Required backend settings include:

- `APP_ENV=production`, `DEBUG=false`, `API_V1_PREFIX=/api/v1`.
- `DATABASE_URL` using the `postgresql+psycopg` SQLAlchemy driver; verify the database identity before any migration.
- Existing JWT secrets, algorithm, token expiry settings, and SMTP settings.
- `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`, `SESSION_COOKIE_DOMAIN` empty.
- `CORS_ORIGINS` including the exact website origins `https://apexsportai.com`, `https://www.apexsportai.com`, and `https://ai-hoops-cloud.vercel.app`.
- `UPLOAD_VIDEO_BUCKET=user-videos` and `TEMPLATE_VIDEO_BUCKET=template-videos`, unless the existing project explicitly uses different buckets.
- For class videos, configure backend-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and create the private bucket named by `CLASS_VIDEO_BUCKET` (default `class-videos`). Allow MP4 and WebM up to 50 MB. Keep service credentials out of frontend variables. The analysis-video upload flow still uses its existing bucket.
- For AI Coach, configure backend-only `TRAINING_ASSISTANT_OPENAI_API_KEY`. The default `TRAINING_ASSISTANT_MODEL` is `gpt-6-luna`. The Luna request uses reasoning effort `none` to reserve the 850-token output budget for the answer and its structured fields.
- From `server/`, run `python -m tools.eval_training_assistant` for the offline coaching checks. Run `python -m tools.eval_training_assistant --live` with the service's existing Luna access to check real replies against the same synthetic cases. The live run sends up to five billable requests and does not read student records.

`SESSION_COOKIE_SECUR` is a typo and does not set the Secure flag. `APP_ENV=production` does not automatically change cookie settings.

## Build and startup

Vercel production is triggered by pushing `main`. Prepare the release in a clean worktree, merge the verified development commit, and retain existing production-only homepage changes. Do not deploy a dirty development directory.

For reproducible local validation:

```bash
cd web
npm ci
npx tsc --noEmit --incremental false
npm test
npm run build -- --webpack
```

Vercel uses the project's build settings. Check its actual deployment result rather than assuming a successful local build proves publication.

Render build command: `pip install -r requirements.txt`.

Render start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Keep the whole repository available: template initialization reads sibling `web/src/config/templates`, and runtime reads `server/app/config/*.json`.

## Database and source data

Before changing the database, confirm its identity, `alembic_version`, existing business counts, and available backup. Use Render's internal logical export or existing point-in-time recovery; do not download a production database without explicit export authorization.

For upgrades from `20260503_0003`, verify all users have a nonempty phone or email. Migration `0004` enforces that constraint. Then, from the reviewed release's `server/` directory with the production DSN supplied as an environment variable:

```bash
python -m alembic upgrade head
```

The current head is `20261123_0017`. Migration `0017` adds player-owned AI Coach conversations and their saved turns. Migration `0016` adds report feedback and the `super_admin` role. Migration `0015` adds class invitations, join requests and class videos. Migration `0014` relaxed the profile date constraint so measurements may be taken on the date of birth. Migrate before starting the new backend. Verify the migration revision, tables and authenticated routes in addition to the `/health` liveness check.

After migration, provision the first system administrator from the approved existing active Admin account. With the intended database already configured in the operator's shell, run this from `server/`:

```bash
python -m tools.provision_system_admin --user-id <admin-public-uuid>
```

The command records an audit entry and can be rerun for the same account. The system administrator can then manage Admin roles through Users.

AFCD import is a separate deployment step. In the importing Python environment install `requirements-data.txt`, fetch the pinned official files, and review a preview before committing:

```bash
python -m pip install -r requirements-data.txt
python -m tools.fetch_training_food_sources
python -m app.import_afcd --source-dir ../tmp/afcd-release-3
```

The preview must contain 1,588 foods, basis `per_100g_edible_portion`, and fingerprint:

`26922a4c7b33d94d1937b9e66c8660a9322bcad72664f2da150856faa271955c`.

Supply the intended DSN as `AFCD_IMPORT_DATABASE_URL`, then run:

```bash
python -m app.import_afcd --source-dir ../tmp/afcd-release-3 --commit --expect-fingerprint 26922a4c7b33d94d1937b9e66c8660a9322bcad72664f2da150856faa271955c
```

This tool refuses source conflicts and verifies repeated imports without overwriting history. Do not use development-only `tools.import_training_foods` or demo seed scripts against production. Openpyxl is needed for import, not for serving food requests.

Publish the five missing Training `v2` defaults and the specific front narrow crossover Dribbling `v2` through the [targeted administrator sync](student-workspace-development.md#发布与核对动作模板). Use the preview and its matching token for each mode. Published historical versions remain available to saved reports.

## Release order and acceptance

1. Inspect current targets, commits, environment names, and database identity. Record a provider-side backup and pre-release counts.
2. Prepare a clean release; complete appropriate source tests, type checks, production build, and dependency checks.
3. Migrate the production database and provision the approved system administrator. Import official AFCD data if the environment still needs it.
4. Deploy the exact release commit to Render. Verify the live commit, schema, authenticated endpoints, and CORS.
5. Push the verified release to `main` and wait for Vercel's Production deployment to succeed for that exact commit.
6. Coordinate the targeted Training and Dribbling template publication with the frontend release. Check all 17 templates, an older saved report, and the [student workspace acceptance cases](student-workspace-development.md#验收用例).
7. Use an approved test class and test player for real email registration, private upload, signed playback, coach feedback and AI smoke testing. Check the existing food and profile flows.

The food endpoint `/api/v1/training-foods?limit=100` must return ready, 28 selected entries, zero missing foods, and the official fingerprint. `/api/v1/exercise-activities` must expose the expected nine activities and versioned estimation rules.

Browser upload uses Supabase Storage with the public anon key and the existing bucket policy. Verify actual storage upload, signed playback, and API completion; synthetic API tests do not establish storage or MediaPipe inference readiness. Existing reports must still reopen with their saved snapshots.

Rollback applications to a previously verified commit while retaining the additive database schema. Do not automatically run `alembic downgrade`: several revisions drop data tables or reject removal of protected history.
