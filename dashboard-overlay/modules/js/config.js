// K10 Media Broadcaster Dashboard — Shared Configuration & State
// This module defines all global constants and state variables used across other modules.
// All variables are implicitly global (shared scope) since modules load via <script src> tags.

// ═══════════════════════════════════════════════════════════════
// SIMHUB HTTP API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const SIMHUB_URL = 'http://localhost:8889/k10mediabroadcaster/';
const POLL_MS = 33; // ~30fps

// All properties we need, batched into a single request
const PROP_KEYS = [
  'DataCorePlugin.GameRunning',
  'K10MediaBroadcaster.Plugin.GameId',
  'DataCorePlugin.GameData.Gear',
  'DataCorePlugin.GameData.Rpms',
  'DataCorePlugin.GameData.CarSettings_MaxRPM',
  'DataCorePlugin.GameData.SpeedMph',
  'DataCorePlugin.GameData.Throttle',
  'DataCorePlugin.GameData.Brake',
  'DataCorePlugin.GameData.Clutch',
  'DataCorePlugin.GameData.Fuel',
  'DataCorePlugin.GameData.MaxFuel',
  'DataCorePlugin.Computed.Fuel_LitersPerLap',
  'DataCorePlugin.GameData.RemainingLaps',
  'DataCorePlugin.GameData.TyreTempFrontLeft',
  'DataCorePlugin.GameData.TyreTempFrontRight',
  'DataCorePlugin.GameData.TyreTempRearLeft',
  'DataCorePlugin.GameData.TyreTempRearRight',
  'DataCorePlugin.GameData.TyreWearFrontLeft',
  'DataCorePlugin.GameData.TyreWearFrontRight',
  'DataCorePlugin.GameData.TyreWearRearLeft',
  'DataCorePlugin.GameData.TyreWearRearRight',
  'DataCorePlugin.GameRawData.Telemetry.dcBrakeBias',
  'DataCorePlugin.GameRawData.Telemetry.dcTractionControl',
  'DataCorePlugin.GameRawData.Telemetry.dcABS',
  'DataCorePlugin.GameRawData.Telemetry.dcAntiRollFront',
  'DataCorePlugin.GameRawData.Telemetry.dcAntiRollRear',
  'DataCorePlugin.GameData.Position',
  'DataCorePlugin.GameData.CurrentLap',
  'DataCorePlugin.GameData.BestLapTime',
  'DataCorePlugin.GameData.CarModel',
  'IRacingExtraProperties.iRacing_DriverInfo_IRating',
  'IRacingExtraProperties.iRacing_DriverInfo_SafetyRating',
  'IRacingExtraProperties.iRacing_Opponent_Ahead_Gap',
  'IRacingExtraProperties.iRacing_Opponent_Behind_Gap',
  'IRacingExtraProperties.iRacing_Opponent_Ahead_Name',
  'IRacingExtraProperties.iRacing_Opponent_Behind_Name',
  'IRacingExtraProperties.iRacing_Opponent_Ahead_IRating',
  'IRacingExtraProperties.iRacing_Opponent_Behind_IRating',
  'DataCorePlugin.GameRawData.Telemetry.FrameRate',
  'DataCorePlugin.GameRawData.Telemetry.SteeringWheelAngle',
  'DataCorePlugin.GameData.SessionTimeSpan',
  'DataCorePlugin.GameData.CurrentLapTime',
  'DataCorePlugin.GameData.LastLapTime',
  'DataCorePlugin.GameData.RemainingTime',
  'DataCorePlugin.GameData.TotalLaps',
  'K10MediaBroadcaster.Plugin.CommentaryVisible',
  'K10MediaBroadcaster.Plugin.CommentaryText',
  'K10MediaBroadcaster.Plugin.CommentaryTopicTitle',
  'K10MediaBroadcaster.Plugin.CommentaryTopicId',
  'K10MediaBroadcaster.Plugin.CommentaryCategory',
  'K10MediaBroadcaster.Plugin.CommentarySentimentColor',
  'K10MediaBroadcaster.Plugin.CommentarySeverity',
  'K10MediaBroadcaster.Plugin.SessionTypeName',
  // Demo mode properties
  'K10MediaBroadcaster.Plugin.DemoMode',
  'K10MediaBroadcaster.Plugin.Demo.Gear',
  'K10MediaBroadcaster.Plugin.Demo.Rpm',
  'K10MediaBroadcaster.Plugin.Demo.MaxRpm',
  'K10MediaBroadcaster.Plugin.Demo.SpeedMph',
  'K10MediaBroadcaster.Plugin.Demo.Throttle',
  'K10MediaBroadcaster.Plugin.Demo.Brake',
  'K10MediaBroadcaster.Plugin.Demo.Clutch',
  'K10MediaBroadcaster.Plugin.Demo.Fuel',
  'K10MediaBroadcaster.Plugin.Demo.MaxFuel',
  'K10MediaBroadcaster.Plugin.Demo.FuelPerLap',
  'K10MediaBroadcaster.Plugin.Demo.RemainingLaps',
  'K10MediaBroadcaster.Plugin.Demo.TyreTempFL',
  'K10MediaBroadcaster.Plugin.Demo.TyreTempFR',
  'K10MediaBroadcaster.Plugin.Demo.TyreTempRL',
  'K10MediaBroadcaster.Plugin.Demo.TyreTempRR',
  'K10MediaBroadcaster.Plugin.Demo.TyreWearFL',
  'K10MediaBroadcaster.Plugin.Demo.TyreWearFR',
  'K10MediaBroadcaster.Plugin.Demo.TyreWearRL',
  'K10MediaBroadcaster.Plugin.Demo.TyreWearRR',
  'K10MediaBroadcaster.Plugin.Demo.BrakeBias',
  'K10MediaBroadcaster.Plugin.Demo.TC',
  'K10MediaBroadcaster.Plugin.Demo.ABS',
  'K10MediaBroadcaster.Plugin.Demo.SessionTypeName',
  'K10MediaBroadcaster.Plugin.Demo.Position',
  'K10MediaBroadcaster.Plugin.Demo.CurrentLap',
  'K10MediaBroadcaster.Plugin.Demo.BestLapTime',
  'K10MediaBroadcaster.Plugin.Demo.CarModel',
  'K10MediaBroadcaster.Plugin.Demo.SessionTime',
  'K10MediaBroadcaster.Plugin.Demo.CurrentLapTime',
  'K10MediaBroadcaster.Plugin.Demo.LastLapTime',
  'K10MediaBroadcaster.Plugin.Demo.RemainingTime',
  'K10MediaBroadcaster.Plugin.Demo.TotalLaps',
  'K10MediaBroadcaster.Plugin.Demo.IRating',
  'K10MediaBroadcaster.Plugin.Demo.SafetyRating',
  'K10MediaBroadcaster.Plugin.Demo.GapAhead',
  'K10MediaBroadcaster.Plugin.Demo.GapBehind',
  'K10MediaBroadcaster.Plugin.Demo.DriverAhead',
  'K10MediaBroadcaster.Plugin.Demo.DriverBehind',
  'K10MediaBroadcaster.Plugin.Demo.IRAhead',
  'K10MediaBroadcaster.Plugin.Demo.IRBehind',
  // Datastream (advanced telemetry)
  'K10MediaBroadcaster.Plugin.DS.LatG',
  'K10MediaBroadcaster.Plugin.DS.LongG',
  'K10MediaBroadcaster.Plugin.DS.YawRate',
  'K10MediaBroadcaster.Plugin.DS.SteerTorque',
  'K10MediaBroadcaster.Plugin.DS.TrackTemp',
  'K10MediaBroadcaster.Plugin.DS.IncidentCount',
  'K10MediaBroadcaster.Plugin.DS.EstimatedIRatingDelta',
  'K10MediaBroadcaster.Plugin.DS.IRatingFieldSize',
  'K10MediaBroadcaster.Plugin.DS.AbsActive',
  'K10MediaBroadcaster.Plugin.DS.TcActive',
  'K10MediaBroadcaster.Plugin.DS.TrackPct',
  'K10MediaBroadcaster.Plugin.DS.LapDelta',
  'K10MediaBroadcaster.Plugin.DS.CurrentSector',
  'K10MediaBroadcaster.Plugin.DS.SectorSplitS1',
  'K10MediaBroadcaster.Plugin.DS.SectorSplitS2',
  'K10MediaBroadcaster.Plugin.DS.SectorSplitS3',
  'K10MediaBroadcaster.Plugin.DS.SectorDeltaS1',
  'K10MediaBroadcaster.Plugin.DS.SectorDeltaS2',
  'K10MediaBroadcaster.Plugin.DS.SectorDeltaS3',
  'K10MediaBroadcaster.Plugin.DS.SectorStateS1',
  'K10MediaBroadcaster.Plugin.DS.SectorStateS2',
  'K10MediaBroadcaster.Plugin.DS.SectorStateS3',
  'K10MediaBroadcaster.Plugin.DS.SectorS2StartPct',
  'K10MediaBroadcaster.Plugin.DS.SectorS3StartPct',
  'K10MediaBroadcaster.Plugin.DS.CompletedLaps',
  'K10MediaBroadcaster.Plugin.DS.IsInPitLane',
  'K10MediaBroadcaster.Plugin.DS.SpeedKmh',
  'K10MediaBroadcaster.Plugin.DS.PitLimiterOn',
  'K10MediaBroadcaster.Plugin.DS.PitSpeedLimitKmh',
  // Computed DS.* (server-side calculations)
  'K10MediaBroadcaster.Plugin.DS.ThrottleNorm',
  'K10MediaBroadcaster.Plugin.DS.BrakeNorm',
  'K10MediaBroadcaster.Plugin.DS.ClutchNorm',
  'K10MediaBroadcaster.Plugin.DS.RpmRatio',
  'K10MediaBroadcaster.Plugin.DS.FuelPct',
  'K10MediaBroadcaster.Plugin.DS.FuelLapsRemaining',
  'K10MediaBroadcaster.Plugin.DS.SpeedMph',
  'K10MediaBroadcaster.Plugin.DS.PitSpeedLimitMph',
  'K10MediaBroadcaster.Plugin.DS.IsPitSpeeding',
  'K10MediaBroadcaster.Plugin.DS.IsNonRaceSession',
  'K10MediaBroadcaster.Plugin.DS.IsTimedRace',
  'K10MediaBroadcaster.Plugin.DS.IsEndOfRace',
  'K10MediaBroadcaster.Plugin.DS.PositionDelta',
  'K10MediaBroadcaster.Plugin.DS.StartPosition',
  'K10MediaBroadcaster.Plugin.DS.RemainingTimeFormatted',
  'K10MediaBroadcaster.Plugin.DS.SpeedDisplay',
  'K10MediaBroadcaster.Plugin.DS.RpmDisplay',
  'K10MediaBroadcaster.Plugin.DS.FuelFormatted',
  'K10MediaBroadcaster.Plugin.DS.FuelPerLapFormatted',
  'K10MediaBroadcaster.Plugin.DS.PitSuggestion',
  'K10MediaBroadcaster.Plugin.DS.BBNorm',
  'K10MediaBroadcaster.Plugin.DS.TCNorm',
  'K10MediaBroadcaster.Plugin.DS.ABSNorm',
  'K10MediaBroadcaster.Plugin.DS.PositionDeltaDisplay',
  'K10MediaBroadcaster.Plugin.DS.LapDeltaDisplay',
  'K10MediaBroadcaster.Plugin.DS.SafetyRatingDisplay',
  'K10MediaBroadcaster.Plugin.DS.GapAheadFormatted',
  'K10MediaBroadcaster.Plugin.DS.GapBehindFormatted',
  // Demo Datastream
  'K10MediaBroadcaster.Plugin.Demo.DS.LatG',
  'K10MediaBroadcaster.Plugin.Demo.DS.LongG',
  'K10MediaBroadcaster.Plugin.Demo.DS.YawRate',
  'K10MediaBroadcaster.Plugin.Demo.DS.SteerTorque',
  'K10MediaBroadcaster.Plugin.Demo.DS.TrackTemp',
  'K10MediaBroadcaster.Plugin.Demo.DS.IncidentCount',
  'K10MediaBroadcaster.Plugin.Demo.DS.AbsActive',
  'K10MediaBroadcaster.Plugin.Demo.DS.TcActive',
  'K10MediaBroadcaster.Plugin.Demo.DS.LapDelta',
  'K10MediaBroadcaster.Plugin.Demo.DS.IsInPitLane',
  'K10MediaBroadcaster.Plugin.Demo.DS.SpeedKmh',
  'K10MediaBroadcaster.Plugin.Demo.DS.PitLimiterOn',
  'K10MediaBroadcaster.Plugin.Demo.DS.PitSpeedLimitKmh',
  // Demo Computed DS.*
  'K10MediaBroadcaster.Plugin.Demo.DS.ThrottleNorm',
  'K10MediaBroadcaster.Plugin.Demo.DS.BrakeNorm',
  'K10MediaBroadcaster.Plugin.Demo.DS.ClutchNorm',
  'K10MediaBroadcaster.Plugin.Demo.DS.RpmRatio',
  'K10MediaBroadcaster.Plugin.Demo.DS.FuelPct',
  'K10MediaBroadcaster.Plugin.Demo.DS.FuelLapsRemaining',
  'K10MediaBroadcaster.Plugin.Demo.DS.SpeedMph',
  'K10MediaBroadcaster.Plugin.Demo.DS.PitSpeedLimitMph',
  'K10MediaBroadcaster.Plugin.Demo.DS.IsPitSpeeding',
  'K10MediaBroadcaster.Plugin.Demo.DS.IsNonRaceSession',
  'K10MediaBroadcaster.Plugin.Demo.DS.IsTimedRace',
  'K10MediaBroadcaster.Plugin.Demo.DS.IsEndOfRace',
  'K10MediaBroadcaster.Plugin.Demo.DS.PositionDelta',
  'K10MediaBroadcaster.Plugin.Demo.DS.StartPosition',
  'K10MediaBroadcaster.Plugin.Demo.DS.RemainingTimeFormatted',
  'K10MediaBroadcaster.Plugin.Demo.DS.SpeedDisplay',
  'K10MediaBroadcaster.Plugin.Demo.DS.RpmDisplay',
  'K10MediaBroadcaster.Plugin.Demo.DS.FuelFormatted',
  'K10MediaBroadcaster.Plugin.Demo.DS.FuelPerLapFormatted',
  'K10MediaBroadcaster.Plugin.Demo.DS.PitSuggestion',
  'K10MediaBroadcaster.Plugin.Demo.DS.BBNorm',
  'K10MediaBroadcaster.Plugin.Demo.DS.TCNorm',
  'K10MediaBroadcaster.Plugin.Demo.DS.ABSNorm',
  'K10MediaBroadcaster.Plugin.Demo.DS.PositionDeltaDisplay',
  'K10MediaBroadcaster.Plugin.Demo.DS.LapDeltaDisplay',
  'K10MediaBroadcaster.Plugin.Demo.DS.SafetyRatingDisplay',
  'K10MediaBroadcaster.Plugin.Demo.DS.GapAheadFormatted',
  'K10MediaBroadcaster.Plugin.Demo.DS.GapBehindFormatted',
  // Track map
  'K10MediaBroadcaster.Plugin.TrackMap.Ready',
  'K10MediaBroadcaster.Plugin.TrackMap.SvgPath',
  'K10MediaBroadcaster.Plugin.TrackMap.PlayerX',
  'K10MediaBroadcaster.Plugin.TrackMap.PlayerY',
  'K10MediaBroadcaster.Plugin.TrackMap.Opponents',
  'DataCorePlugin.GameData.TrackName',
  // Leaderboard
  'K10MediaBroadcaster.Plugin.Leaderboard',
  // Driver name
  'K10MediaBroadcaster.Plugin.DriverFirstName',
  'K10MediaBroadcaster.Plugin.DriverLastName',
  // Flag status
  'currentFlagState',
  // Grid / Formation state
  'K10MediaBroadcaster.Plugin.Grid.SessionState',
  'K10MediaBroadcaster.Plugin.Grid.GriddedCars',
  'K10MediaBroadcaster.Plugin.Grid.TotalCars',
  'K10MediaBroadcaster.Plugin.Grid.PaceMode',
  'K10MediaBroadcaster.Plugin.Grid.StartType',
  'K10MediaBroadcaster.Plugin.Grid.LightsPhase',
  'K10MediaBroadcaster.Plugin.Demo.Grid.SessionState',
  'K10MediaBroadcaster.Plugin.Demo.Grid.GriddedCars',
  'K10MediaBroadcaster.Plugin.Demo.Grid.TotalCars',
  'K10MediaBroadcaster.Plugin.Demo.Grid.PaceMode',
  'K10MediaBroadcaster.Plugin.Demo.Grid.LightsPhase',
  'K10MediaBroadcaster.Plugin.Demo.Grid.StartType',
  'K10MediaBroadcaster.Plugin.Grid.TrackCountry',
  'K10MediaBroadcaster.Plugin.Demo.Grid.TrackCountry',
  // Pit Box (iRacing pit stop selections + car adjustments)
  'K10MediaBroadcaster.Plugin.PitBox.PitSvFlags',
  'K10MediaBroadcaster.Plugin.PitBox.PitSvFuel',
  'K10MediaBroadcaster.Plugin.PitBox.PitSvLFP',
  'K10MediaBroadcaster.Plugin.PitBox.PitSvRFP',
  'K10MediaBroadcaster.Plugin.PitBox.PitSvLRP',
  'K10MediaBroadcaster.Plugin.PitBox.PitSvRRP',
  'K10MediaBroadcaster.Plugin.PitBox.TireCompound',
  'K10MediaBroadcaster.Plugin.PitBox.FastRepair',
  'K10MediaBroadcaster.Plugin.PitBox.Windshield',
  'K10MediaBroadcaster.Plugin.PitBox.TireLF',
  'K10MediaBroadcaster.Plugin.PitBox.TireRF',
  'K10MediaBroadcaster.Plugin.PitBox.TireLR',
  'K10MediaBroadcaster.Plugin.PitBox.TireRR',
  'K10MediaBroadcaster.Plugin.PitBox.TiresRequested',
  'K10MediaBroadcaster.Plugin.PitBox.FuelRequested',
  'K10MediaBroadcaster.Plugin.PitBox.FastRepairRequested',
  'K10MediaBroadcaster.Plugin.PitBox.WindshieldRequested',
  'K10MediaBroadcaster.Plugin.PitBox.FuelDisplay',
  'K10MediaBroadcaster.Plugin.PitBox.PressureLF',
  'K10MediaBroadcaster.Plugin.PitBox.PressureRF',
  'K10MediaBroadcaster.Plugin.PitBox.PressureLR',
  'K10MediaBroadcaster.Plugin.PitBox.PressureRR',
  // Car-specific adjustment availability
  'K10MediaBroadcaster.Plugin.PitBox.HasTC',
  'K10MediaBroadcaster.Plugin.PitBox.HasABS',
  'K10MediaBroadcaster.Plugin.PitBox.HasARBFront',
  'K10MediaBroadcaster.Plugin.PitBox.HasARBRear',
  'K10MediaBroadcaster.Plugin.PitBox.HasEnginePower',
  'K10MediaBroadcaster.Plugin.PitBox.HasFuelMixture',
  'K10MediaBroadcaster.Plugin.PitBox.HasWeightJackerL',
  'K10MediaBroadcaster.Plugin.PitBox.HasWeightJackerR',
  'K10MediaBroadcaster.Plugin.PitBox.HasWingFront',
  'K10MediaBroadcaster.Plugin.PitBox.HasWingRear',
  // Additional car adjustments
  'DataCorePlugin.GameRawData.Telemetry.dcEnginePower',
  'DataCorePlugin.GameRawData.Telemetry.dcFuelMixture',
  'DataCorePlugin.GameRawData.Telemetry.dcWeightJackerLeft',
  'DataCorePlugin.GameRawData.Telemetry.dcWeightJackerRight',
  'DataCorePlugin.GameRawData.Telemetry.dcWingFront',
  'DataCorePlugin.GameRawData.Telemetry.dcWingRear'
];

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATE VARIABLES
// ═══════════════════════════════════════════════════════════════

// Polling & connection
let _pollFrame = 0;
let _pollActive = false;
let _connFails = 0;
let _backoffUntil = 0;
let _hasEverConnected = false;
let _settingsForcedByDisconnect = false;

// Game & session state
let _currentGameId = '';
let _isIRacing = true;
let _isRally = false;
let _rallyModeEnabled = false;
let _isIdle = true;
let _cycleFrameCount = 0;
let _prevLap = 0;

// Driver & car state
let _driverDisplayName = 'YOU';
let _lastCarModel = null;
let _lastDriverAhead = '';
let _lastDriverBehind = '';
let _lastPosition = 0;
let _gapsBestLap = 0;          // best lap time for gaps module (non-race)
let _gapsLastLap = 0;          // last completed lap for gaps module
let _gapsWorstLap = 0;         // worst valid lap time for gaps module
let _gapsLapNum = 0;           // current lap number for gaps module
let _gapsNonRaceMode = false;  // currently in non-race session
let _startPosition = 0;
let _prevBB = -1, _prevTC = -1, _prevABS = -1;
let _clutchSeenActive = false;
let _clutchHidden = false;

// Telemetry history
let _thrHist = new Array(20).fill(0);
let _brkHist = new Array(20).fill(0);
let _cltHist = new Array(20).fill(0);

// Flag & race control
let _lastFlagState = 'none';
let _greenFlagTimeout = null;
let _rcTimeout = null;
let _rcVisible = false;
let _flagHoldUntil = 0;
let _flagHoldState = 'none';
let _prevCheckered = false;
let _forceFlagState = '';

// Race end screen
let _raceEndVisible = false;
let _raceEndTimer = null;

// Timer & UI
let _timerHideTimeout = null;
let _timerPinned = false;
let _commentaryWasVisible = false;
let _tcSeen = false;
let _absSeen = false;
let _carAdj = null;  // result from getCarAdjustability() for current car

// Grid / Formation
let _gridActive = false;
let _gridLightsPhase = 0;
let _gridPrevSessionState = 4;
let _gridFadeTimer = null;

// Cycles & animations
const _cycleIntervalFrames = Math.round(10000 / POLL_MS); // 10s

// ═══════════════════════════════════════════════════════════════
// DEMO MODE MODELS
// ═══════════════════════════════════════════════════════════════

const _demoModels = {
  bmw:'M4 GT3', mclaren:'720S GT3', mazda:'MX-5 Cup', nissan:'GTP ZX-T',
  dallara:'IR-04', ferrari:'296 GT3', porsche:'911 GT3 R', audi:'R8 LMS',
  mercedes:'AMG GT3', lamborghini:'Huracán GT3', chevrolet:'Corvette Z06',
  ford:'Mustang GT3', toyota:'GR86', hyundai:'Elantra N TC',
  cadillac:'V-Series.R', astonmartin:'Vantage GT3', lotus:'Emira GT4',
  honda:'Civic Type R', ligier:'JS P320'
};

// ═══════════════════════════════════════════════════════════════
// MANUFACTURER BRANDING
// ═══════════════════════════════════════════════════════════════

const _defaultLogoBg = 'hsla(0, 0%, 12%, 1.0)';

const _mfrBrandColors = {
  bmw:         'hsla(204, 100%, 45%, 0.65)',
  mclaren:     'hsla(24, 100%, 52%, 0.65)',
  mazda:       'hsla(0, 90%, 44%, 0.65)',
  nissan:      'hsla(0, 85%, 50%, 0.65)',
  dallara:     'hsla(210, 85%, 48%, 0.65)',
  ferrari:     'hsla(0, 90%, 48%, 0.65)',
  porsche:     'hsla(0, 0%, 50%, 0.60)',
  audi:        'hsla(0, 0%, 50%, 0.60)',
  mercedes:    'hsla(175, 65%, 42%, 0.62)',
  lamborghini: 'hsla(48, 90%, 48%, 0.62)',
  chevrolet:   'hsla(40, 62%, 38%, 0.65)',
  ford:        'hsla(237, 100%, 28%, 0.65)',
  toyota:      'hsla(0, 85%, 48%, 0.65)',
  hyundai:     'hsla(216, 85%, 45%, 0.65)',
  cadillac:    'hsla(0, 0%, 50%, 0.60)',
  astonmartin: 'hsla(155, 70%, 38%, 0.65)',
  lotus:       'hsla(57, 100%, 50%, 0.65)',
  ligier:      'hsla(204, 78%, 40%, 0.65)',
  fia:         'hsla(228, 73%, 21%, 0.65)',
  radical:     'hsla(43, 82%, 57%, 0.65)'
};

const _mfrMap = {
  'bmw':'bmw', 'm4 gt':'bmw', 'm8 gte':'bmw', 'm hybrid':'bmw',
  'mclaren':'mclaren', 'mp4':'mclaren',
  'mazda':'mazda', 'mx-5':'mazda', 'miata':'mazda',
  'nissan':'nissan', 'gtp zx':'nissan', 'nismo':'nissan',
  'fia f4':'fia', 'fia':'fia',
  'dallara':'dallara', 'ir-01':'dallara', 'ir01':'dallara', 'ir-04':'dallara', 'ir04':'dallara',
  'ferrari':'ferrari', '488':'ferrari', '296':'ferrari', 'sf-23':'ferrari',
  'porsche':'porsche', '911':'porsche', 'cayman':'porsche', 'boxter':'porsche', '918':'porsche',
  'audi':'audi', 'r8':'audi', 'rs e-tron gt':'audi', 'e-tron gt':'audi',
  'mercedes':'mercedes', 'amg gt':'mercedes', 'hypercar':'mercedes',
  'lamborghini':'lamborghini', 'huracán':'lamborghini', 'huracan':'lamborghini', 'urus':'lamborghini',
  'chevrolet':'chevrolet', 'corvette':'chevrolet', 'chevy':'chevrolet', 'c8':'chevrolet',
  'ford':'ford', 'mustang':'ford', 'ford gt':'ford', 'mk iv':'ford',
  'toyota':'toyota', 'gr86':'toyota', 'gr corolla':'toyota',
  'hyundai':'hyundai', 'elantra':'hyundai', 'ioniq':'hyundai',
  'cadillac':'cadillac', 'v-series':'cadillac',
  'aston martin':'astonmartin', 'vantage':'astonmartin', 'dbs':'astonmartin',
  'lotus':'lotus', 'emira':'lotus', 'evija':'lotus',
  'honda':'honda', 'civic':'honda', 'nsx':'honda',
  'ligier':'ligier', 'js p3':'ligier', 'js p320':'ligier',
  'radical':'radical', 'sr10':'radical', 'sr8':'radical', 'sr3':'radical',
  'generic':'generic', 'none':'none'
};

/** Match a car model string to a manufacturer key in _mfrMap */
function detectMfr(model) {
  if (!model) return 'none';
  const l = ('' + model).toLowerCase();
  for (const k in _mfrMap) { if (l.indexOf(k) !== -1) return _mfrMap[k]; }
  return 'generic';
}

// ═══════════════════════════════════════════════════════════════
// CAR ADJUSTABILITY — cars that truly lack BB/ABS/TC systems
// These cars physically don't have the system, so we HIDE the module.
// Cars not listed here that report 0 are assumed FIXED (setup-locked).
// Each entry: substring match → { noBB, noABS, noTC, absNoAdjust }
// absNoAdjust: true = ABS exists but isn't adjustable by driver (show when active)
// noABS: true = no ABS system at all (hide completely)
// ═══════════════════════════════════════════════════════════════
const _carNoAdjust = [
  // Formula / Open-wheel (no ABS, no TC in almost all)
  { match: 'formula vee',      noBB: false, noABS: true, noTC: true },
  { match: 'skip barber',      noBB: false, noABS: true, noTC: true },
  { match: 'usf 2000',         noBB: false, noABS: true, noTC: true },
  { match: 'usf2000',          noBB: false, noABS: true, noTC: true },
  { match: 'indy pro 2000',    noBB: false, noABS: true, noTC: true },
  { match: 'formula 4',        noBB: false, noABS: true, noTC: true },
  { match: 'fia f4',           noBB: false, noABS: true, noTC: true },
  { match: 'ir-04',            noBB: false, noABS: true, noTC: true },
  { match: 'dallara f3',       noBB: false, noABS: true, noTC: true },
  { match: 'lotus 49',         noBB: true,  noABS: true, noTC: true },
  { match: 'lotus 79',         noBB: false, noABS: true, noTC: true },
  { match: 'mp4-30',           noBB: false, noABS: true, noTC: true },
  { match: 'w12',              noBB: false, noABS: true, noTC: true },
  { match: 'w13',              noBB: false, noABS: true, noTC: true },
  // LMP / Prototype (no ABS typically)
  { match: 'js p320',          noBB: false, noABS: true, noTC: false },
  { match: 'ligier js',        noBB: false, noABS: true, noTC: false },
  // Porsche Cup (no ABS, no TC on 992.1)
  { match: '992 cup',          noBB: false, noABS: true, noTC: true },
  { match: 'gt3 cup',          noBB: false, noABS: true, noTC: true },
  // V8 Supercars (no ABS, no TC)
  { match: 'supercars',        noBB: false, noABS: true, noTC: true },
  { match: 'supercar',         noBB: false, noABS: true, noTC: true },
  { match: 'ford falcon',      noBB: false, noABS: true, noTC: true },
  { match: 'holden commodore',  noBB: false, noABS: true, noTC: true },
  { match: 'gen3 camaro',      noBB: false, noABS: true, noTC: true },
  { match: 'gen3 mustang',     noBB: false, noABS: true, noTC: true },
  // Vintage / spec
  { match: 'spec racer',       noBB: false, noABS: true, noTC: true },
  { match: 'legends',          noBB: true,  noABS: true, noTC: true },
  { match: '34 ford',          noBB: true,  noABS: true, noTC: true },
  // Production-based (ABS exists but not adjustable, no TC in iRacing implementation)
  { match: 'mx-5 cup',         noBB: false, noABS: false, absNoAdjust: true, noTC: true },
  { match: 'mx-5 roadster',    noBB: false, noABS: false, absNoAdjust: true, noTC: true },
  { match: 'mx-5',             noBB: false, noABS: false, absNoAdjust: true, noTC: true },
  { match: 'gr86',             noBB: false, noABS: false, absNoAdjust: true, noTC: true },
  { match: 'solstice',         noBB: false, noABS: false, absNoAdjust: true, noTC: true },
  // NASCAR / Oval (no ABS, no TC)
  { match: 'nascar',           noBB: false, noABS: true, noTC: true },
  { match: 'gen 6',            noBB: false, noABS: true, noTC: true },
  { match: 'next gen',         noBB: false, noABS: true, noTC: true },
  { match: 'trucks',           noBB: false, noABS: true, noTC: true },
  { match: 'street stock',     noBB: true,  noABS: true, noTC: true },
  { match: 'late model',       noBB: false, noABS: true, noTC: true },
  { match: 'modified',         noBB: false, noABS: true, noTC: true },
  { match: 'silver crown',     noBB: false, noABS: true, noTC: true },
  { match: 'sprint car',       noBB: false, noABS: true, noTC: true },
  { match: 'midget',           noBB: false, noABS: true, noTC: true },
  { match: 'dirt',             noBB: false, noABS: true, noTC: true },
];

/** Check car model string against no-adjust list. Returns {noBB, noABS, noTC} or null. */
function getCarAdjustability(model) {
  if (!model) return null;
  const l = ('' + model).toLowerCase();
  for (const entry of _carNoAdjust) {
    if (l.indexOf(entry.match) !== -1) return entry;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS SYSTEM
// ═══════════════════════════════════════════════════════════════

const _defaultSettings = {
  showFuel: true, showTyres: true, showControls: true, showPedals: true,
  showMaps: true, showPosition: true, showTacho: true, showCommentary: true,
  showK10Logo: true, showCarLogo: true, showGameLogo: true, simhubUrl: 'http://localhost:8889/k10mediabroadcaster/',
  layoutPosition: 'top-right',
  greenScreen: false, showWebGL: true, showBonkers: true, ambientMode: 'reflective',
  zoom: 165, forceFlag: '', showLeaderboard: true, showDatastream: true, showPitBox: true, showIncidents: true, showSpotter: true,
  incPenalty: 17, incDQ: 25,
  discordUser: null,
  rallyMode: false,
  driveMode: false,
  // Leaderboard
  lbFocus: 'me',        // 'me' = center on player, 'lead' = show from P1
  lbMaxRows: 5,         // max visible opponent rows
  lbExpandToFill: false, // override lbMaxRows to fill available screen space
  // Datastream field toggles
  dsShowGforce: true,
  dsShowYaw: true,
  dsShowFfb: true,
  dsShowDelta: true,
  dsShowTrackTemp: true,
  dsShowFps: true
};

let _settings = Object.assign({}, _defaultSettings);

// Discord state
let _discordUser = null;

// Logo cycling
let _currentCarLogoIdx = 0;
let _currentCarLogo = '';
let _logoCycleTimer = null;  // Will be initialized when car-logos.js runs

// ─── Utility: session type detection ───
function _isNonRaceSession(sessionType) {
  if (!sessionType) return false;
  const s = sessionType.toLowerCase();
  return s.includes('practice') || s.includes('qualify') || s.includes('test') || s.includes('warmup') || s.includes('warm up');
}

// ─── Utility: format lap time (seconds → m:ss.xxx) ───
function _fmtLapTime(secs) {
  if (secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(3);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
