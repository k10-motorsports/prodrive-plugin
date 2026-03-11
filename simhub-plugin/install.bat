@echo off
setlocal enabledelayedexpansion

echo.
echo  Media Coach SimHub Plugin Installer
echo  ====================================
echo.

:: ---------------------------------------------------------------
:: Step 1: Locate SimHub directory
:: ---------------------------------------------------------------

:: Check environment variable first
if defined SIMHUB_PATH (
    set "SIMHUB_DIR=%SIMHUB_PATH%"
    goto :check_simhub
)

:: Check default install locations
set "SIMHUB_DIR=%ProgramFiles(x86)%\SimHub"
if exist "%SIMHUB_DIR%\SimHubWPF.exe" goto :check_simhub

set "SIMHUB_DIR=%ProgramFiles%\SimHub"
if exist "%SIMHUB_DIR%\SimHubWPF.exe" goto :check_simhub

:: Prompt user
echo SimHub installation not found in default locations.
echo Please set SIMHUB_PATH environment variable and re-run.
goto :error

:check_simhub
if not exist "%SIMHUB_DIR%\SimHubWPF.exe" (
    echo ERROR: SimHubWPF.exe not found in %SIMHUB_DIR%
    goto :error
)

echo Found SimHub at: %SIMHUB_DIR%

:: ---------------------------------------------------------------
:: Step 2: Check SimHub is not running
:: ---------------------------------------------------------------

tasklist /FI "IMAGENAME eq SimHubWPF.exe" 2>NUL | find /I /N "SimHubWPF.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo ERROR: SimHub is currently running. Please close it before installing.
    goto :error
)

:: ---------------------------------------------------------------
:: Step 3: Get script directory (repo root)
:: ---------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"

:: ---------------------------------------------------------------
:: Step 4: Copy plugin DLL
:: ---------------------------------------------------------------

echo Copying MediaCoach.Plugin.dll...
copy /Y "%SCRIPT_DIR%MediaCoach.Plugin.dll" "%SIMHUB_DIR%\MediaCoach.Plugin.dll" >NUL
if errorlevel 1 goto :error

:: Copy PDB if present (debug symbols)
if exist "%SCRIPT_DIR%MediaCoach.Plugin.pdb" (
    echo Copying MediaCoach.Plugin.pdb...
    copy /Y "%SCRIPT_DIR%MediaCoach.Plugin.pdb" "%SIMHUB_DIR%\MediaCoach.Plugin.pdb" >NUL
)

:: ---------------------------------------------------------------
:: Step 5: Copy dataset files
:: ---------------------------------------------------------------

echo Copying dataset files...
if not exist "%SIMHUB_DIR%\dataset" mkdir "%SIMHUB_DIR%\dataset"

for %%f in (
    commentary_topics.json
    commentary_fragments.json
    sentiments.json
    channel_notes.json
    commentary_sources.json
) do (
    copy /Y "%SCRIPT_DIR%dataset\%%f" "%SIMHUB_DIR%\dataset\%%f" >NUL
    if errorlevel 1 goto :error
)

:: ---------------------------------------------------------------
:: Step 6: Copy DashTemplates
:: ---------------------------------------------------------------

echo Copying DashTemplates...
xcopy /E /I /Y "%SCRIPT_DIR%DashTemplates" "%SIMHUB_DIR%\DashTemplates" >NUL
if errorlevel 1 goto :error

:: ---------------------------------------------------------------
:: Done
:: ---------------------------------------------------------------

echo.
echo  Installation complete!
echo  Start SimHub to activate the Media Coach plugin.
echo.
exit /b 0

:error
echo.
echo  Installation FAILED. See errors above.
echo.
exit /b 1
