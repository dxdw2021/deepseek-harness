@echo off
rem Quick-start launcher for the DeepSeek Harness WebUI (OpenCode Zen free models).
rem Double-click this file, or run it from any terminal. Keep the window open.
setlocal
cd /d "%~dp0"
echo [dsh] Booting the WebUI on http://127.0.0.1:3080 ...
echo [dsh] Keep this window open; closing it stops the server.
call pnpm dsh --profile web --host 127.0.0.1 --port 3080
endlocal
