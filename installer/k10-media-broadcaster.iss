; ═══════════════════════════════════════════════════════════════
; K10 Media Broadcaster — Inno Setup Installer Script
; Installs both the SimHub plugin and the Electron overlay app.
; ═══════════════════════════════════════════════════════════════
;
; Prerequisites (build these BEFORE compiling this installer):
;   1. dotnet build the plugin  → produces K10MediaBroadcaster.Plugin.dll
;   2. npm run build:win        → produces dashboard-overlay/dist/win-unpacked/
;
; Compile with:
;   iscc installer/k10-media-broadcaster.iss
;
; Paths are relative to this .iss file's directory (installer/).

#define MyAppName      "K10 Media Broadcaster"
#define MyAppVersion   "1.0.0"
#define MyAppPublisher "Kevin Conboy"
#define MyAppURL       "https://github.com/alternatekev/media-coach-simhub-plugin"
#define MyAppExeName   "K10 Media Broadcaster.exe"

[Setup]
AppId={{A3F7E2D1-8B4C-4E6A-9D5F-1C2B3A4E5F6D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=output
OutputBaseFilename=K10-Media-Broadcaster-Setup-{#MyAppVersion}
SetupIconFile=..\dashboard-overlay\images\branding\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Types]
Name: "full";    Description: "Full installation (plugin + overlay)"
Name: "plugin";  Description: "SimHub plugin only"
Name: "overlay"; Description: "Overlay application only"
Name: "custom";  Description: "Custom installation"; Flags: iscustom

[Components]
Name: "plugin";  Description: "SimHub Plugin";            Types: full plugin custom
Name: "overlay"; Description: "Overlay Application";      Types: full overlay custom
Name: "overlay\desktop"; Description: "Desktop shortcut"; Types: full overlay

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Components: overlay; Flags: unchecked
Name: "startmenu";   Description: "Create Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Components: overlay

[Files]
; ── Overlay application (electron-builder win-unpacked output) ──
Source: "..\dashboard-overlay\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: overlay

; ── SimHub plugin DLL ──
Source: "..\simhub-plugin\K10MediaBroadcaster.Plugin.dll"; DestDir: "{code:GetSimHubDir}"; Flags: ignoreversion; Components: plugin
Source: "..\simhub-plugin\K10MediaBroadcaster.Plugin.pdb"; DestDir: "{code:GetSimHubDir}"; Flags: ignoreversion skipifsourcedoesntexist; Components: plugin

; ── Dataset files ──
Source: "..\simhub-plugin\k10-media-broadcaster-data\*"; DestDir: "{code:GetSimHubDir}\k10-media-broadcaster-data"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: plugin

; ── Stream Deck profile ──
Source: "..\dashboard-overlay\streamdeck\*"; DestDir: "{app}\streamdeck"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: overlay

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Components: overlay
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent; Components: overlay

[UninstallDelete]
Type: filesandordirs; Name: "{code:GetSimHubDir}\K10MediaBroadcaster.Plugin.dll"
Type: filesandordirs; Name: "{code:GetSimHubDir}\K10MediaBroadcaster.Plugin.pdb"
Type: filesandordirs; Name: "{code:GetSimHubDir}\k10-media-broadcaster-data"

[Code]
var
  SimHubDirPage: TInputDirWizardPage;
  SimHubDir: string;

function GetSimHubDir(Param: String): String;
begin
  Result := SimHubDir;
end;

function FindSimHub(): String;
var
  Dir: String;
begin
  Result := '';

  Dir := GetEnv('SIMHUB_PATH');
  if (Dir <> '') and FileExists(Dir + '\SimHubWPF.exe') then
  begin
    Result := Dir;
    Exit;
  end;

  Dir := ExpandConstant('{commonpf32}\SimHub');
  if FileExists(Dir + '\SimHubWPF.exe') then
  begin
    Result := Dir;
    Exit;
  end;

  Dir := ExpandConstant('{commonpf64}\SimHub');
  if FileExists(Dir + '\SimHubWPF.exe') then
  begin
    Result := Dir;
    Exit;
  end;

  if RegQueryStringValue(HKLM, 'SOFTWARE\SimHub', 'InstallDir', Dir) then
  begin
    if FileExists(Dir + '\SimHubWPF.exe') then
    begin
      Result := Dir;
      Exit;
    end;
  end;
end;

procedure InitializeWizard();
begin
  SimHubDir := FindSimHub();

  SimHubDirPage := CreateInputDirPage(
    wpSelectComponents,
    'Select SimHub Installation',
    'Where is SimHub installed?',
    'Select the folder where SimHubWPF.exe is located, then click Next.',
    False, '');
  SimHubDirPage.Add('');

  if SimHubDir <> '' then
    SimHubDirPage.Values[0] := SimHubDir
  else
    SimHubDirPage.Values[0] := ExpandConstant('{commonpf32}\SimHub');
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if PageID = SimHubDirPage.ID then
    Result := not WizardIsComponentSelected('plugin');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = SimHubDirPage.ID then
  begin
    SimHubDir := SimHubDirPage.Values[0];
    if not FileExists(SimHubDir + '\SimHubWPF.exe') then
    begin
      MsgBox('SimHubWPF.exe was not found in the selected directory.' + #13#10 +
             'Please select your SimHub installation folder.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function IsSimHubRunning(): Boolean;
var
  ExecResult: Integer;
begin
  Exec('cmd.exe', '/c tasklist /FI "IMAGENAME eq SimHubWPF.exe" | find /i "SimHubWPF.exe"',
       '', SW_HIDE, ewWaitUntilTerminated, ExecResult);
  Result := (ExecResult = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  KillResult: Integer;
begin
  Result := '';
  NeedsRestart := False;

  if WizardIsComponentSelected('plugin') then
  begin
    if IsSimHubRunning() then
    begin
      if MsgBox('SimHub is currently running. It must be closed before the plugin can be installed.' + #13#10#13#10 +
                'Close SimHub now and continue?', mbConfirmation, MB_YESNO) = IDYES then
      begin
        Exec('taskkill', '/F /IM SimHubWPF.exe', '', SW_HIDE, ewWaitUntilTerminated, KillResult);
        Sleep(2000);
      end
      else
        Result := 'SimHub must be closed before installing the plugin.';
    end;
  end;
end;
