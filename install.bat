@echo off
cd /d "%~dp0"
echo ===================================================
echo   Installing ProxiSpeak Dependencies...
echo ===================================================

echo [1/3] Installing Root Dependencies...
call npm install

echo [2/3] Installing Server Dependencies...
cd server
call npm install
cd ..

echo [3/3] Installing Client Dependencies...
cd client
call npm install
cd ..

echo ===================================================
echo   Installation Complete!
echo   Run 'run.bat' to start the application.
echo ===================================================
pause
