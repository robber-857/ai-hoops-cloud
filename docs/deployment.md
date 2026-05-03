# Deployment Guide

## Environment separation

### Frontend (`web/`)

- Local development uses `web/.env.local` and should never be committed.
- Production uses Vercel Project Settings -> Environment Variables.
- `web/.env.example` documents local values.
- `web/.env.production.example` documents the production values that belong in Vercel.

Required frontend variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Backend (`server/`)

- Local development uses `server/.env` or `server/.env.local`.
- Production uses Render service Environment Variables.
- `server/.env.example` documents local values.
- `server/.env.production.example` documents the production values that belong in Render.
- `server/.env.production` is also supported for production-like local runs or Render Secret File usage, but it must not be committed.

Required backend variables:

- `APP_NAME`
- `APP_ENV`
- `DEBUG`
- `API_V1_PREFIX`
- `DATABASE_URL` or the `POSTGRES_*` variables
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_SECURE`
- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_DOMAIN`
- `CORS_ORIGINS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `SMTP_STARTTLS`
- `UPLOAD_VIDEO_BUCKET`
- `TEMPLATE_VIDEO_BUCKET`

## Vercel setup

The current Vercel project is already connected to the `main` branch, so pushing to `main` will create the production deployment.

Recommended Vercel settings:

- Root Directory: `web`
- Build Command: `npm run build`
- Install Command: `npm install`

Production environment variables to add in Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Render setup

Create a Render Web Service from this repository with:

- Root Directory: `server`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Production environment variables to add in Render:

```env
APP_NAME=AI Hoops Cloud API
APP_ENV=production
DEBUG=false
API_V1_PREFIX=/api/v1
DATABASE_URL=postgresql+psycopg://username:password@host:5432/database
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_REFRESH_SECRET_KEY=replace-with-another-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
SESSION_COOKIE_NAME=ai-hoops-session
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_DOMAIN=
CORS_ORIGINS=["https://ai-hoops-cloud.vercel.app","https://your-project-name.vercel.app"]
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-sender@gmail.com
SMTP_PASSWORD=your-email-provider-app-password
SMTP_FROM_EMAIL=your-sender@gmail.com
SMTP_FROM_NAME=AI Hoops Cloud
SMTP_STARTTLS=true
UPLOAD_VIDEO_BUCKET=user-videos
TEMPLATE_VIDEO_BUCKET=template-videos
```

Alternatively, create a Render Secret File at `server/.env.production` with the same values. Do not commit `server/.env.production`; the repository `.gitignore` already excludes it because it can contain SMTP and database secrets.

After the first backend deploy, run the database migration. Local development migration has already been completed as of 2026-04-30, but each new production database still needs this step:

```bash
alembic upgrade head
```

## Release order

1. Deploy the Render backend and confirm `/health` returns `{"status":"ok"}`.
2. Add the Render API URL to Vercel as `NEXT_PUBLIC_API_BASE_URL`.
3. Redeploy Vercel.
4. Merge `developbranch` into `main` and push `main`.
