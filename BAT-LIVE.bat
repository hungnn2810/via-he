@echo off
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Chua cai Node.js. Tai ban LTS o https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
if not exist "node_modules\three" (
  echo Dang cai thu vien, doi 1-2 phut...
  call npm install
)
echo Link cho TikTok LIVE Studio: http://lvh.me:3002/
echo Trang quan tri: http://localhost:3002/admin
echo Giu cua so nay mo suot buoi live. Dong cua so la tat game.
node server.js
pause
