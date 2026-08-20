@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo       PASTOR'S WORKBENCH
 echo       Starting local server...
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Please install Node.js, then run this file again.
  pause
  exit /b 1
)

start "Pastor's Workbench Server" /min cmd /c "node serve.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787"

echo Workbench is running at http://127.0.0.1:8787
 echo You may close this window after the browser opens.
endlocal
