@echo off
setlocal enabledelayedexpansion

:: ════════════════════════════════════════════════════════════════
::  K10 Motorsports — SimHub Plugin Rebuild & Restart
:: ════════════════════════════════════════════════════════════════
::
::  Usage:  rebuild.bat              (uses defaults)
::          rebuild.bat Release      (explicit config)
::          rebuild.bat Debug        (debug build)
::
::  Requires: dotnet SDK on PATH
::            SimHub at default path or SIMHUB_PATH env var set
::
::  Notes:  Uses PowerShell Stop-Process as primary kill method
::          (works in Parallels/VMs where taskkill may lack perms)
:: ════════════════════════════════════════════════════════════════

set CONFIG=%~1
if "%CONFIG%"=="" set CONFIG=Release

:: ── Resolve SimHub path (same probe order as install.bat) ────
set "SH="
if exist "C:\Program Files (x86)\SimHub\SimHubWPF.exe" set "SH=C:\Program Files (x86)\SimHub"
if exist "C:\Program Files\SimHub\SimHubWPF.exe"       set "SH=C:\Program Files\SimHub"
:: Env var override wins
if defined SIMHUB_PATH (
    if exist "!SIMHUB_PATH!\SimHubWPF.exe" set "SH=!SIMHUB_PATH!"
)
if "!SH!"=="" (
    echo.
    echo  ERROR: SimHub not found. Set SIMHUB_PATH or install to a default location.
    pause
    exit /b 1
)
if "!SH:~-1!"=="\" set "SH=!SH:~0,-1!"

set "SH_EXE=!SH!\SimHubWPF.exe"
:: Project path is relative to repo root (this script lives in scripts/)
set "PROJ=%~dp0..\racecor-plugin\plugin\K10Motorsports.Plugin\K10Motorsports.Plugin/K10Motorsports.Plugin.csproj"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   K10 Motorsports — Rebuild ^& Restart       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  Config:     %CONFIG%
echo  SimHub:     !SH!
echo  Project:    %PROJ%
echo.

:: ── 1. Close SimHub ──────────────────────────────────────────
echo  [1/3] Closing SimHub...

:: Try PowerShell Stop-Process first — works across privilege
:: boundaries in Parallels and other VMs where taskkill fails
set "KILLED=0"
for %%P in (SimHubWPF SimHub SimHubElectron) do (
    powershell -NoProfile -Command "if (Get-Process -Name '%%P' -ErrorAction SilentlyContinue) { Stop-Process -Name '%%P' -Force -ErrorAction SilentlyContinue; Write-Host '       Stopping %%P...' }" 2>NUL
    if !ERRORLEVEL! == 0 set "KILLED=1"
)

:: Fallback: taskkill for anything PowerShell missed
for %%P in (SimHubWPF.exe SimHub.exe SimHubElectron.exe) do (
    tasklist /FI "IMAGENAME eq %%P" 2>NUL | find /I "%%P" >NUL 2>&1
    if !ERRORLEVEL! == 0 (
        echo        Killing %%P via taskkill...
        taskkill /F /IM %%P >NUL 2>&1
        set "KILLED=1"
    )
)

:: Fallback 2: wmic (covers edge cases on older Windows/Parallels)
for %%P in (SimHubWPF.exe SimHub.exe SimHubElectron.exe) do (
    wmic process where "name='%%P'" get ProcessId 2>NUL | findstr /R "[0-9]" >NUL 2>&1
    if !ERRORLEVEL! == 0 (
        echo        Killing %%P via wmic...
        wmic process where "name='%%P'" call terminate >NUL 2>&1
        set "KILLED=1"
    )
)

if "!KILLED!"=="1" (
    echo        Waiting for processes to exit...
    for /L %%I in (1,1,15) do (
        powershell -NoProfile -Command "if (-not (Get-Process -Name 'SimHubWPF' -ErrorAction SilentlyContinue)) { exit 0 } else { exit 1 }" 2>NUL
        if !ERRORLEVEL! == 0 goto :simhub_stopped
        timeout /t 1 /nobreak >NUL
    )
    echo        WARNING: SimHub may still be running after 15s wait.
    echo        Final force-kill attempt...
    powershell -NoProfile -Command "Get-Process -Name 'SimHubWPF','SimHub','SimHubElectron' -ErrorAction SilentlyContinue | Stop-Process -Force" 2>NUL
    taskkill /F /IM SimHubWPF.exe /T >NUL 2>&1
    timeout /t 3 /nobreak >NUL
)

:simhub_stopped
:: Final verification
powershell -NoProfile -Command "if (Get-Process -Name 'SimHubWPF' -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }" 2>NUL
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo  ══════════════════════════════════════════════
    echo   ERROR: Could not stop SimHub. Build aborted.
    echo   Close SimHub manually and try again.
    echo  ══════════════════════════════════════════════
    echo.
    pause
    exit /b 1
)
echo        SimHub stopped.
echo.

:: Brief pause to release file locks
timeout /t 2 /nobreak >NUL

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
echo        Path: !SH_EXE!

:: Reset ERRORLEVEL so it doesn't poison the if-exist check
cmd /c "exit /b 0"

if exist "!SH_EXE!" (
    start "" "!SH_EXE!"
    if !ERRORLEVEL! NEQ 0 (
        echo        WARNING: start returned error !ERRORLEVEL!, trying alternate launch...
        "!SH_EXE!"
    )
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
echo   Done. K10 Motorsports rebuilt and restarted.
echo  ══════════════════════════════════════════════
echo.

endlocal
