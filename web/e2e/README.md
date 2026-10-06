# Training and nutrition browser checks

The tests log in and save through the actual frontend and dedicated backend. Each
complete run needs a fresh JSON fixture from `server/tools/seed_training_e2e.py`,
an API with migrations and the verified AFCD Release 3 data, and Chromium:

```sh
npm ci
npx playwright install --with-deps chromium
```

Set `AI_HOOPS_E2E_FIXTURE` to the absolute fixture JSON path. The fixture contains
randomly namespaced accounts, a class and a published two-activity plan; keep it
out of Git and uploaded artifacts. Set `PLAYWRIGHT_BASE_URL` (default
`http://127.0.0.1:3123`) and `API_BASE_URL` (default
`http://127.0.0.1:8123/api/v1`) to the dedicated test services. CORS must allow the
frontend origin. The configuration rejects external hosts and user ports
3000/8000.

```sh
# Set NEXT_PUBLIC_API_BASE_URL to the dedicated API before building. Next embeds
# this public value into the client bundle; setting it only at start is too late.
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8123/api/v1 npm run build -- --webpack
npm run typecheck:e2e
npm run test:e2e
```

The equivalent Windows PowerShell setup in `web` is:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:8123/api/v1"
$env:API_BASE_URL = $env:NEXT_PUBLIC_API_BASE_URL
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3123"
$env:AI_HOOPS_E2E_FIXTURE = (Resolve-Path "../tmp/training-e2e-fixture.json").Path
npm run build -- --webpack
npm run typecheck:e2e
npm run test:e2e
```

Playwright starts the already built `next start` on the dedicated frontend port;
it does not build a second time. Locally it can reuse an existing server on that
port; CI starts its own server. Build in an isolated checkout when another Next
server is using this checkout's `.next` directory. The backend lifecycle remains
with the caller/CI workflow. Production mode also keeps these checks independent
of development manifest/hot-reload state.

The four serial scenarios cover fixed `yyyy/mm/dd` Profile date input with ISO
API persistence, append-only measurement/BMI history and re-login, identity isolation, coach
standards/intensity/individual minutes, preview fingerprints and a real 409 after
a new measurement, parent read-only reports and frozen publication history,
official food search/categories/pagination, English by default and a saved Chinese
preference across refresh/re-login/account switches, invalid date editing and a
failed language save followed by retry, a one-shot food 503 followed by a real API
retry, responsive widths and mobile menu keyboard navigation. Successful data
flows are never mocked. A failed scenario is not automatically retried against
mutated records; reseed and rerun the complete suite.

Failure traces/screenshots, HTML and JUnit results are in `.artifacts/` (ignored).
These browser checks use synthetic accounts and do not replace user UAT or
production migration/deployment checks.

Two additional report-age scenarios use seeded synthetic measurements and a
historical template deliberately different from current rules. They cover age
preview/cancel, a one-shot 503 and idempotent retry, the save lock, refresh,
unchanged original measurements/template/report and dashboard statistics,
anonymous read-only sharing, missing historical rules, loading retry and failed
ID changes without stale report contents. Their successful reads/writes use the
real dedicated API and PostgreSQL. The playable tracked demo does not generate
the stored measurements: these scenarios do not prove MediaPipe inference,
object-storage upload or real Training video quality. Reseed old fixture files
to include the new randomly scoped `age_reports` entries.
