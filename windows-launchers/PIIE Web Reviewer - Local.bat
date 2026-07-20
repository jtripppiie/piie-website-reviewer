@echo off
setlocal

set "APP_DIR=/home/jt/projects/before-after"
set "HEALTH_URL=http://localhost:3000/healthz"

echo Starting the latest PIIE Web Reviewer locally in WSL...
echo.

for /f "usebackq delims=" %%A in (`wsl.exe bash -lc "cd %APP_DIR% && awk -F= '/^ADMIN_PASSWORD=/{sub(/^[^=]*=/, \"\"); print; exit}' .env 2^>/dev/null"`) do set "ADMIN_PASSWORD=%%A"

start "PIIE Web Reviewer Local" cmd.exe /k wsl.exe bash -lc "cd %APP_DIR% && bash ./run-local.sh"

echo Waiting for the reviewer to become ready...
powershell.exe -NoProfile -Command "$deadline = (Get-Date).AddSeconds(30); do { try { $r = Invoke-RestMethod '%HEALTH_URL%' -TimeoutSec 2; if ($r.ok -and $r.app -eq 'PIIE Web Reviewer') { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
  echo.
  echo The reviewer did not start. Check the "PIIE Web Reviewer Local" window for the error.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "$p = $env:ADMIN_PASSWORD; $url = 'http://localhost:3000/admin'; if ($p) { $url += '?key=' + [System.Uri]::EscapeDataString($p) }; Start-Process $url"

echo The latest local app is open in your browser.
