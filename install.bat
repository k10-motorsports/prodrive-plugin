@echo off
setlocal enabledelayedexpansion

title Media Coach Plugin Installer

echo.
echo  ============================================
echo   Media Coach - SimHub Plugin Installer
echo  ============================================
echo.

:: -------------------------------------------------------------------
:: 1. Find SimHub installation
:: -------------------------------------------------------------------

set "SIMHUB_DIR="

:: Check common install locations
if exist "C:\Program Files (x86)\SimHub\SimHubWPF.exe" (
    set "SIMHUB_DIR=C:\Program Files (x86)\SimHub"
)
if exist "C:\Program Files\SimHub\SimHubWPF.exe" (
    set "SIMHUB_DIR=C:\Program Files\SimHub"
)

:: Check environment variable override
if defined SIMHUB_PATH (
    if exist "!SIMHUB_PATH!\SimHubWPF.exe" (
        set "SIMHUB_DIR=!SIMHUB_PATH!"
    )
)

:: If not found, ask the user
if not defined SIMHUB_DIR (
    echo  SimHub was not found in the default location.
    echo  Enter your SimHub installation folder:
    echo  (e.g., D:\SimHub or C:\Program Files ^(x86^)\SimHub)
    echo.
    set /p "SIMHUB_DIR=  Path: "
    if not exist "!SIMHUB_DIR!\SimHubWPF.exe" (
        echo.
        echo  ERROR: SimHubWPF.exe not found in "!SIMHUB_DIR!"
        echo  Make sure SimHub is installed and try again.
        echo.
        pause
        exit /b 1
    )
)

echo  Found SimHub at: %SIMHUB_DIR%
echo.

:: -------------------------------------------------------------------
:: 2. Check that SimHub is not running
:: -------------------------------------------------------------------

tasklist /FI "IMAGENAME eq SimHubWPF.exe" 2>NUL | find /I "SimHubWPF.exe" >NUL
if %ERRORLEVEL%==0 (
    echo  WARNING: SimHub is currently running.
    echo  Close SimHub before installing to avoid file lock issues.
    echo.
    set /p "CONTINUE=  Continue anyway? (y/n): "
    if /I not "!CONTINUE!"=="y" (
        echo  Installation cancelled.
        pause
        exit /b 0
    )
    echo.
)

:: -------------------------------------------------------------------
:: 3. Determine script directory (where this .bat lives = repo root)
:: -------------------------------------------------------------------

set "REPO_DIR=%~dp0"
:: Remove trailing backslash
if "%REPO_DIR:~-1%"=="\" set "REPO_DIR=%REPO_DIR:~0,-1%"

:: -------------------------------------------------------------------
:: 4. Copy plugin DLL
:: -------------------------------------------------------------------

echo  [1/3] Installing plugin DLL...

if exist "%REPO_DIR%\MediaCoach.Plugin.dll" (
    copy /Y "%REPO_DIR%\MediaCoach.Plugin.dll" "%SIMHUB_DIR%\MediaCoach.Plugin.dll" >NUL
    if !ERRORLEVEL! NEQ 0 (
        echo        FAILED - could not copy DLL. Is SimHub running?
        goto :error
    )
    echo        OK - MediaCoach.Plugin.dll
) else (
    echo        SKIPPED - MediaCoach.Plugin.dll not found in repo root.
    echo        Build the plugin first, or copy the DLL to the repo root.
    echo        See docs\DEVELOPMENT.md for build instructions.
    goto :error
)

:: Copy PDB if present (optional, for debugging)
if exist "%REPO_DIR%\MediaCoach.Plugin.pdb" (
    copy /Y "%REPO_DIR%\MediaCoach.Plugin.pdb" "%SIMHUB_DIR%\MediaCoach.Plugin.pdb" >NUL
)

:: -------------------------------------------------------------------
:: 5. Copy dataset folder
:: -------------------------------------------------------------------

echo  [2/3] Installing dataset files...

if exist "%REPO_DIR%\dataset" (
    xcopy /E /Y /I /Q "%REPO_DIR%\dataset" "%SIMHUB_DIR%\dataset" >NUL
    if !ERRORLEVEL! NEQ 0 (
        echo        FAILED - could not copy dataset folder.
        goto :error
    )
    echo        OK - dataset\
) else (
    echo        FAILED - dataset folder not found.
    goto :error
)

:: -------------------------------------------------------------------
:: 6. Copy dashboard templates
:: -------------------------------------------------------------------

echo  [3/3] Installing dashboard template...

if exist "%REPO_DIR%\DashTemplates" (
    xcopy /E /Y /I /Q "%REPO_DIR%\DashTemplates" "%SIMHUB_DIR%\DashTemplates" >NUL
    if !ERRORLEVEL! NEQ 0 (
        echo        FAILED - could not copy dashboard templates.
        goto :error
    )
    echo        OK - DashTemplates\media coach\
) else (
    echo        SKIPPED - DashTemplates folder not found.
)

:: -------------------------------------------------------------------
:: 7. Done
:: -------------------------------------------------------------------

echo.
echo  ============================================
echo   Installation complete.
echo  ============================================
echo.
echo  Next steps:
echo    1. Launch SimHub
echo    2. Go to the plugin list and enable Media Coach
echo    3. Open the "media coach" dashboard template
echo.
pause
exit /b 0

:error
echo.
echo  Installation failed. See errors above.
echo.
pause
exit /b 1
