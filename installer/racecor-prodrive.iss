; ═══════════════════════════════════════════════════════════════
; RaceCor.io — Inno Setup Installer Script
; Installs the SimHub plugin (telemetry engine, commentary, strategy)
; and the Electron overlay app (transparent HUD with WebGL effects).
;
; Supports both x64 and arm64 Windows. The installer bundles both
; architecture builds and installs the one matching the host OS.
; ═══════════════════════════════════════════════════════════════
;
; Prerequisites (build these BEFORE compiling this installer):
;   1. dotnet build the plugin  → produces RaceCorProDrive.dll
;   2. npm run build:win        → produces racecor-overlay/dist/win-unpacked/
;                                  and    racecor-overlay/dist/win-arm64-unpacked/
;
; Compile with:
;   iscc installer/racecorprodrive.iss
;
; Paths are relative to this .iss file's directory (installer/).

#define MyAppName      "RaceCor.io ProDrive"
#define MyAppVersion   "0.9.38"
#define MyAppPublisher "Kevin Conboy"
#define MyAppURL       "https://github.com/alternatekev/racecor"
#define MyAppExeName   "RaceCor.io.exe"

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
OutputBaseFilename=RaceCor-Setup-{#MyAppVersion}
SetupIconFile=..\racecor-overlay\images\branding\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
; Accept both x64 and arm64 machines
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
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
Name: "streamdeck"; Description: "Stream Deck Plugin"; Types: full custom; Check: IsStreamDeckInstalled

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Components: overlay; Flags: unchecked
Name: "startmenu";   Description: "Create Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Components: overlay

[Files]
; ── Overlay application: x64 build (installed on x64 machines) ──
Source: "..\racecor-overlay\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: overlay; Check: not IsArm64

; ── Overlay application: arm64 build (installed on arm64 machines) ──
Source: "..\racecor-overlay\dist\win-arm64-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs solidbreak; Components: overlay; Check: IsArm64

; ── SimHub plugin DLL (AnyCPU — works on both architectures) ──
Source: "..\racecor-plugin\simhub-plugin\RaceCorProDrive.dll"; DestDir: "{code:GetSimHubDir}"; Flags: ignoreversion; Components: plugin
Source: "..\racecor-plugin\simhub-plugin\RaceCorProDrive.pdb"; DestDir: "{code:GetSimHubDir}"; Flags: ignoreversion skipifsourcedoesntexist; Components: plugin

; ── Dataset files ──
Source: "..\racecor-plugin\simhub-plugin\racecorprodrive-data\*"; DestDir: "{code:GetSimHubDir}\racecorprodrive-data"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: plugin

; ── Stream Deck plugin (installed to user's StreamDeck Plugins directory) ──
Source: "..\racecor-overlay\streamdeck\racecor\com.k10motorsports.racecor.overlay.sdPlugin\*"; DestDir: "{userappdata}\Elgato\StreamDeck\Plugins\com.k10motorsports.racecor.overlay.sdPlugin"; Excludes: "logs,logs\*"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: streamdeck

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Components: overlay
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent; Components: overlay

[InstallDelete]
; ── Remove legacy plugin DLLs from all previous assembly names ──
; The old assemblies must be deleted AND their config entries cleaned up (see
; CleanLegacyPluginConfig in [Code]), otherwise SimHub crashes on startup
; trying to resolve the missing type from a stale PluginsConfiguration.json entry.
Type: files; Name: "{code:GetSimHubDir}\K10Motorsports.dll"
Type: files; Name: "{code:GetSimHubDir}\K10Motorsports.pdb"
Type: files; Name: "{code:GetSimHubDir}\K10MediaBroadcaster.dll"
Type: files; Name: "{code:GetSimHubDir}\K10MediaBroadcaster.pdb"
Type: files; Name: "{code:GetSimHubDir}\RaceCor-ioProDrive.dll"
Type: files; Name: "{code:GetSimHubDir}\RaceCor-ioProDrive.pdb"

[UninstallDelete]
Type: filesandordirs; Name: "{code:GetSimHubDir}\RaceCorProDrive.dll"
Type: filesandordirs; Name: "{code:GetSimHubDir}\RaceCorProDrive.pdb"
Type: filesandordirs; Name: "{code:GetSimHubDir}\racecorprodrive-data"
Type: filesandordirs; Name: "{userappdata}\Elgato\StreamDeck\Plugins\com.k10motorsports.racecor.overlay.sdPlugin"

[Code]
var
  SimHubDirPage: TInputDirWizardPage;
  SimHubDir: string;

function GetSimHubDir(Param: String): String;
begin
  Result := SimHubDir;
end;

// ── Architecture detection ──────────────────────────────────────
// Inno Setup 6.3+ has IsArm64 built in. For older versions we
// fall back to checking the PROCESSOR_ARCHITECTURE env var.
function IsArm64: Boolean;
begin
  Result := (ProcessorArchitecture = paARM64);
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

// ── Legacy plugin config cleanup ────────────────────────────────
// SimHub serialises enabled-plugin references by assembly-qualified
// type name.  When an old DLL is deleted, SimHub still tries to
// resolve the type at startup and crashes before it reaches the
// enable/disable gate.  This procedure strips stale entries from
// PluginsConfiguration.json so SimHub starts cleanly.
//
// Legacy assembly names (oldest → newest):
//   K10MediaBroadcaster → K10Motorsports → RaceCorProDrive → RaceCorProDrive

procedure RemovePluginConfigEntry(var Content: AnsiString; const SearchKey: String);
var
  UpperContent: String;
  StartPos, EndPos, BraceDepth, I: Integer;
begin
  UpperContent := Uppercase(Content);
  StartPos := Pos(Uppercase(SearchKey), UpperContent);
  if StartPos = 0 then
    Exit;

  { Walk backwards to find the opening brace of this plugin entry }
  I := StartPos;
  while (I > 1) and (Content[I] <> '{') do
    I := I - 1;
  if I < 1 then
    Exit;
  StartPos := I;

  { Walk forward to find the matching closing brace }
  BraceDepth := 0;
  EndPos := StartPos;
  for I := StartPos to Length(Content) do
  begin
    if Content[I] = '{' then
      BraceDepth := BraceDepth + 1
    else if Content[I] = '}' then
    begin
      BraceDepth := BraceDepth - 1;
      if BraceDepth = 0 then
      begin
        EndPos := I;
        Break;
      end;
    end;
  end;

  { Remove trailing comma if present }
  if (EndPos < Length(Content)) and (Content[EndPos + 1] = ',') then
    EndPos := EndPos + 1
  { Or leading comma }
  else if (StartPos > 1) and (Content[StartPos - 1] = ',') then
    StartPos := StartPos - 1;

  Delete(Content, StartPos, EndPos - StartPos + 1);
  Log('Removed legacy plugin config entry matching: ' + SearchKey);
end;

procedure CleanLegacyPluginConfig();
var
  ConfigPath: String;
  Content: AnsiString;
begin
  ConfigPath := SimHubDir + '\PluginsConfiguration.json';
  if not FileExists(ConfigPath) then
    Exit;

  if not LoadStringFromFile(ConfigPath, Content) then
    Exit;

  RemovePluginConfigEntry(Content, '"K10MediaBroadcaster');
  RemovePluginConfigEntry(Content, '"K10Motorsports');
  RemovePluginConfigEntry(Content, '"RaceCorProDrive');

  SaveStringToFile(ConfigPath, Content, False);
end;

// ── Stream Deck detection ───────────────────────────────────────
// Returns True if the Elgato Stream Deck Plugins directory exists,
// indicating Stream Deck is installed. Used as a Check function on
// the streamdeck component so it only appears when relevant.
function IsStreamDeckInstalled(): Boolean;
begin
  Result := DirExists(ExpandConstant('{userappdata}\Elgato\StreamDeck\Plugins'));
end;

function IsStreamDeckRunning(): Boolean;
var
  ExecResult: Integer;
begin
  Exec('cmd.exe', '/c tasklist /FI "IMAGENAME eq StreamDeck.exe" | find /i "StreamDeck.exe"',
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

    { Clean legacy plugin reference so SimHub doesn't crash on next launch }
    if Result = '' then
      CleanLegacyPluginConfig();
  end;

  { Stream Deck: warn if running, remove old version before install }
  if (Result = '') and WizardIsComponentSelected('streamdeck') then
  begin
    if IsStreamDeckRunning() then
      MsgBox('Stream Deck is currently running.' + #13#10#13#10 +
             'The plugin will be installed, but you will need to restart ' +
             'Stream Deck for it to take effect.', mbInformation, MB_OK);

    { Remove previous version so we get a clean install }
    if DirExists(ExpandConstant('{userappdata}\Elgato\StreamDeck\Plugins\com.k10motorsports.racecor.overlay.sdPlugin')) then
    begin
      DelTree(ExpandConstant('{userappdata}\Elgato\StreamDeck\Plugins\com.k10motorsports.racecor.overlay.sdPlugin'), True, True, True);
      Log('Removed previous Stream Deck plugin');
    end;
  end;
end;
