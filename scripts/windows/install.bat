@echo off
setlocal enabledelayedexpansion

:: ════════════════════════════════════════════════════════════════
::  RaceCor ProDrive - SimHub Plugin Build & Install
:: ════════════════════════════════════════════════════════════════
::
::  Stops SimHub, builds the plugin, copies the build output + the
::  racecorprodrive-data dataset folder into SimHub's install
::  directory, and relaunches SimHub.
::
::  The csproj is already wired so that when SimHub is detected on
::  this machine its OutputPath points at $(SimHubPath) directly -
::  meaning `dotnet build` drops the DLL straight into SimHub. This
::  script handles everything around that: kill, build, copy data,
::  restart.
::
::  Usage:
::    install.bat                  Release build, auto-detect SimHub
::    install.bat Debug            Debug build
::    set SIMHUB_PATH=C:\...\SimHub install.bat   Explicit path
::
::  Requires:
::    - .NET SDK on PATH (dotnet --version)
::    - SimHub installed at default location, or SIMHUB_PATH set
:: ════════════════════════════════════════════════════════════════

set CONFIG=%~1
if "%CONFIG%"=="" set CONFIG=Release

set "SCRIPT_DIR=%~dp0"
:: This script lives in <repo>/scripts/windows/. Repo root is two up.
set "REPO_ROOT=%SCRIPT_DIR%..\.."
set "PLUGIN_REPO=%REPO_ROOT%\racecor-plugin"
set "PLUGIN_PROJ=%PLUGIN_REPO%\simhub-plugin\plugin\RaceCorProDrive.Plugin\RaceCorProDrive.Plugin.csproj"
set "DATA_DIR=%PLUGIN_REPO%\simhub-plugin\racecorprodrive-data"

echo.
echo  ============================================
echo   RaceCor ProDrive - SimHub Plugin Install
echo  ============================================

:: ── 1. Resolve SimHub path ──────────────────────────────────────
set "SH="
if defined SIMHUB_PATH (
    if exist "!SIMHUB_PATH!\SimHubWPF.exe" set "SH=!SIMHUB_PATH!"
)
if "!SH!"=="" if exist "C:\Program Files (x86)\SimHub\SimHubWPF.exe" (
    set "SH=C:\Program Files (x86)\SimHub"
)
if "!SH!"=="" if exist "C:\Program Files\SimHub\SimHubWPF.exe" (
    set "SH=C:\Program Files\SimHub"
)
if "!SH!"=="" (
    echo.
    echo  ERROR: SimHub not found.
    echo         Install SimHub or set SIMHUB_PATH explicitly:
    echo         set SIMHUB_PATH=C:\Path\To\SimHub
    echo.
    pause
    exit /b 1
)
:: Strip trailing backslash if any
if "!SH:~-1!"=="\" set "SH=!SH:~0,-1!"
set "SH_EXE=!SH!\SimHubWPF.exe"

echo.
echo  Config:    %CONFIG%
echo  SimHub:    !SH!
echo  Project:   %PLUGIN_PROJ%
echo  Data:      %DATA_DIR%
echo.

:: ── 2. Verify project + data exist ─────────────────────────────
if not exist "%PLUGIN_PROJ%" (
    echo  ERROR: Plugin project not found at:
    echo         %PLUGIN_PROJ%
    pause
    exit /b 1
)
if not exist "%DATA_DIR%\" (
    echo  ERROR: Dataset directory not found at:
    echo         %DATA_DIR%
    pause
    exit /b 1
)

:: ── 3. Stop SimHub ─────────────────────────────────────────────
:: Order: PowerShell Stop-Process first (works in Parallels VMs
:: where taskkill may lack perms), then taskkill as fallback.
echo  [1/4] Stopping SimHub (if running)...
set "WAS_RUNNING=0"
for %%P in (SimHubWPF SimHub SimHubElectron) do (
    powershell -NoProfile -Command "if (Get-Process -Name '%%P' -ErrorAction SilentlyContinue) { Stop-Process -Name '%%P' -Force -ErrorAction SilentlyContinue }" 2>NUL
)
:: Confirm it's down so the DLL/data copies don't hit file locks.
for /L %%I in (1,1,15) do (
    powershell -NoProfile -Command "if (-not (Get-Process -Name 'SimHubWPF' -ErrorAction SilentlyContinue)) { exit 0 } else { exit 1 }" 2>NUL
    if !ERRORLEVEL! == 0 goto :stopped
    set "WAS_RUNNING=1"
    timeout /t 1 /nobreak >NUL
)
echo        WARNING: SimHub still running after 15s; force-killing.
taskkill /F /IM SimHubWPF.exe /T >NUL 2>&1
timeout /t 2 /nobreak >NUL

:stopped
:: Tiny grace so the OS releases file handles.
timeout /t 1 /nobreak >NUL
echo        OK.

:: ── 4. Build plugin ────────────────────────────────────────────
:: Set SIMHUB_PATH for the csproj so OutputPath points at SimHub
:: (it already does this when SimHub is detected; we're explicit
:: so the build is deterministic regardless of how SimHub was found).
::
:: CRITICAL: SIMHUB_PATH must end with '\' for the csproj's HintPaths
:: to resolve. They're written as `$(SimHubPath)GameReaderCommon.dll`
:: (no separator between path and filename), so a missing trailing
:: backslash mashes the dir into the filename and every SimHub
:: reference (GameReaderCommon, SimHub.Plugins, SimHub.Logging)
:: silently fails to resolve - producing a wall of CS0246 errors.
set "SIMHUB_PATH=!SH!\"
echo  [2/4] Building plugin (%CONFIG%)...
dotnet build "%PLUGIN_PROJ%" -c %CONFIG% --nologo
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ============================================
    echo   BUILD FAILED - SimHub will not be restarted
    echo  ============================================
    pause
    exit /b 1
)
echo        OK.

:: Sanity check the DLL actually landed.
if not exist "!SH!\RaceCorProDrive.dll" (
    echo.
    echo  ERROR: Build succeeded but RaceCorProDrive.dll is missing
    echo         from !SH!. The csproj's OutputPath logic may have
    echo         failed - check the build output above.
    pause
    exit /b 1
)

:: ── 5. Copy dataset ────────────────────────────────────────────
echo  [3/4] Copying dataset...
if not exist "!SH!\racecorprodrive-data\" mkdir "!SH!\racecorprodrive-data"
xcopy /E /Y /Q "%DATA_DIR%\*" "!SH!\racecorprodrive-data\" >NUL
if %ERRORLEVEL% NEQ 0 (
    echo  ERROR: Dataset copy failed.
    pause
    exit /b 1
)
echo        OK.

:: ── 5b. Unblock files (Mark-of-the-Web) ───────────────────────
:: Files copied from a network share (Parallels Z:\, SMB, etc.) or
:: downloaded over the internet get tagged with a Zone.Identifier
:: NTFS alternate data stream. SimHub silently refuses to load
:: tagged plugin DLLs - the plugin then doesn't even appear in
:: SimHub's plugin list, with no error UI. Strip those tags so
:: SimHub treats our files as locally-trusted.
echo  [3b]  Unblocking plugin files (Mark-of-the-Web)...
powershell -NoProfile -Command "Get-ChildItem '!SH!' -Filter 'RaceCorProDrive.*' -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue; Get-ChildItem '!SH!' -Filter '*.dll' -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue; Get-ChildItem '!SH!\racecorprodrive-data' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" 2>NUL
echo        OK.

:: ── 6. Restart SimHub ──────────────────────────────────────────
echo  [4/4] Launching SimHub...
echo        Path: !SH_EXE!
:: Reset ERRORLEVEL so the if-exist check below is clean.
cmd /c "exit /b 0"
if not exist "!SH_EXE!" (
    echo  ERROR: SimHubWPF.exe not found at !SH_EXE!
    pause
    exit /b 1
)
start "" "!SH_EXE!"
if %ERRORLEVEL% NEQ 0 (
    echo        WARNING: 'start' returned %ERRORLEVEL%, retrying directly...
    "!SH_EXE!"
)
echo        OK.

echo.
echo  ============================================
echo   Done. RaceCor ProDrive plugin installed.
echo  ============================================
echo.

endlocal
exit /b 0
