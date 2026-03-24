using System;
using System.Reflection;
using GameReaderCommon;
using SimHub.Plugins;

namespace K10MediaBroadcaster.Plugin.Engine
{
    /// <summary>
    /// SimHub-dependent capture logic for TelemetrySnapshot.
    /// Kept separate so the data class can be shared with the test runner.
    /// </summary>
    public partial class TelemetrySnapshot
    {
        // ── Game detection ───────────────────────────────────────────────────────
        private enum GameId { Unknown, IRacing, ACC, AC, ACEvo, ACRally, LMU, RaceRoom, EAWRC, Forza }

        private static GameId DetectGame(string gameName)
        {
            if (string.IsNullOrEmpty(gameName)) return GameId.Unknown;
            var g = gameName.ToLowerInvariant();
            if (g.Contains("iracing")) return GameId.IRacing;
            if (g.Contains("assettocorsacompetizione") || g == "acc") return GameId.ACC;
            if (g.Contains("assettocorsaevo")) return GameId.ACEvo;
            if (g.Contains("assettocorsarally")) return GameId.ACRally;
            if (g.Contains("assettocorsa") || g == "ac") return GameId.AC;
            if (g.Contains("lemans") || g.Contains("lmu") || g.Contains("rfactor")) return GameId.LMU;
            if (g.Contains("raceroom") || g == "rrre" || g == "r3e") return GameId.RaceRoom;
            if (g.Contains("wrc") || g.Contains("eawrc")) return GameId.EAWRC;
            if (g.Contains("forza")) return GameId.Forza;
            return GameId.Unknown;
        }

        // ── ERS detection: track whether the car has ever shown ERS activity ────
        private static string _ersDetectCarModel = "";
        private static bool   _sessionHasErs     = false;

        // ── Car-specific adjustment detection ────────────────────────────────
        // Track which dc* variables have been non-zero to determine what the car supports.
        // Reset on car change (same pattern as ERS detection).
        private static string _adjDetectCarModel = "";
        private static bool _hasTC = false, _hasABS = false;
        private static bool _hasARBF = false, _hasARBR = false;
        private static bool _hasEng = false, _hasFuelMix = false;
        private static bool _hasWJL = false, _hasWJR = false;
        private static bool _hasWingF = false, _hasWingR = false;

        // ── iRacing SDK bridge (set by Plugin.Init, used as primary data source) ──
        internal static IRacingSdkBridge _sdkBridge;

        // ── iRating estimator (legacy shared memory reader, kept as fallback) ────
        private static IRatingEstimator _irEstimator;
        private static SectorTracker _sectorTracker = new SectorTracker();

        public static TelemetrySnapshot Capture(PluginManager pm, ref GameData data)
        {
            var s = new TelemetrySnapshot();
            s.GameRunning = data.GameRunning;
            s.GameName    = data.GameName ?? "";

            if (!data.GameRunning || data.NewData == null)
                return s;

            var d = data.NewData;

            // ── Normalized fields (all games) ────────────────────────────────
            s.SpeedKmh         = d.SpeedKmh;
            s.Rpms             = d.Rpms;
            s.MaxRpm           = d.MaxRpm;
            s.Gear             = d.Gear ?? "N";
            s.Throttle         = d.Throttle;
            s.Brake            = d.Brake;
            s.Clutch           = d.Clutch;
            s.FuelLevel        = d.Fuel;
            s.FuelPercent      = d.FuelPercent;
            s.CurrentLap       = d.CurrentLap;
            s.CompletedLaps    = d.CompletedLaps;
            s.TrackPositionPct = d.TrackPositionPercent;
            s.Position         = d.Position;
            s.IsInPit          = d.IsInPit != 0;
            s.IsInPitLane      = d.IsInPitLane != 0;
            s.SessionTypeName  = d.SessionTypeName ?? "";
            s.CarModel         = d.CarModel ?? "";
            s.TyreWearFL       = d.TyreWearFrontLeft;
            s.TyreWearFR       = d.TyreWearFrontRight;
            s.TyreWearRL       = d.TyreWearRearLeft;
            s.TyreWearRR       = d.TyreWearRearRight;

            // ── Physics: iRacing raw → normalized fallback ───────────────────
            s.LatAccel  = Coalesce(GetRaw<float>(pm, "LatAccel"),  GetNorm<float>(d, "AccelerationSway"));
            s.LongAccel = Coalesce(GetRaw<float>(pm, "LongAccel"), GetNorm<float>(d, "AccelerationSurge"));
            s.VertAccel = Coalesce(GetRaw<float>(pm, "VertAccel"), GetNorm<float>(d, "AccelerationHeave"));
            s.YawRate   = Coalesce(GetRaw<float>(pm, "YawRate"),   GetNorm<float>(d, "YawVelocity"));

            // ── Driver aids ──────────────────────────────────────────────────
            s.AbsActive = GetRaw<bool>(pm, "BrakeABSactive") || GetNorm<bool>(d, "ABSActive");
            s.TcActive  = GetNorm<bool>(d, "TCActive");

            // ── Tyre temps ───────────────────────────────────────────────────
            s.TyreTempFL = Coalesce(GetNorm<float>(d, "TyreTempFrontLeft"),  GetNorm<float>(d, "TyreTemperatureFrontLeft"));
            s.TyreTempFR = Coalesce(GetNorm<float>(d, "TyreTempFrontRight"), GetNorm<float>(d, "TyreTemperatureFrontRight"));
            s.TyreTempRL = Coalesce(GetNorm<float>(d, "TyreTempRearLeft"),   GetNorm<float>(d, "TyreTemperatureRearLeft"));
            s.TyreTempRR = Coalesce(GetNorm<float>(d, "TyreTempRearRight"),  GetNorm<float>(d, "TyreTemperatureRearRight"));

            // ── Environment ──────────────────────────────────────────────────
            s.TrackTemp     = Coalesce(GetRaw<float>(pm, "TrackTemp"), GetNorm<float>(d, "RoadTemperature"));
            bool iRacingWet = GetRaw<bool>(pm, "WeatherDeclaredWet");
            float rainInt   = GetNorm<float>(d, "RainIntensity");
            s.WeatherWet    = iRacingWet || rainInt > 0.1f;

            // ── Lap timing: iRacing raw → normalized fallback ────────────────
            s.LapCurrentTime    = Coalesce(GetRaw<float>(pm, "LapCurrentLapTime"),  GetNorm<float>(d, "CurrentLapTime"));
            s.LapLastTime       = Coalesce(GetRaw<float>(pm, "LapLastLapTime"),     GetNorm<float>(d, "LastLapTime"));
            s.LapBestTime       = Coalesce(GetRaw<float>(pm, "LapBestLapTime"),     GetNorm<float>(d, "BestLapTime"));
            s.LapDeltaToBest    = Coalesce(GetRaw<float>(pm, "LapDeltaToBestLap"),  GetNorm<float>(d, "DeltaToSessionBestLap"));
            s.SessionTimeRemain = Coalesce(GetRaw<double>(pm, "SessionTimeRemain"), GetNorm<double>(d, "SessionTimeLeft"));

            // ── Sector splits (using iRacing native boundaries from session YAML) ──
            // Feed iRacing's SplitTimeInfo sector boundaries to the tracker if available
            if (_irEstimator != null && _irEstimator.HasSectorBoundaries && !_sectorTracker.HasNativeBoundaries)
            {
                _sectorTracker.SetBoundaries(_irEstimator.SectorS2Start, _irEstimator.SectorS3Start);
            }
            _sectorTracker.Update(s.TrackPositionPct, s.LapCurrentTime, s.CompletedLaps);
            s.CurrentSector  = _sectorTracker.CurrentSector;
            s.SectorSplitS1  = _sectorTracker.SplitS1;
            s.SectorSplitS2  = _sectorTracker.SplitS2;
            s.SectorSplitS3  = _sectorTracker.SplitS3;
            s.SectorDeltaS1  = _sectorTracker.DeltaS1;
            s.SectorDeltaS2  = _sectorTracker.DeltaS2;
            s.SectorDeltaS3  = _sectorTracker.DeltaS3;
            s.SectorStateS1  = _sectorTracker.StateS1;
            s.SectorS2StartPct = _sectorTracker.Sector2StartPct;
            s.SectorS3StartPct = _sectorTracker.Sector3StartPct;
            s.SectorStateS2  = _sectorTracker.StateS2;
            s.SectorStateS3  = _sectorTracker.StateS3;

            // ── Player name (needed before opponents loop for IsPlayer matching) ──
            try
            {
                var nameProp = d.GetType().GetProperty("PlayerName",
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                s.PlayerName = nameProp?.GetValue(d) as string ?? "";
            }
            catch { }

            // ── Nearest opponents (by race position) ─────────────────────────
            // Also extract: player's own iRating/SR, and gap data for ahead/behind
            // as fallback when IRacingExtraProperties plugin is unavailable.
            double _fallbackGapAhead  = 0;
            double _fallbackGapBehind = 0;
            int    _fallbackIRating   = 0;
            double _fallbackSR        = 0;
            try
            {
                var oppsProp = d.GetType().GetProperty("Opponents",
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var opps = oppsProp?.GetValue(d) as System.Collections.IEnumerable;
                if (opps != null)
                {
                    foreach (var opp in opps)
                    {
                        var t = opp.GetType();
                        int   pos    = Convert.ToInt32(t.GetProperty("Position")?.GetValue(opp) ?? 0);
                        string name  = t.GetProperty("Name")?.GetValue(opp) as string ?? "";
                        int   irating = 0;
                        var irProp = t.GetProperty("IRating") ?? t.GetProperty("Irating");
                        if (irProp != null) { var v = irProp.GetValue(opp); if (v != null) irating = Convert.ToInt32(v); }

                        // Try to read gap-to-player from the opponent object
                        double gapToPlayer = 0;
                        try
                        {
                            // SimHub exposes several gap properties — try the most common ones
                            var gapProp = t.GetProperty("RelativeGapToPlayer")
                                       ?? t.GetProperty("GapToPlayer")
                                       ?? t.GetProperty("Gap");
                            if (gapProp != null)
                            {
                                var gv = gapProp.GetValue(opp);
                                if (gv != null)
                                {
                                    if (gv is TimeSpan gts) gapToPlayer = Math.Abs(gts.TotalSeconds);
                                    else if (gv is IConvertible) gapToPlayer = Math.Abs(Convert.ToDouble(gv));
                                }
                            }
                        }
                        catch { }

                        if (pos == s.Position - 1)
                        {
                            s.NearestAheadName = name;
                            s.NearestAheadRating = irating;
                            _fallbackGapAhead = gapToPlayer;
                        }
                        if (pos == s.Position + 1)
                        {
                            s.NearestBehindName = name;
                            s.NearestBehindRating = irating;
                            _fallbackGapBehind = gapToPlayer;
                        }

                        // Detect if this opponent is the player — extract their iRating/SR
                        bool isPlayer = false;
                        try
                        {
                            var isPlayerProp = t.GetProperty("IsPlayer");
                            if (isPlayerProp != null)
                                isPlayer = Convert.ToBoolean(isPlayerProp.GetValue(opp) ?? false);
                            else if (!string.IsNullOrEmpty(s.PlayerName) && !string.IsNullOrEmpty(name))
                                isPlayer = name.Equals(s.PlayerName, StringComparison.OrdinalIgnoreCase);
                        }
                        catch { }

                        if (isPlayer && irating > 0)
                        {
                            _fallbackIRating = irating;
                            // Try to read LicenseLevel / SafetyRating from opponent
                            try
                            {
                                var srProp = t.GetProperty("LicenseSafetyRating")
                                          ?? t.GetProperty("SafetyRating");
                                if (srProp != null)
                                {
                                    var sv = srProp.GetValue(opp);
                                    if (sv != null && sv is IConvertible)
                                        _fallbackSR = Convert.ToDouble(sv);
                                }
                            }
                            catch { }
                        }
                    }
                }
            }
            catch { }

            // ── World velocity (for track map dead reckoning) ─────────────────
            // iRacing: reads raw directly
            // Other games: try normalized motion properties if available, else 0
            GameId detectedGame = DetectGame(s.GameName);
            if (detectedGame == GameId.IRacing)
            {
                s.VelocityX = GetRaw<float>(pm, "VelocityX");
                s.VelocityZ = GetRaw<float>(pm, "VelocityZ");
                s.Yaw       = GetRaw<float>(pm, "Yaw");
            }
            else
            {
                s.VelocityX = GetNorm<float>(d, "VelocityX");
                s.VelocityZ = GetNorm<float>(d, "VelocityZ");
                s.Yaw       = GetNorm<float>(d, "Yaw");
            }

            // ── Game-aware driver controls and telemetry ─────────────────────
            // Steering angle: game-specific raw → iRacing radians, ACC degrees, LMU normalized
            if (detectedGame == GameId.ACC || detectedGame == GameId.AC || detectedGame == GameId.ACEvo || detectedGame == GameId.ACRally)
            {
                // ACC/AC: convert degrees to radians
                float steerDeg = GetRaw<float>(pm, "Physics.SteerAngle", "DataCorePlugin.GameRawData.");
                s.SteeringWheelAngle = steerDeg * (float)Math.PI / 180f;
            }
            else if (detectedGame == GameId.LMU)
            {
                // LMU: mUnfilteredSteering is normalized -1 to 1, leave as ratio
                s.SteeringWheelAngle = GetRaw<float>(pm, "Telemetry.mUnfilteredSteering", "DataCorePlugin.GameRawData.");
            }
            else
            {
                // iRacing and others: default to iRacing raw
                s.SteeringWheelAngle = GetRaw<float>(pm, "SteeringWheelAngle");
            }

            // Brake bias: game-specific (percentage 0-100)
            s.BrakeBias = GetGameBrakeBias(pm, detectedGame);

            // Traction control & ABS settings
            s.TractionControlSetting = GetGameTC(pm, detectedGame);
            s.AbsSetting = GetGameABS(pm, detectedGame);

            // Steering torque (iRacing-only)
            s.SteeringWheelTorque = GetRaw<float>(pm, "SteeringWheelTorque");

            // Frame rate (iRacing-only)
            s.FrameRate = GetRaw<float>(pm, "FrameRate");

            // Session flags: game-aware
            s.SessionFlags = GetGameSessionFlags(pm, detectedGame);

            // Incident count
            s.IncidentCount = GetGameIncidentCount(pm, detectedGame);

            // DRS status (iRacing-only)
            s.DrsStatus = GetRaw<int>(pm, "DrsStatus");

            // ERS / Hybrid energy (game-aware)
            s.ErsBattery = GetGameErsBattery(pm, detectedGame);
            s.MgukPower = GetRaw<float>(pm, "PowerMGUK"); // MGUK is iRacing-specific

            // Pit limiter (game-aware)
            s.PitLimiterOn = GetGamePitLimiter(pm, detectedGame);
            double pitLimitMs = GetRaw<float>(pm, "PitSpeedLimit");
            s.PitSpeedLimitKmh = pitLimitMs > 0 ? pitLimitMs * 3.6 : 0;

            // Track whether this car actually has an ERS system.
            // Non-hybrid cars report 0.0 permanently; reset detection on car change.
            if (s.CarModel != _ersDetectCarModel)
            {
                _ersDetectCarModel = s.CarModel;
                _sessionHasErs = false;
            }
            if (s.ErsBattery > 0.02 || s.MgukPower > 0.0)
                _sessionHasErs = true;
            s.HasErs = _sessionHasErs;

            // Player car index and multi-car arrays (iRacing-only)
            if (detectedGame == GameId.IRacing)
            {
                s.PlayerCarIdx = GetRaw<int>(pm, "PlayerCarIdx");
                s.CarIdxLapDistPct = GetRawArray<float>(pm, "CarIdxLapDistPct");
                s.CarIdxOnPitRoad = GetRawArray<bool>(pm, "CarIdxOnPitRoad");
                s.CarIdxLapCompleted = GetRawArray<int>(pm, "CarIdxLapCompleted");
            }
            else
            {
                s.PlayerCarIdx = 0;
                s.CarIdxLapDistPct = new float[0];
                s.CarIdxOnPitRoad = new bool[0];
                s.CarIdxLapCompleted = new int[0];
            }

            // ── iRating / Safety Rating ─────────────────────────────────────
            // Priority chain:
            // 1. IRacingSdkBridge (IRSDKSharper — direct SDK with proper YAML parsing)
            // 2. IRacingExtraProperties plugin properties
            // 3. SimHub normalized properties
            // 4. iRacing raw telemetry via SimHub
            // 5. Opponents collection fallback

            // Try SDK bridge first (most reliable — proper SDK with parsed YAML)
            if (_sdkBridge != null && _sdkBridge.IsConnected)
            {
                s.IRating = _sdkBridge.PlayerIRating;
                s.SafetyRating = _sdkBridge.PlayerSafetyRating;
                s.LicenseString = _sdkBridge.PlayerLicenseString ?? "";
                s.IsStandingStart = _sdkBridge.IsStandingStart;
                s.IncidentLimitPenalty = _sdkBridge.IncidentLimitPenalty;
                s.IncidentLimitDQ = _sdkBridge.IncidentLimitDQ;
                s.IRatingFieldSize = _sdkBridge.FieldSize;

                // Sector boundaries from SDK
                if (_sdkBridge.HasSectorBoundaries)
                {
                    s.SectorS2StartPct = _sdkBridge.SectorS2StartPct;
                    s.SectorS3StartPct = _sdkBridge.SectorS3StartPct;
                }

                // Track country from SDK
                if (!string.IsNullOrEmpty(_sdkBridge.TrackCountry))
                    s.TrackCountry = _sdkBridge.TrackCountry;
            }

            // Fallback: legacy IRatingEstimator (hand-rolled shared memory reader)
            if (s.IRating == 0)
            {
                if (_irEstimator == null) _irEstimator = new IRatingEstimator();
                _irEstimator.TryReadSessionInfo();
                s.IRating = _irEstimator.PlayerIRating;
                if (s.IsStandingStart == false)
                    s.IsStandingStart = _irEstimator.IsStandingStart;
            }
            if (s.SafetyRating == 0 && _irEstimator != null)
                s.SafetyRating = _irEstimator.PlayerSafetyRating;

            // Fallback: IRacingExtraProperties plugin
            if (s.IRating == 0)
                s.IRating = GetPluginProp<int>(pm, "IRacingExtraProperties.iRacing_DriverInfo_IRating");
            if (s.IRating == 0)
                s.IRating = GetPluginProp<int>(pm, "DataCorePlugin.GameData.IRating");
            if (s.IRating == 0)
                s.IRating = GetRaw<int>(pm, "PlayerCarDriverIRating");
            if (s.IRating == 0)
                s.IRating = _fallbackIRating;

            if (s.SafetyRating == 0)
                s.SafetyRating = GetPluginProp<double>(pm, "IRacingExtraProperties.iRacing_DriverInfo_SafetyRating");
            if (s.SafetyRating == 0)
                s.SafetyRating = GetPluginProp<double>(pm, "DataCorePlugin.GameData.SafetyRating");
            if (s.SafetyRating == 0)
                s.SafetyRating = _fallbackSR;

            // Estimated iRating change (updates with current position)
            if (s.Position > 0 && s.IRating > 0)
            {
                if (_sdkBridge != null && _sdkBridge.IsConnected)
                {
                    s.EstimatedIRatingDelta = _sdkBridge.EstimateIRatingDelta(s.Position);
                    s.IRatingFieldSize = _sdkBridge.FieldSize;
                }
                else if (_irEstimator != null)
                {
                    _irEstimator.Update(s.Position, s.TotalCars > 0 ? s.TotalCars : _irEstimator.FieldSize);
                    s.EstimatedIRatingDelta = _irEstimator.EstimatedDelta;
                    s.IRatingFieldSize = _irEstimator.FieldSize;
                }
            }

            // ── Gap times ───────────────────────────────────────────────────
            // Primary: IRacingExtraProperties plugin
            // Fallback: gap-to-player from the Opponents collection
            s.GapAhead = GetPluginProp<double>(pm, "IRacingExtraProperties.iRacing_Opponent_Ahead_Gap");
            if (s.GapAhead == 0 && _fallbackGapAhead > 0)
                s.GapAhead = _fallbackGapAhead;

            s.GapBehind = GetPluginProp<double>(pm, "IRacingExtraProperties.iRacing_Opponent_Behind_Gap");
            if (s.GapBehind == 0 && _fallbackGapBehind > 0)
                s.GapBehind = _fallbackGapBehind;

            // ── Fuel computation (from SimHub computed properties) ───────────
            s.FuelPerLap    = GetPluginProp<double>(pm, "DataCorePlugin.Computed.Fuel_LitersPerLap");
            s.RemainingLaps = GetPluginProp<double>(pm, "DataCorePlugin.GameData.RemainingLaps");

            // ── Grid / Formation state ────────────────────────────────────
            s.SessionState = GetRaw<int>(pm, "SessionState");
            s.PaceMode     = GetRaw<int>(pm, "PaceMode");
            // Track country — try iRacing WeekendInfo.TrackCountry, fall back to SimHub property
            try
            {
                string country = GetPluginProp<string>(pm, "DataCorePlugin.GameData.TrackCountry") ?? "";
                if (string.IsNullOrEmpty(country))
                    country = GetRaw<string>(pm, "WeekendInfo.TrackCountry") ?? "";
                s.TrackCountry = country;
            }
            catch { s.TrackCountry = ""; }

            // Count gridded cars: cars NOT on pit road from CarIdxOnPitRoad array
            if (s.CarIdxOnPitRoad != null && s.CarIdxOnPitRoad.Length > 0)
            {
                int total = 0, gridded = 0;
                // CarIdxLapDistPct > 0 means the car slot is in use
                for (int i = 0; i < s.CarIdxOnPitRoad.Length; i++)
                {
                    bool inUse = s.CarIdxLapDistPct != null
                              && i < s.CarIdxLapDistPct.Length
                              && s.CarIdxLapDistPct[i] > 0;
                    if (inUse)
                    {
                        total++;
                        if (!s.CarIdxOnPitRoad[i]) gridded++;
                    }
                }
                s.TotalCars   = total;
                s.GriddedCars = gridded;
            }

            // ── In-car adjustments (driver controls) ────────────────────────
            // iRacing raw telemetry: dc* = driver control values
            // Note: BrakeBias, TractionControlSetting, and AbsSetting are already set above
            // with game-aware logic, so we only set the ARB values here (iRacing-only)
            s.ArbFront               = GetRaw<float>(pm, "dcAntiRollFront");
            s.ArbRear                = GetRaw<float>(pm, "dcAntiRollRear");

            // Additional car adjustments (iRacing dc* variables)
            s.EnginePower            = GetRaw<float>(pm, "dcEnginePower");
            s.FuelMixture            = GetRaw<float>(pm, "dcFuelMixture");
            s.WeightJackerLeft       = GetRaw<float>(pm, "dcWeightJackerLeft");
            s.WeightJackerRight      = GetRaw<float>(pm, "dcWeightJackerRight");
            s.WingFront              = GetRaw<float>(pm, "dcWingFront");
            s.WingRear               = GetRaw<float>(pm, "dcWingRear");

            // ── Car-specific adjustment detection ─────────────────────────
            // Reset on car change; accumulate "seen non-zero" flags.
            // BB is always available so we don't track it.
            if (s.CarModel != _adjDetectCarModel)
            {
                _adjDetectCarModel = s.CarModel;
                _hasTC = false; _hasABS = false;
                _hasARBF = false; _hasARBR = false;
                _hasEng = false; _hasFuelMix = false;
                _hasWJL = false; _hasWJR = false;
                _hasWingF = false; _hasWingR = false;
            }
            if (s.TractionControlSetting != 0) _hasTC = true;
            if (s.AbsSetting != 0)             _hasABS = true;
            if (s.ArbFront != 0)               _hasARBF = true;
            if (s.ArbRear != 0)                _hasARBR = true;
            if (s.EnginePower != 0)            _hasEng = true;
            if (s.FuelMixture != 0)            _hasFuelMix = true;
            if (s.WeightJackerLeft != 0)       _hasWJL = true;
            if (s.WeightJackerRight != 0)      _hasWJR = true;
            if (s.WingFront != 0)              _hasWingF = true;
            if (s.WingRear != 0)               _hasWingR = true;

            s.HasTC = _hasTC;       s.HasABS = _hasABS;
            s.HasARBFront = _hasARBF; s.HasARBRear = _hasARBR;
            s.HasEnginePower = _hasEng; s.HasFuelMixture = _hasFuelMix;
            s.HasWeightJackerL = _hasWJL; s.HasWeightJackerR = _hasWJR;
            s.HasWingFront = _hasWingF; s.HasWingRear = _hasWingR;

            // ── Pit stop selections (iRacing-only, read-only) ─────────────
            if (detectedGame == GameId.IRacing)
            {
                s.PitSvFlags             = GetRaw<int>(pm, "PitSvFlags");
                s.PitSvFuel              = GetRaw<float>(pm, "PitSvFuel");
                s.PitSvLFP               = GetRaw<float>(pm, "PitSvLFP");
                s.PitSvRFP               = GetRaw<float>(pm, "PitSvRFP");
                s.PitSvLRP               = GetRaw<float>(pm, "PitSvLRP");
                s.PitSvRRP               = GetRaw<float>(pm, "PitSvRRP");
                s.PitSvTireCompound      = GetRaw<int>(pm, "PitSvTireCompound");
                s.PitSvFastRepair        = GetRaw<int>(pm, "dpFastRepair");
                s.PitSvWindshieldTearoff = GetRaw<int>(pm, "dpWindshieldTearoff");
            }

            return s;
        }

        // ── Game-specific raw data helpers ──────────────────────────────────────
        private static float GetGameBrakeBias(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                case GameId.AC:
                case GameId.ACEvo:
                case GameId.ACRally:
                    return GetRaw<float>(pm, "Physics.BrakeBias", "DataCorePlugin.GameRawData.") * 100f;
                case GameId.LMU:
                    float rearBias = GetRaw<float>(pm, "Telemetry.mRearBrakeBias", "DataCorePlugin.GameRawData.");
                    return (1f - rearBias) * 100f; // convert rear bias to front bias for display
                case GameId.RaceRoom:
                    return GetRaw<float>(pm, "BrakeBias", "DataCorePlugin.GameRawData.") * 100f;
                case GameId.IRacing:
                default:
                    return GetRaw<float>(pm, "dcBrakeBias");
            }
        }

        private static float GetGameTC(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                case GameId.AC:
                case GameId.ACEvo:
                case GameId.ACRally:
                    return GetRaw<float>(pm, "Graphics.TC", "DataCorePlugin.GameRawData.");
                case GameId.LMU:
                    return GetRaw<float>(pm, "Telemetry.mTractionControl", "DataCorePlugin.GameRawData.");
                case GameId.RaceRoom:
                    return GetRaw<float>(pm, "TractionControl", "DataCorePlugin.GameRawData.");
                case GameId.IRacing:
                default:
                    return GetRaw<float>(pm, "dcTractionControl");
            }
        }

        private static float GetGameABS(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                case GameId.AC:
                case GameId.ACEvo:
                case GameId.ACRally:
                    return GetRaw<float>(pm, "Graphics.ABS", "DataCorePlugin.GameRawData.");
                case GameId.RaceRoom:
                    return GetRaw<float>(pm, "ABS", "DataCorePlugin.GameRawData.");
                case GameId.IRacing:
                default:
                    return GetRaw<float>(pm, "dcABS");
            }
        }

        private static int GetGameSessionFlags(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                case GameId.AC:
                case GameId.ACEvo:
                case GameId.ACRally:
                    // Map ACC flags to iRacing bitmask
                    int accFlag = GetRaw<int>(pm, "Graphics.Flag", "DataCorePlugin.GameRawData.");
                    // ACC_FLAG_TYPE: 0=none, 1=blue, 2=yellow, 3=black, 4=white, 5=checkered, 6=penalty
                    int irMask = 0;
                    if (accFlag == 2) irMask |= 0x02; // yellow
                    if (accFlag == 1) irMask |= 0x04; // blue
                    if (accFlag == 3) irMask |= 0x08; // black
                    if (accFlag == 5) irMask |= 0x01; // checkered
                    return irMask;
                case GameId.RaceRoom:
                    int r3eMask = 0;
                    if (GetRaw<bool>(pm, "Flags.Yellow", "DataCorePlugin.GameRawData.")) r3eMask |= 0x02;
                    if (GetRaw<bool>(pm, "Flags.Blue", "DataCorePlugin.GameRawData.")) r3eMask |= 0x04;
                    if (GetRaw<bool>(pm, "Flags.Black", "DataCorePlugin.GameRawData.")) r3eMask |= 0x08;
                    return r3eMask;
                case GameId.IRacing:
                default:
                    return GetRaw<int>(pm, "SessionFlags");
            }
        }

        private static int GetGameIncidentCount(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                    // ACC doesn't expose incident count directly; use penalties as proxy
                    return GetRaw<int>(pm, "Graphics.Penalties", "DataCorePlugin.GameRawData.");
                case GameId.IRacing:
                default:
                    return GetRaw<int>(pm, "PlayerCarMyIncidentCount");
            }
        }

        private static float GetGameErsBattery(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                    return GetRaw<float>(pm, "Physics.KersCharge", "DataCorePlugin.GameRawData.");
                case GameId.LMU:
                    return GetRaw<float>(pm, "Telemetry.mBatteryChargeFraction", "DataCorePlugin.GameRawData.");
                case GameId.IRacing:
                default:
                    return GetRaw<float>(pm, "EnergyERSBattery");
            }
        }

        private static bool GetGamePitLimiter(PluginManager pm, GameId game)
        {
            switch (game)
            {
                case GameId.ACC:
                case GameId.AC:
                case GameId.ACEvo:
                case GameId.ACRally:
                    return GetRaw<bool>(pm, "Physics.PitLimiterOn", "DataCorePlugin.GameRawData.");
                case GameId.LMU:
                    return GetRaw<bool>(pm, "Telemetry.mSpeedLimiter", "DataCorePlugin.GameRawData.");
                case GameId.IRacing:
                default:
                    return GetRaw<bool>(pm, "dcPitSpeedLimiterToggle");
            }
        }

        private static T Coalesce<T>(T primary, T fallback) where T : IComparable<T>
            => primary.CompareTo(default(T)) != 0 ? primary : fallback;

        private static T GetRaw<T>(PluginManager pm, string name, string prefix = null)
        {
            try
            {
                string fullPath;
                if (prefix != null)
                {
                    fullPath = prefix + name;
                }
                else
                {
                    fullPath = "DataCorePlugin.GameRawData.Telemetry." + name;
                }
                var val = pm.GetPropertyValue(fullPath);
                if (val is T typed) return typed;
                if (val is IConvertible) return (T)Convert.ChangeType(val, typeof(T));
            }
            catch { }
            return default(T);
        }

        /// <summary>Read a SimHub plugin property by its full name (e.g. IRacingExtraProperties.*).</summary>
        private static T GetPluginProp<T>(PluginManager pm, string fullName)
        {
            try
            {
                var val = pm.GetPropertyValue(fullName);
                if (val is T typed) return typed;
                if (val is IConvertible) return (T)Convert.ChangeType(val, typeof(T));
            }
            catch { }
            return default(T);
        }

        private static T[] GetRawArray<T>(PluginManager pm, string name)
        {
            try
            {
                var val = pm.GetPropertyValue("DataCorePlugin.GameRawData.Telemetry." + name);
                if (val is T[] arr) return arr;
            }
            catch { }
            return new T[0];
        }

        private static T GetNorm<T>(object d, string propName)
        {
            if (d == null) return default(T);
            try
            {
                var prop = d.GetType().GetProperty(propName,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                if (prop == null) return default(T);
                var val = prop.GetValue(d);
                if (val is T typed) return typed;
                // TimeSpan → numeric: extract TotalSeconds so lap-time properties work
                // for non-iRacing games where the normalized API returns TimeSpan.
                if (val is TimeSpan ts)
                {
                    if (typeof(T) == typeof(float))  return (T)(object)(float)ts.TotalSeconds;
                    if (typeof(T) == typeof(double)) return (T)(object)ts.TotalSeconds;
                }
                // Guard: only attempt conversion if the value supports IConvertible
                // (e.g. TimeSpan does NOT, and Convert.ChangeType throws InvalidCastException)
                if (val is IConvertible) return (T)Convert.ChangeType(val, typeof(T));
            }
            catch { }
            return default(T);
        }
    }
}
