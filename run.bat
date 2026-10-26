@echo off
echo ===================================================
echo   Starting ProxiSpeak Ecosystem
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:3000
echo ===================================================

start "ProxiSpeak Backend Server" cmd /k "cd server && npm start"
timeout /t 2 /nobreak >nul
start "ProxiSpeak Frontend Client" cmd /k "cd client && npm run dev"

echo Both services launched! Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000
.\run.bat
 website run /https://frontend-mern-pied.vercel.app/