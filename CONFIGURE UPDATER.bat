@echo off
setlocal
cd /d "%~dp0"
if not exist "updater-keys\pastors-workbench.key.pub" (
  echo.
  echo Public signing key not found.
  echo Expected: updater-keys\pastors-workbench.key.pub
  echo Put the two generated signing-key files in the updater-keys folder,
  echo then run this file again.
  pause
  exit /b 1
)
set "ROOT=%CD%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path $env:ROOT 'updater-keys\pastors-workbench.key.pub'; $pub=(Get-Content -Raw -LiteralPath $p).Trim(); if([string]::IsNullOrWhiteSpace($pub)){throw 'Public key file is empty.'}; $cfg=Join-Path $env:ROOT 'src-tauri\tauri.conf.json'; $j=Get-Content -Raw -LiteralPath $cfg | ConvertFrom-Json; if(-not $j.plugins){$j | Add-Member -MemberType NoteProperty -Name plugins -Value ([pscustomobject]@{})}; $j.plugins.updater.pubkey=$pub; $j | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 -LiteralPath $cfg; Write-Host 'Public signing key configured in src-tauri\tauri.conf.json.'"
if errorlevel 1 (
  echo.
  echo Configuration failed. Your key files were not modified.
  pause
  exit /b 1
)
echo.
echo Updater public-key configuration complete.
echo The private .key file is NOT copied into the project.
echo Keep that private key secret and add it to GitHub as a repository secret.
echo.
pause
