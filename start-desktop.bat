@echo off
rem Launch the DeepSeek Harness desktop window (dev mode).
rem dev version uses port 3081 (isolated from installed version on 3080).
rem This script starts dsh web on 3081 if not running, then launches Electron.
setlocal
cd /d "%~dp0"

call :repair-fallback
if errorlevel 1 goto :fail

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [dsh-desktop] pnpm not found on PATH. Install pnpm first: npm i -g pnpm
  goto :fail
)

rem Check if dsh web is already running on dev port 3081
netstat -ano | findstr /c:":3081 " >nul 2>&1
if not errorlevel 1 (
  echo [dsh-desktop] dsh web already running on 127.0.0.1:3081
  goto :launch
)

rem Check if port 3080 is available (installed version uses 3080)
netstat -ano | findstr /c:":3080 " >nul 2>&1
if not errorlevel 1 (
  echo [dsh-desktop] Detected installed version on port 3080 (will not interfere)
)

echo [dsh-desktop] Starting dsh web on port 3081...
cd /d "%~dp0"
start "dsh-web-dev" cmd /c "pnpm dsh --profile web --host 127.0.0.1 --port 3081"

rem Wait for dsh web to be ready
echo [dsh-desktop] Waiting for dsh web to start...
set /a attempts=0
:wait-loop
timeout /t 2 /nobreak >nul
netstat -ano | findstr /c:":3081 " >nul 2>&1
if not errorlevel 1 goto :web-up
set /a attempts+=1
if %attempts% geq 30 (
  echo [dsh-desktop] Timeout waiting for dsh web on port 3081
  goto :fail
)
echo [dsh-desktop] Still waiting... (%attempts%)
goto :wait-loop

:web-up
echo [dsh-desktop] dsh web is ready on 127.0.0.1:3081

:launch
cd /d "%~dp0\packages\desktop"
echo [dsh-desktop] Opening the desktop window (dev mode) ...
echo [dsh-desktop] Close this window or press Ctrl+C to stop Electron.
call pnpm run dev -- --external
cd /d "%~dp0"
exit /b %errorlevel%

:fail
echo [dsh-desktop] Aborted. See docs\windows-startup.zh-CN.md for troubleshooting.
pause
exit /b 1

:repair-fallback
rem dsh fails loud when %USERPROFILE%\.dsh-dev\profiles\node_modules\@deepseek-ai
rem holds a real directory where a junction (reparse point) belongs. Move empty
rem stale copies aside so the next boot re-links them.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$fb = Join-Path $env:USERPROFILE '.dsh-dev\profiles\node_modules\@deepseek-ai'; if (Test-Path $fb) { Get-ChildItem $fb -Force -Directory | Where-Object { -not $_.LinkType } | ForEach-Object { $n = (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count; if ($n -eq 0) { $to = Join-Path $env:TEMP ('dsh-stale-' + $_.Name + '-' + [DateTime]::Now.ToString('yyyyMMddHHmmss')); Move-Item $_.FullName $to; Write-Host ('[dsh-desktop] moved stale empty directory ' + $_.Name + ' to ' + $to) } else { Write-Host ('[dsh-desktop] warning: ' + $_.Name + ' is a real directory with ' + $n + ' items and is not a junction; remove it manually before dsh can boot') } } }"
exit /b %errorlevel%
