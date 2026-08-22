@echo off
setlocal
cd /d "%~dp0"
title Pastor's Workbench - Generate Updater Signing Key
where cargo >nul 2>nul || (echo Rust/Cargo is required.& pause& exit /b 1)
where npm >nul 2>nul || (echo Node/npm is required.& pause& exit /b 1)
if not exist updater-keys mkdir updater-keys
if exist updater-keys\pastors-workbench.key (
  echo A signing key already exists. Do NOT overwrite it unless you intend to invalidate prior updates.
  pause
  exit /b 0
)
echo Generating a Tauri updater signing key...
call npm run tauri -- signer generate -w updater-keys\pastors-workbench.key
if errorlevel 1 goto fail
echo.
echo IMPORTANT: KEEP updater-keys\pastors-workbench.key PRIVATE.
echo The .pub file is safe to publish. The private .key file must never be uploaded to GitHub.
echo.
pause
exit /b 0
:fail
echo Failed to generate signing key.
pause
exit /b 1
