@echo off
setlocal enabledelayedexpansion

title Media Coach - Export Built Files to Repo

echo.
echo  ============================================
echo   Media Coach - Export Built Files to Repo
echo  ============================================
echo.
echo  Copies the built DLL, PDB, and dashboard
echo  template from your SimHub directory back
echo  into this repository for commit.
echo.

:: -------------------------------------------------------------------
:: 1. Find SimHub installation
:: -------------------------------------------------------------------

set "SIMHUB_DIR="

if exist "C:\Program Files (x86)\SimHub\SimHubWPF.exe" (
    set "SIMHUB_DIR=C:\Program Files (x86)\SimHub"
)
if exist "C:\Program Files\SimHub\SimHubWPF.exe" (
    set "SIMHUB_DIR=C:\Program Files\SimHub"
)

if defined SIMHUB_PATH (
    if exist "!SIMHUB_PATH!\SimHubWPF.exe" (
        set "SIMHUB_DIR=!SIMHUB_PATH!"
    )
)

if not defined SIMHUB_DIR (
    echo  SimHub was not found in the default location.
    echo  Enter your SimHub installation folder:
    echo.
    set /p "SIMHUB_DIR=  Path: "
    if not exist "!SIMHUB_DIR!\SimHubWPF.exe" (
        echo.
        echo  ERROR: SimHubWPF.exe not found in "!SIMHUB_DIR!"
        echo.
        pause
        exit /b 1
    )
)

echo  SimHub directory: %SIMHUB_DIR%
echo.

:: -------------------------------------------------------------------
:: 2. Determine repo root (where this .bat lives)
:: -------------------------------------------------------------------

set "REPO_DIR=%~dp0"
if "%REPO_DIR:~-1%"=="\" set "REPO_DIR=%REPO_DIR:~0,-1%"

:: -------------------------------------------------------------------
:: 3. Export DLL + PDB
:: -------------------------------------------------------------------

echo  [1/2] Exporting plugin binaries...

if exist "%SIMHUB_DIR%\MediaCoach.Plugin.dll" (
    copy /Y "%SIMHUB_DIR%\MediaCoach.Plugin.dll" "%REPO_DIR%\MediaCoach.Plugin.dll" >NUL
    if !ERRORLEVEL! NEQ 0 (
        echo        FAILED - could not copy DLL. Is SimHub running?
        goto :error
    )
    echo        OK - MediaCoach.Plugin.dll
) else (
    echo        SKIPPED - MediaCoach.Plugin.dll not found in SimHub directory.
    echo        Build the plugin first (dotnet build).
    goto :error
)

if exist "%SIMHUB_DIR%\MediaCoach.Plugin.pdb" (
    copy /Y "%SIMHUB_DIR%\MediaCoach.Plugin.pdb" "%REPO_DIR%\MediaCoach.Plugin.pdb" >NUL
    echo        OK - MediaCoach.Plugin.pdb
) else (
    echo        SKIPPED - MediaCoach.Plugin.pdb not found (Release build?)
)

:: -------------------------------------------------------------------
:: 4. Export dashboard template (excluding _Backups)
:: -------------------------------------------------------------------

echo  [2/2] Exporting dashboard template...

set "DASH_SRC=%SIMHUB_DIR%\DashTemplates\media coach"
set "DASH_DST=%REPO_DIR%\DashTemplates\media coach"

if exist "%DASH_SRC%" (
    :: Copy the main djson and assets
    if not exist "%DASH_DST%" mkdir "%DASH_DST%"

    :: Core dashboard files
    for %%F in (
        "media coach.djson"
        "media coach.djson.png"
        "media coach.djson.00.png"
        "media coach.djson.metadata"
    ) do (
        if exist "%DASH_SRC%\%%~F" (
            copy /Y "%DASH_SRC%\%%~F" "%DASH_DST%\%%~F" >NUL
        )
    )

    :: JavascriptExtensions subfolder
    if exist "%DASH_SRC%\JavascriptExtensions" (
        if not exist "%DASH_DST%\JavascriptExtensions" mkdir "%DASH_DST%\JavascriptExtensions"
        xcopy /E /Y /Q "%DASH_SRC%\JavascriptExtensions" "%DASH_DST%\JavascriptExtensions" >NUL
    )

    :: _SHFonts subfolder
    if exist "%DASH_SRC%\_SHFonts" (
        if not exist "%DASH_DST%\_SHFonts" mkdir "%DASH_DST%\_SHFonts"
        xcopy /E /Y /Q "%DASH_SRC%\_SHFonts" "%DASH_DST%\_SHFonts" >NUL
    )

    :: Videos subfolder (if it has content)
    if exist "%DASH_SRC%\Videos" (
        if not exist "%DASH_DST%\Videos" mkdir "%DASH_DST%\Videos"
        xcopy /E /Y /Q "%DASH_SRC%\Videos" "%DASH_DST%\Videos" >NUL 2>NUL
    )

    :: Explicitly NOT copying _Backups — those stay in SimHub only
    echo        OK - DashTemplates\media coach\
    echo        NOTE: _Backups directory was excluded (SimHub-local only)
) else (
    echo        SKIPPED - Dashboard template not found in SimHub.
    echo        Open and save the dashboard in SimHub first.
)

:: -------------------------------------------------------------------
:: 5. Summary
:: -------------------------------------------------------------------

echo.
echo  ============================================
echo   Export complete.
echo  ============================================
echo.
echo  Exported files:
echo    %REPO_DIR%\MediaCoach.Plugin.dll
if exist "%REPO_DIR%\MediaCoach.Plugin.pdb" (
    echo    %REPO_DIR%\MediaCoach.Plugin.pdb
)
echo    %REPO_DIR%\DashTemplates\media coach\
echo.
echo  NOTE: Dataset files are NOT exported from SimHub.
echo  The dataset/ folder in the repo is the source of
echo  truth. Edit dataset files in the repo, then use
echo  install.bat or rebuild to push them to SimHub.
echo.
echo  Ready to commit. Run:
echo    git add MediaCoach.Plugin.dll MediaCoach.Plugin.pdb DashTemplates/
echo    git commit -m "Update built plugin and dashboard"
echo.
pause
exit /b 0

:error
echo.
echo  Export failed. See errors above.
echo.
pause
exit /b 1
