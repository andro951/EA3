@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js and run this file again.
  pause
  exit /b 1
)
echo Starting EmberAdventures 3...
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open while you play.
node --env-file-if-exists=.env server/main.mjs
pause
