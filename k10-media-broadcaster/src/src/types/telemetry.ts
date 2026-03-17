/**
 * Complete telemetry data types matching the K10 Media Broadcaster plugin API.
 * Properties map directly to SimHub DataCore and plugin-specific properties.
 */

/**
 * Core telemetry snapshot from the plugin HTTP server.
 * All properties are optional in the raw response; the client fills in defaults.
 */
export interface TelemetryProps {
  // ═══ Core Engine Data ═══
  'DataCorePlugin.GameRunning': number;
  'DataCorePlugin.GameData.Gear': string;
  'DataCorePlugin.GameData.Rpms': number;
  'DataCorePlugin.GameData.CarSettings_MaxRPM': number;
  'DataCorePlugin.GameData.SpeedMph': number;
  'DataCorePlugin.GameData.Throttle': number;
  'DataCorePlugin.GameData.Brake': number;
  'DataCorePlugin.GameData.Clutch': number;

  // ═══ Fuel ═══
  'DataCorePlugin.GameData.Fuel': number;
  'DataCorePlugin.GameData.MaxFuel': number;
  'DataCorePlugin.Computed.Fuel_LitersPerLap': number;
  'DataCorePlugin.GameData.RemainingLaps': number;

  // ═══ Tyres ═══
  'DataCorePlugin.GameData.TyreTempFrontLeft': number;
  'DataCorePlugin.GameData.TyreTempFrontRight': number;
  'DataCorePlugin.GameData.TyreTempRearLeft': number;
  'DataCorePlugin.GameData.TyreTempRearRight': number;
  'DataCorePlugin.GameData.TyreWearFrontLeft': number;
  'DataCorePlugin.GameData.TyreWearFrontRight': number;
  'DataCorePlugin.GameData.TyreWearRearLeft': number;
  'DataCorePlugin.GameData.TyreWearRearRight': number;

  // ═══ Brake / TC / ABS ═══
  'DataCorePlugin.GameRawData.Telemetry.dcBrakeBias': number;
  'DataCorePlugin.GameRawData.Telemetry.dcTractionControl': number;
  'DataCorePlugin.GameRawData.Telemetry.dcABS': number;

  // ═══ Position & Opponents ═══
  'DataCorePlugin.GameData.Position': number;
  'IRacingExtraProperties.iRacing_Opponent_Ahead_Gap': number;
  'IRacingExtraProperties.iRacing_Opponent_Behind_Gap': number;
  'IRacingExtraProperties.iRacing_Opponent_Ahead_Name': string;
  'IRacingExtraProperties.iRacing_Opponent_Behind_Name': string;
  'IRacingExtraProperties.iRacing_Opponent_Ahead_IRating': number;
  'IRacingExtraProperties.iRacing_Opponent_Behind_IRating': number;

  // ═══ Lap Timing ═══
  'DataCorePlugin.GameData.CurrentLap': number;
  'DataCorePlugin.GameData.BestLapTime': number;
  'DataCorePlugin.GameData.CurrentLapTime': number;
  'DataCorePlugin.GameData.LastLapTime': number;
  'DataCorePlugin.GameData.TotalLaps': number;
  'DataCorePlugin.GameData.SessionTimeSpan': number;
  'DataCorePlugin.GameData.RemainingTime': number;

  // ═══ iRating & Safety ═══
  'IRacingExtraProperties.iRacing_DriverInfo_IRating': number;
  'IRacingExtraProperties.iRacing_DriverInfo_SafetyRating': number;

  // ═══ Vehicle ═══
  'DataCorePlugin.GameData.CarModel': string;

  // ═══ Commentary (K10 Plugin) ═══
  'K10MediaBroadcaster.Plugin.CommentaryVisible': number;
  'K10MediaBroadcaster.Plugin.CommentaryText': string;
  'K10MediaBroadcaster.Plugin.CommentaryTopicTitle': string;
  'K10MediaBroadcaster.Plugin.CommentaryTopicId': string;
  'K10MediaBroadcaster.Plugin.CommentaryCategory': string;
  'K10MediaBroadcaster.Plugin.CommentarySentimentColor': string;
  'K10MediaBroadcaster.Plugin.CommentarySeverity': number;

  // ═══ Demo Mode ═══
  'K10MediaBroadcaster.Plugin.DemoMode': number;
  'K10MediaBroadcaster.Plugin.Demo.Gear': string;
  'K10MediaBroadcaster.Plugin.Demo.Rpm': number;
  'K10MediaBroadcaster.Plugin.Demo.MaxRpm': number;
  'K10MediaBroadcaster.Plugin.Demo.SpeedMph': number;
  'K10MediaBroadcaster.Plugin.Demo.Throttle': number;
  'K10MediaBroadcaster.Plugin.Demo.Brake': number;
  'K10MediaBroadcaster.Plugin.Demo.Clutch': number;
  'K10MediaBroadcaster.Plugin.Demo.Fuel': number;
  'K10MediaBroadcaster.Plugin.Demo.MaxFuel': number;
  'K10MediaBroadcaster.Plugin.Demo.FuelPerLap': number;
  'K10MediaBroadcaster.Plugin.Demo.RemainingLaps': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreTempFL': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreTempFR': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreTempRL': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreTempRR': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreWearFL': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreWearFR': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreWearRL': number;
  'K10MediaBroadcaster.Plugin.Demo.TyreWearRR': number;
  'K10MediaBroadcaster.Plugin.Demo.BrakeBias': number;
  'K10MediaBroadcaster.Plugin.Demo.TC': number;
  'K10MediaBroadcaster.Plugin.Demo.ABS': number;
  'K10MediaBroadcaster.Plugin.Demo.Position': number;
  'K10MediaBroadcaster.Plugin.Demo.CurrentLap': number;
  'K10MediaBroadcaster.Plugin.Demo.BestLapTime': number;
  'K10MediaBroadcaster.Plugin.Demo.CarModel': string;
  'K10MediaBroadcaster.Plugin.Demo.SessionTime': number;
  'K10MediaBroadcaster.Plugin.Demo.CurrentLapTime': number;
  'K10MediaBroadcaster.Plugin.Demo.LastLapTime': number;
  'K10MediaBroadcaster.Plugin.Demo.RemainingTime': number;
  'K10MediaBroadcaster.Plugin.Demo.TotalLaps': number;
  'K10MediaBroadcaster.Plugin.Demo.IRating': number;
  'K10MediaBroadcaster.Plugin.Demo.SafetyRating': number;
  'K10MediaBroadcaster.Plugin.Demo.GapAhead': number;
  'K10MediaBroadcaster.Plugin.Demo.GapBehind': number;
  'K10MediaBroadcaster.Plugin.Demo.DriverAhead': string;
  'K10MediaBroadcaster.Plugin.Demo.DriverBehind': string;
  'K10MediaBroadcaster.Plugin.Demo.IRAhead': number;
  'K10MediaBroadcaster.Plugin.Demo.IRBehind': number;

  // ═══ Datastream (Advanced Telemetry) ═══
  'K10MediaBroadcaster.Plugin.DS.LatG': number;
  'K10MediaBroadcaster.Plugin.DS.LongG': number;
  'K10MediaBroadcaster.Plugin.DS.YawRate': number;
  'K10MediaBroadcaster.Plugin.DS.SteerTorque': number;
  'K10MediaBroadcaster.Plugin.DS.TrackTemp': number;
  'K10MediaBroadcaster.Plugin.DS.IncidentCount': number;
  'K10MediaBroadcaster.Plugin.DS.AbsActive': number;
  'K10MediaBroadcaster.Plugin.DS.TcActive': number;
  'K10MediaBroadcaster.Plugin.DS.TrackPct': number;
  'K10MediaBroadcaster.Plugin.DS.LapDelta': number;
  'K10MediaBroadcaster.Plugin.DS.CompletedLaps': number;
  'K10MediaBroadcaster.Plugin.DS.IsInPitLane': number;
  'K10MediaBroadcaster.Plugin.DS.SpeedKmh': number;
  'K10MediaBroadcaster.Plugin.DS.PitLimiterOn': number;
  'K10MediaBroadcaster.Plugin.DS.PitSpeedLimitKmh': number;

  // ═══ Demo Datastream ═══
  'K10MediaBroadcaster.Plugin.Demo.DS.LatG': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.LongG': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.YawRate': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.SteerTorque': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.TrackTemp': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.IncidentCount': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.AbsActive': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.TcActive': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.LapDelta': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.IsInPitLane': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.SpeedKmh': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.PitLimiterOn': number;
  'K10MediaBroadcaster.Plugin.Demo.DS.PitSpeedLimitKmh': number;

  // ═══ Track Map ═══
  'K10MediaBroadcaster.Plugin.TrackMap.Ready': number;
  'K10MediaBroadcaster.Plugin.TrackMap.SvgPath': string;
  'K10MediaBroadcaster.Plugin.TrackMap.PlayerX': number;
  'K10MediaBroadcaster.Plugin.TrackMap.PlayerY': number;
  'K10MediaBroadcaster.Plugin.TrackMap.Opponents': string;

  // ═══ Leaderboard ═══
  'K10MediaBroadcaster.Plugin.Leaderboard': string;

  // ═══ Driver Info ═══
  'K10MediaBroadcaster.Plugin.DriverFirstName': string;
  'K10MediaBroadcaster.Plugin.DriverLastName': string;

  // ═══ Flag State ═══
  'currentFlagState': string;

  // ═══ Grid / Formation State ═══
  'K10MediaBroadcaster.Plugin.Grid.SessionState': string;
  'K10MediaBroadcaster.Plugin.Grid.GriddedCars': number;
  'K10MediaBroadcaster.Plugin.Grid.TotalCars': number;
  'K10MediaBroadcaster.Plugin.Grid.PaceMode': string;
  'K10MediaBroadcaster.Plugin.Grid.StartType': string;
  'K10MediaBroadcaster.Plugin.Grid.LightsPhase': number;
  'K10MediaBroadcaster.Plugin.Grid.TrackCountry': string;

  // ═══ Demo Grid State ═══
  'K10MediaBroadcaster.Plugin.Demo.Grid.SessionState': string;
  'K10MediaBroadcaster.Plugin.Demo.Grid.GriddedCars': number;
  'K10MediaBroadcaster.Plugin.Demo.Grid.TotalCars': number;
  'K10MediaBroadcaster.Plugin.Demo.Grid.PaceMode': string;
  'K10MediaBroadcaster.Plugin.Demo.Grid.LightsPhase': number;
  'K10MediaBroadcaster.Plugin.Demo.Grid.StartType': string;
  'K10MediaBroadcaster.Plugin.Demo.Grid.TrackCountry': string;

  // ═══ Catch-all for unknown/future properties ═══
  [key: string]: any;
}

/**
 * Parsed telemetry snapshot with normalized field names and types.
 * Used internally by hooks and components after fetching raw data.
 */
export interface ParsedTelemetry {
  // Engine
  gameRunning: boolean;
  gear: string;
  rpm: number;
  maxRpm: number;
  speedMph: number;
  throttleRaw: number;
  brakeRaw: number;
  clutchRaw: number;

  // Fuel
  fuelPercent: number;
  fuelLiters: number;
  maxFuelLiters: number;
  fuelPerLap: number;
  fuelRemainingLaps: number;

  // Tyres
  tyreTempFL: number;
  tyreTempFR: number;
  tyreTempRL: number;
  tyreTempRR: number;
  tyreWearFL: number;
  tyreWearFR: number;
  tyreWearRL: number;
  tyreWearRR: number;

  // Brake / TC / ABS
  brakeBias: number;
  tractionControl: number;
  tc: number;
  abs: number;

  // Position
  position: number;
  gapAhead: number;
  gapBehind: number;
  driverAhead: string;
  driverBehind: string;
  irAhead: number;
  irBehind: number;

  // Lap Timing
  currentLap: number;
  totalLaps: number;
  currentLapTime: number;
  bestLapTime: number;
  lastLapTime: number;
  sessionBestLapTime: number;
  sessionTime: number;
  remainingTime: number;

  // iRating & Safety
  iRating: number;
  safetyRating: number;

  // Vehicle
  carModel: string;

  // Commentary
  commentaryVisible: boolean;
  commentaryText: string;
  commentaryTitle: string;
  commentaryTopicId: string;
  commentaryCategory: string;
  commentaryColor: string;
  commentarySeverity: number;

  // Datastream
  latG: number;
  longG: number;
  yawRate: number;
  steerTorque: number;
  trackTemp: number;
  incidentCount: number;
  absActive: boolean;
  tcActive: boolean;
  trackPct: number;
  lapDelta: number;
  completedLaps: number;
  isInPitLane: boolean;
  speedKmh: number;
  pitLimiterOn: boolean;
  pitSpeedLimitKmh: number;

  // Track Map
  trackMapReady: boolean;
  trackMapSvg: string;
  playerMapX: number;
  playerMapY: number;
  opponentMapPositions: string;

  // Leaderboard (JSON string that parses to LeaderboardEntry[])
  leaderboardJson: string;

  // Driver Info
  driverFirstName: string;
  driverLastName: string;
  driverDisplayName: string;

  // Flag
  flagState: string;

  // Flag colors for grid module
  flagColor1: string;
  flagColor2: string;
  flagColor3: string;

  // Grid State
  sessionState: string;
  griddedCars: number;
  totalCars: number;
  paceMode: string;
  startType: string;
  lightsPhase: number;
  trackCountry: string;

  // Grid countdown
  gridCountdown: number;

  // Demo mode flag
  demoMode: boolean;
}

/**
 * Connection status of the telemetry client.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * Statistics about the polling session.
 */
export interface PollStats {
  pollCount: number;
  connectedCount: number;
  failureCount: number;
  lastUpdateTime: number;
  averageLatencyMs: number;
  connectionStatus: ConnectionStatus;
}
