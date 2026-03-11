@echo off
setlocal enabledelayedexpansion

echo.
echo  Media Coach SimHub Plugin Exporter
echo  ====================================
echo  Copies built plugin files from SimHub back to the repo.
echo.

:: ---------------------------------------------------------------
:: Step 1: Locate SimHub directory
:: ---------------------------------------------------------------

if defined SIMHUB_PATH (
    set "SIMHUB_DIR=%SIMHUB_PATH%"
    goto :check_simhub
)

set "SIMHUB_DIR=%ProgramFiles(x86)%\SimHub"
if exist "%SIMHUB_DIR%\SimHubWPF.exe" goto :check_simhub

set "SIMHUB_DIR=%ProgramFiles%\SimHub"
if exist "%SIMHUB_DIR%\SimHubWPF.exe" goto :check_simhub

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
:: Step 2: Get script directory (repo root)
:: ---------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"

:: ---------------------------------------------------------------
:: Step 3: Copy DLL and PDB back to repo
:: ---------------------------------------------------------------

echo Copying MediaCoach.Plugin.dll...
if exist "%SIMHUB_DIR%\MediaCoach.Plugin.dll" (
    copy /Y "%SIMHUB_DIR%\MediaCoach.Plugin.dll" "%SCRIPT_DIR%MediaCoach.Plugin.dll" >NUL
    if errorlevel 1 goto :error
) else (
    echo WARNING: MediaCoach.Plugin.dll not found in SimHub directory.
)

echo Copying MediaCoach.Plugin.pdb...
if exist "%SIMHUB_DIR%\MediaCoach.Plugin.pdb" (
    copy /Y "%SIMHUB_DIR%\MediaCoach.Plugin.pdb" "%SCRIPT_DIR%MediaCoach.Plugin.pdb" >NUL
    if errorlevel 1 goto :error
) else (
    echo WARNING: MediaCoach.Plugin.pdb not found in SimHub directory.
)

:: ---------------------------------------------------------------
:: Step 4: Copy DashTemplates back (excluding _Backups)
:: ---------------------------------------------------------------

echo Copying DashTemplates (excluding _Backups)...
set "DASH_SRC=%SIMHUB_DIR%\DashTemplates\media coach"
set "DASH_DST=%SCRIPT_DIR%DashTemplates\media coach"

if not exist "%DASH_SRC%" (
    echo WARNING: Dashboard directory not found in SimHub.
    goto :done
)

:: Copy dashboard files (main files)
for %%f in (
    "media coach.djson"
    "media coach.djson.png"
    "media coach.djson.00.png"
    "media coach.djson.metadata"
) do (
    if exist "%DASH_SRC%\%%~f" (
        copy /Y "%DASH_SRC%\%%~f" "%DASH_DST%\%%~f" >NUL
    )
)

:: Copy JavascriptExtensions
if exist "%DASH_SRC%\JavascriptExtensions" (
    if not exist "%DASH_DST%\JavascriptExtensions" mkdir "%DASH_DST%\JavascriptExtensions"
    xcopy /E /Y "%DASH_SRC%\JavascriptExtensions\*" "%DASH_DST%\JavascriptExtensions\" >NUL
)

:: Copy _SHFonts
if exist "%DASH_SRC%\_SHFonts" (
    if not exist "%DASH_DST%\_SHFonts" mkdir "%DASH_DST%\_SHFonts"
    xcopy /E /Y "%DASH_SRC%\_SHFonts\*" "%DASH_DST%\_SHFonts\" >NUL
)

:: NOTE: _Backups directory is intentionally excluded from export

:done
echo.
echo  Export complete!
echo.
exit /b 0

:error
echo.
echo  Export FAILED. See errors above.
echo.
exit /b 1
