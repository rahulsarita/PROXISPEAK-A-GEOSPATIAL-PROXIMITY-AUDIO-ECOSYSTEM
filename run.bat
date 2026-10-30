@echo off
setlocal
cd /d "%~dp0"

echo Starting ProxiSpeak...

echo Local frontend: http://localhost:3000
echo Hosted website: https://frontend-mern-pied.vercel.app/

if not exist "node_modules\.bin\concurrently.cmd" goto MissingDependencies
if not exist "server\node_modules\mongoose\package.json" goto MissingDependencies
if not exist "client\node_modules\vite\package.json" goto MissingDependencies

set "FRONTEND_BUSY="
set "BACKEND_BUSY="
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 set "FRONTEND_BUSY=1"
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if not errorlevel 1 set "BACKEND_BUSY=1"

if defined FRONTEND_BUSY if defined BACKEND_BUSY (
  echo ProxiSpeak already appears to be running. Opening the existing app.
  start "" "http://localhost:3000"
  exit /b 0
)

if defined FRONTEND_BUSY goto StartBackendOnly
if defined BACKEND_BUSY goto StartFrontendOnly

start "ProxiSpeak Ecosystem" /D "%~dp0" cmd /k "npm run dev"
goto OpenApp

:StartBackendOnly
echo Frontend is already running. Starting the backend only.
start "ProxiSpeak Backend" /D "%~dp0" cmd /k "npm run server:dev"
goto OpenApp

:StartFrontendOnly
echo Backend is already running. Starting the frontend only.
start "ProxiSpeak Frontend" /D "%~dp0" cmd /k "npm run client"

:OpenApp
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000"
exit /b 0

:MissingDependencies
echo Dependencies are missing. Run install.bat first, then run this file again.
pause
exit /b 1
