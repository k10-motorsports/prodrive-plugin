@echo off
setlocal enabledelayedexpansion

:: ════════════════════════════════════════════════════════════════
::  K10 Media Coach — SimHub Plugin Rebuild & Restart
:: ════════════════════════════════════════════════════════════════
::
::  Usage:  rebuild.bat              (uses defaults)
::          rebuild.bat Release      (explicit config)
::          rebuild.bat Debug        (debug build)
::
::  Requires: dotnet SDK on PATH
::            SimHub at default path or SIMHUB_PATH env var set
:: ════════════════════════════════════════════════════════════════

set CONFIG=%~1
if "%CONFIG%"=="" set CONFIG=Release

:: ── Resolve SimHub path ──────────────────────────────────────
if defined SIMHUB_PATH (
    set "SH=!SIMHUB_PATH!"
) else (
    set "SH=C:\Program Files (x86)\SimHub"
)

:: Strip trailing backslash for consistency
if "!SH:~-1!"=="\" set "SH=!SH:~0,-1!"

set "SH_EXE=!SH!\SimHubWPF.exe"
set "PROJ=%~dp0plugin\K10MediaCoach.Plugin\K10MediaCoach.Plugin.csproj"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   K10 Media Coach — Rebuild ^& Restart       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Config:     %CONFIG%
echo  SimHub:     !SH!
echo  Project:    %PROJ%
echo.

:: ── 1. Close SimHub ──────────────────────────────────────────
echo  [1/3] Closing SimHub...

tasklist /FI "IMAGENAME eq SimHubWPF.exe" 2>NUL | find /I "SimHubWPF.exe" >NUL
if %ERRORLEVEL%==0 (
    echo        Sending close signal...
    taskkill /IM SimHubWPF.exe >NUL 2>&1
    :: Give it a few seconds to shut down gracefully
    timeout /t 4 /nobreak >NUL

    :: Check if it's still running — force kill if needed
    tasklist /FI "IMAGENAME eq SimHubWPF.exe" 2>NUL | find /I "SimHubWPF.exe" >NUL
    if !ERRORLEVEL!==0 (
        echo        Still running, force closing...
        taskkill /F /IM SimHubWPF.exe >NUL 2>&1
        timeout /t 2 /nobreak >NUL
    )
    echo        SimHub closed.
) else (
    echo        SimHub not running.
)
echo.

:: ── 2. Rebuild plugin ────────────────────────────────────────
echo  [2/3] Building plugin (%CONFIG%)...
echo.

dotnet build "%PROJ%" -c %CONFIG% --nologo
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ══════════════════════════════════════════════
    echo   BUILD FAILED — SimHub will not be restarted.
    echo  ══════════════════════════════════════════════
    echo.
    pause
    exit /b 1
)

echo.
echo        Build succeeded.
echo.

:: ── 3. Launch SimHub ─────────────────────────────────────────
echo  [3/3] Starting SimHub...

if exist "!SH_EXE!" (
    start "" "!SH_EXE!"
    echo        SimHub launched.
) else (
    echo        ERROR: SimHubWPF.exe not found at:
    echo        !SH_EXE!
    echo.
    echo        Set SIMHUB_PATH environment variable to your SimHub folder.
    pause
    exit /b 1
)

echo.
echo  ══════════════════════════════════════════════
echo   Done. Plugin rebuilt and SimHub restarted.
echo  ══════════════════════════════════════════════
echo.

endlocal
