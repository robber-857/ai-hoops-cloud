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

This release's head is `20261003_0012`. Confirm the new profile/lesson/food/report tables and all six history protection triggers. `/health` is liveness only: there is no `/ready` endpoint, and a successful health response does not verify migrations or data readiness.

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

Initialize missing training templates through the administrator sync preview and its matching preview token. Preserve existing referenced versions; never overwrite their rules. The five new v1 codes are `jump_rope_basic_front`, `jumping_jack_reps_front`, `lunge_same_side_reps_side`, `pushup_reps_side`, and `single_leg_stand_front`.

## Release order and acceptance

1. Inspect current targets, commits, environment names, and database identity. Record a provider-side backup and pre-release counts.
2. Prepare a clean release; complete appropriate source tests, type checks, production build, and dependency checks.
3. Migrate the production database, import official AFCD data, and initialize only missing templates.
4. Deploy the exact release commit to Render. Verify the live commit, schema, authenticated endpoints, and CORS.
5. Push the verified release to `main` and wait for Vercel's Production deployment to succeed for that exact commit.
6. Use an authenticated browser to check Profile, food search, existing reports, actual file upload, analysis/save, and refresh/reopen. Verify coach publication and parent visibility using a real class when available.

The food endpoint `/api/v1/training-foods?limit=100` must return ready, 28 selected entries, zero missing foods, and the official fingerprint. `/api/v1/exercise-activities` must expose the expected nine activities and versioned estimation rules.

Browser upload uses Supabase Storage with the public anon key and the existing bucket policy. Verify actual storage upload, signed playback, and API completion; synthetic API tests do not establish storage or MediaPipe inference readiness. Existing reports must still reopen with their saved snapshots.

Rollback applications to a previously verified commit while retaining the additive database schema. Do not automatically run `alembic downgrade`: several revisions drop data tables or reject removal of protected history.
