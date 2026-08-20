@echo off
rem Launch the DeepSeek Harness desktop window.
rem Requires dsh web already running on 127.0.0.1:3080 (start-dsh-web.bat, or
rem `pnpm dsh --profile web --host 127.0.0.1 --port 3080` from the repo root).
rem The packaged exe (win-unpacked\DeepSeek Harness.exe) cannot open the Web GUI
rem yet: its embedded dsh runs under plain Node and the web profile's plugin
rem packages are not in the CLI runtime dependency closure. This dev flow is the
rem supported path; close this window to stop Electron.
setlocal
cd /d "%~dp0"

call :repair-fallback
if errorlevel 1 goto :fail

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [dsh-desktop] pnpm not found on PATH. Install pnpm first: npm i -g pnpm
  goto :fail
)

netstat -ano | findstr /c:":3080 " >nul 2>&1
if not errorlevel 1 goto :web-up

echo [dsh-desktop] dsh web is not running on 127.0.0.1:3080.
echo [dsh-desktop] Start it first with start-dsh-web.bat, or in a terminal:
echo [dsh-desktop]   pnpm dsh --profile web --host 127.0.0.1 --port 3080
goto :fail

:web-up
cd /d "%~dp0\packages\desktop"
echo [dsh-desktop] Opening the desktop window (dev mode, external dsh web) ...
echo [dsh-desktop] Close this window or press Ctrl+C to stop Electron.
call pnpm run dev -- --external
cd /d "%~dp0"
exit /b %errorlevel%

:fail
echo [dsh-desktop] Aborted. See docs\windows-startup.zh-CN.md for troubleshooting.
pause
exit /b 1

:repair-fallback
rem dsh fails loud when %USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai
rem holds a real directory where a junction (reparse point) belongs. Move empty
rem stale copies aside so the next boot re-links them; leave anything with
rem content untouched and report it.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$fb = Join-Path $env:USERPROFILE '.dsh\profiles\node_modules\@deepseek-ai'; if (Test-Path $fb) { Get-ChildItem $fb -Force -Directory | Where-Object { -not $_.LinkType } | ForEach-Object { $n = (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count; if ($n -eq 0) { $to = Join-Path $env:TEMP ('dsh-stale-' + $_.Name + '-' + [DateTime]::Now.ToString('yyyyMMddHHmmss')); Move-Item $_.FullName $to; Write-Host ('[dsh-desktop] moved stale empty directory ' + $_.Name + ' to ' + $to) } else { Write-Host ('[dsh-desktop] warning: ' + $_.Name + ' is a real directory with ' + $n + ' items and is not a junction; remove it manually before dsh can boot') } } }"
exit /b %errorlevel%