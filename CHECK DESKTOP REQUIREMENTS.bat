@echo off
setlocal
cd /d "%~dp0"
title Pastor's Workbench - Desktop Requirements Check

echo ================================================
echo Pastor's Workbench Desktop Requirements Check
echo ================================================
echo.

where node >nul 2>nul && (for /f "tokens=*" %%A in ('node --version') do echo Node: %%A) || echo Node: NOT FOUND
where npm >nul 2>nul && (for /f "tokens=*" %%A in ('npm --version') do echo npm: %%A) || echo npm: NOT FOUND
where cargo >nul 2>nul && (for /f "tokens=*" %%A in ('cargo --version') do echo Cargo: %%A) || echo Cargo: NOT FOUND
where rustc >nul 2>nul && (for /f "tokens=*" %%A in ('rustc --version') do echo Rust: %%A) || echo Rust: NOT FOUND
where ollama >nul 2>nul && (for /f "tokens=*" %%A in ('ollama --version') do echo Ollama: %%A) || echo Ollama: NOT FOUND

echo.
echo Checking Ollama HTTP endpoint...
where curl >nul 2>nul && curl -s --max-time 3 http://127.0.0.1:11434/api/tags >nul && echo Ollama endpoint: READY || echo Ollama endpoint: NOT REACHABLE

echo.
if exist src-tauri\target (echo Existing Tauri target detected - this is OK.)
if exist frontend (echo Desktop frontend folder: READY) else echo Desktop frontend folder: will be created during build
echo.
echo If Cargo is present, the MSVC Rust toolchain should be selected:
echo     rustup default stable-msvc
echo.
echo For Tauri MSI builds, VBScript may need to be enabled in Windows Optional Features.
echo NSIS EXE builds do not require the MSI VBScript step.
echo.
pause
