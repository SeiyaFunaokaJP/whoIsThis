@echo off
rem Double-click to build WhoIsThis for Windows. Output goes to the dist\ folder.
rem Extra arguments are passed to `tauri build` (e.g. build.bat --debug).
setlocal
cd /d "%~dp0"
title WhoIsThis build
set "ERR=0"

rem Pause at the end only when started by double-click (so the window doesn't vanish)
set "DBLCLICK=0"
echo %cmdcmdline% | find /i "%~0" >nul && set "DBLCLICK=1"

where node >nul 2>nul || (
  echo [ERROR] Node.js was not found. Install it from https://nodejs.org/ and try again.
  goto :fail
)
where cargo >nul 2>nul || (
  echo [ERROR] Rust was not found. Install it from https://rustup.rs/ and try again.
  echo         Also install "Desktop development with C++" from Visual Studio Build Tools:
  echo         https://v2.tauri.app/start/prerequisites/
  goto :fail
)

if not exist "node_modules\" (
  echo Installing npm packages...
  call npm ci || goto :fail
)

call npm run build -- %* || goto :fail

echo.
echo Build finished. The files are in: %~dp0dist
if "%DBLCLICK%"=="1" start "" "%~dp0dist"
goto :end

:fail
set "ERR=1"
echo.
echo Build failed. See the messages above.

:end
if "%DBLCLICK%"=="1" pause
exit /b %ERR%
