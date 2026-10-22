@echo off
echo ===================================================
echo   Installing ProxiSpeak Dependencies...
echo ===================================================

echo [1/2] Installing Server Dependencies...
cd server
call npm install
cd ..

echo [2/2] Installing Client Dependencies...
cd client
call npm install
cd ..

echo ===================================================
echo   Installation Complete!
echo   Run 'run.bat' to start the application.
echo ===================================================
pause
