@echo off
setlocal enabledelayedexpansion
title OS-360-viewer (dev server)
cd /d "%~dp0"

echo ============================================================
echo   OS-360-viewer - Serveur de developpement
echo ============================================================
echo.

REM Ecrit l'IP LAN dans .env.local pour que Vite l'expose a l'app.
REM On utilise la liste des IP IPv4 (on garde la premiere IP privee RFC1918).
set "lanip="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "ip=%%a"
  set "ip=!ip: =!"
  if not defined lanip set "lanip=!ip!"
  echo !ip! | findstr /r "^192\.168\." >nul && set "lanip=!ip!"
  echo !ip! | findstr /r "^10\." >nul && set "lanip=!ip!"
  echo !ip! | findstr /r "^172\.1[6-9]\." >nul && set "lanip=!ip!"
  echo !ip! | findstr /r "^172\.2[0-9]\." >nul && set "lanip=!ip!"
  echo !ip! | findstr /r "^172\.3[01]\." >nul && set "lanip=!ip!"
)
if defined lanip (
  echo VITE_LAN_IP=!lanip!> "%~dp0.env.local"
  echo [OK] IP locale pour les QR : !lanip!
  echo      (si incorrecte, modifiez le champ "IP locale" dans l'aide du viewer)
) else (
  echo [!] Aucune IP IPv4 detectee.
)
echo.

echo Pour autoriser le telephone a acceder au serveur, ouvrez PowerShell
echo EN TANT QU'ADMINISTRATEUR et collez :
echo   netsh advfirewall firewall add rule name="OS-360-viewer dev (5173)" dir=in action=allow protocol=TCP localport=5173 profile=private,public
echo.

echo Le serveur demarre... (fermez cette fenetre pour arreter)
echo.

cmd /c "npm run dev"
if errorlevel 1 (
  echo.
  echo [ERREUR] npm run dev a echoue. Verifiez Node/npm.
  pause
)
