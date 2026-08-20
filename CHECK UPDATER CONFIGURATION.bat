@echo off
setlocal
cd /d "%~dp0"
echo Pastor's Workbench updater configuration check
echo.
if not exist "src-tauri\tauri.conf.json" echo ERROR: tauri.conf.json missing.
if not exist "src-tauri\capabilities\default.json" echo ERROR: updater capability file missing.
findstr /C:"XLFatFluffy/Pastor-s-Workbench" "src-tauri\tauri.conf.json" >nul && echo OK: GitHub endpoint configured. || echo WARNING: GitHub endpoint not found.
findstr /C:"PASTE_PUBLIC_KEY_HERE" "src-tauri\tauri.conf.json" >nul && echo WARNING: Public signing key still needs to be configured. || echo OK: Public signing key appears configured.
echo.
pause
