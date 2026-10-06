param([string]$Python = 'C:/Users/28068/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
foreach ($port in @(3000,8000)) {
    $probe = [System.Net.Sockets.TcpClient]::new()
    try { $probe.Connect('127.0.0.1', $port); throw "Local port $port is already running; reuse it or inspect its owner first." }
    catch [System.Net.Sockets.SocketException] { }
    finally { $probe.Dispose() }
}
$env:LOCAL_DEMO_PASSWORD = docker exec ai-hoops-p2-test-20260927 printenv POSTGRES_PASSWORD
if ($LASTEXITCODE -ne 0 -or !$env:LOCAL_DEMO_PASSWORD) { throw 'Dedicated local PostgreSQL container is unavailable.' }
$env:PYTHONPATH = "$repo/server;$repo/server/.venv/Lib/site-packages;$repo/tmp/p2-test-deps"
$env:PYTHONIOENCODING = 'utf-8'
Push-Location "$repo/server"
try { & $Python tools/seed_recipe_demo.py; if ($LASTEXITCODE -ne 0) { throw 'Demo preparation failed.' } }
finally { Pop-Location }
$env:DATABASE_URL = 'postgresql+psycopg://p2_test:' + [uri]::EscapeDataString($env:LOCAL_DEMO_PASSWORD) + '@127.0.0.1:55439/ai_hoops_recipe_demo'
$env:APP_ENV = 'development'
& $Python "$repo/server/tools/seed_class_report_demo.py"
if ($LASTEXITCODE -ne 0) { throw 'Class report demo preparation failed.' }
& $Python "$repo/server/tools/seed_personal_energy_demo.py"
if ($LASTEXITCODE -ne 0) { throw 'Personal energy demo preparation failed.' }
$env:CORS_ORIGINS = '["http://127.0.0.1:3000"]'
$env:SESSION_COOKIE_NAME = 'ai-hoops-recipe-demo'
$env:SESSION_COOKIE_SECURE = 'false'
$env:JWT_SECRET_KEY = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:JWT_REFRESH_SECRET_KEY = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
$env:NEXT_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'
Push-Location "$repo/web"
try { npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } }
finally { Pop-Location }
New-Item -ItemType Directory -Force "$repo/tmp" | Out-Null
Start-Process -WindowStyle Hidden -FilePath $Python -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory "$repo/server" -RedirectStandardOutput "$repo/tmp/p5-demo-api.out.log" -RedirectStandardError "$repo/tmp/p5-demo-api.err.log"
Start-Process -WindowStyle Hidden -FilePath (Get-Command node.exe).Source -ArgumentList 'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000' -WorkingDirectory "$repo/web" -RedirectStandardOutput "$repo/tmp/p5-demo-web.out.log" -RedirectStandardError "$repo/tmp/p5-demo-web.err.log"
Write-Output 'Local recipe preview starting: http://127.0.0.1:3000/auth/login . Check tmp/p5-demo-*.log for readiness.'
