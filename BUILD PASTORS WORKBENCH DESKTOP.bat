@echo off
setlocal
title Pastor's Workbench Desktop Builder
echo.
echo Building Pastor's Workbench Windows desktop application (MSI)...
echo.
echo Installing/refreshing local npm dependencies...
call npm install
if errorlevel 1 goto failed

echo.
echo Preparing desktop frontend...
call npm run desktop:prepare
if errorlevel 1 goto failed

echo.
echo Building Tauri MSI...
call npm run desktop:build
if errorlevel 1 goto failed

echo.
echo ==========================================
echo BUILD COMPLETE.
echo ==========================================
echo.
echo MSI installer:
echo src-tauri\target\release\bundle\msi\
echo.
pause
exit /b 0
:failed
echo.
echo BUILD FAILED.
echo Review the error above and send the complete output if it fails.
echo.
pause
exit /b 1
