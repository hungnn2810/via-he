@echo off
cd /d "%~dp0server"
where node >nul 2>nul || (
  echo Node.js is not installed. Get the LTS version 22+ from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\@colyseus" (
  echo Installing dependencies, this takes 1-2 minutes...
  call npm install
)
echo Via He Online server: ws://localhost:2567
echo Phones on the same wifi: enter ws://PC-IP:2567 on the login screen.
call npm start
pause
