@echo off
title K10 Media Broadcast
cd /d "%~dp0"

echo ═══════════════════════════════════════════════
echo  K10 Media Broadcaster — Starting Overlay
echo ═══════════════════════════════════════════════
echo.
echo Hotkeys:
echo   Ctrl+Shift+S   Toggle settings mode (clickable)
echo   Ctrl+Shift+H   Toggle overlay visibility
echo   Ctrl+Shift+G   Toggle green-screen mode (restarts)
echo   Ctrl+Shift+T   Toggle React/original dashboard (restarts)
echo   Ctrl+Shift+R   Reset window position/size
echo   Ctrl+Shift+D   Restart demo sequence
echo   Ctrl+Shift+Q   Quit overlay
echo.

:: Check Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)

:: Auto-install on first run
if not exist "node_modules" (
    echo First run — installing dependencies...
    call install.bat
    if %ERRORLEVEL% NEQ 0 (
        echo Install failed.
        pause
        exit /b 1
    )
    echo.
)

:: Rebuild React dashboard if source is newer than built output
if exist "%~dp0..\src\package.json" (
    if not exist "%~dp0dashboard-react.html" (
        echo React dashboard not built. Building...
        pushd "%~dp0..\src"
        call npx vite build
        popd
    )
)

:: Launch overlay
npx electron .
