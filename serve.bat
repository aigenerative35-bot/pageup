@echo off
rem PageUp - start a local web server (Windows).
rem ES modules will not load over file://, and the admin console shares data
rem with the site only on the same origin. Open BOTH URLs printed below.
cd /d "%~dp0"
if "%~1"=="" (set PORT=5173) else (set PORT=%~1)

echo.
echo   PageUp - local preview
echo.
echo   Website : http://localhost:%PORT%/index.html
echo   Admin   : http://localhost:%PORT%/admin.html
echo.
echo   Open both from these URLs. Ctrl+C to stop.
echo.

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server %PORT%
  goto :eof
)
where python3 >nul 2>nul
if %errorlevel%==0 (
  python3 -m http.server %PORT%
  goto :eof
)
where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes serve -l %PORT% .
  goto :eof
)
echo   Neither Python nor Node was found.
echo   Use the live site instead: https://aigenerative35-bot.github.io/pageup/admin.html
pause
