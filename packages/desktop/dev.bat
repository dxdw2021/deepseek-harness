@echo off
REM DeepSeek Harness Desktop - Development Mode Launcher
REM Usage: dev.bat [--external]

cd /d "%~dp0"

echo ==========================================
echo  DeepSeek Harness Desktop - Dev Mode
echo ==========================================
echo.

REM Check if user passed --external flag
if "%1"=="--external" (
    echo [dev] Using external dsh web (--external)
    npx tsx scripts/dev.mjs --external
) else (
    echo [dev] Auto-detecting dsh web...
    npx tsx scripts/dev.mjs
)

pause