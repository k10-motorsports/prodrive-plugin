@echo off
echo ═══════════════════════════════════════════════
echo  K10 Media Broadcaster — Rebuild React Dashboard
echo ═══════════════════════════════════════════════
echo.

cd /d "%~dp0"

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm not found. Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0..\src\package.json" (
    echo ERROR: React source directory not found at ..\src
    pause
    exit /b 1
)

echo [1/3] Installing React dependencies...
pushd "%~dp0..\src"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: npm install failed.
    popd
    pause
    exit /b 1
)

echo.
echo [2/3] Building React dashboard...
call npx vite build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Vite build failed.
    popd
    pause
    exit /b 1
)
popd

echo.
echo [3/3] Verifying build output...
if exist "%~dp0dashboard-react.html" (
    echo   dashboard-react.html OK
) else (
    echo   WARNING: dashboard-react.html not found
)

echo.
echo Done! React dashboard rebuilt successfully.
echo.
pause
