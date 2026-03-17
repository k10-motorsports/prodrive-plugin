@echo off
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

if not exist "node_modules" (
    echo node_modules not found. Running install first...
    call install.bat
    if %ERRORLEVEL% NEQ 0 exit /b 1
)

:: Rebuild React dashboard if source is newer than built output
if exist "..\src\package.json" (
    if not exist "dashboard-react.html" (
        echo React dashboard not built. Building...
        pushd "..\src"
        call npx vite build
        popd
    )
)

npx electron .
