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
        // ── ERS detection: track whether the car has ever shown ERS activity ────
        private static string _ersDetectCarModel = "";
        private static bool   _sessionHasErs     = false;

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
            s.Gear             = d.Gear ?? "N";
            s.Throttle         = d.Throttle;
            s.Brake            = d.Brake;
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
            s.VelocityX = GetRaw<float>(pm, "VelocityX");
            s.VelocityZ = GetRaw<float>(pm, "VelocityZ");
            s.Yaw       = GetRaw<float>(pm, "Yaw");

            // ── iRacing-only ─────────────────────────────────────────────────
            s.SteeringWheelTorque = GetRaw<float>(pm, "SteeringWheelTorque");
            s.SteeringWheelAngle  = GetRaw<float>(pm, "SteeringWheelAngle");
            s.FrameRate           = GetRaw<float>(pm, "FrameRate");
            s.SessionFlags        = GetRaw<int>(pm, "SessionFlags");
            s.IncidentCount       = GetRaw<int>(pm, "PlayerCarMyIncidentCount");
            s.DrsStatus           = GetRaw<int>(pm, "DrsStatus");
            s.ErsBattery          = GetRaw<float>(pm, "EnergyERSBattery");
            s.MgukPower           = GetRaw<float>(pm, "PowerMGUK");
            s.PitLimiterOn        = GetRaw<bool>(pm, "dcPitSpeedLimiterToggle");
            double pitLimitMs     = GetRaw<float>(pm, "PitSpeedLimit");
            s.PitSpeedLimitKmh    = pitLimitMs > 0 ? pitLimitMs * 3.6 : 0;

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
            s.PlayerCarIdx        = GetRaw<int>(pm, "PlayerCarIdx");
            s.CarIdxLapDistPct    = GetRawArray<float>(pm, "CarIdxLapDistPct");
            s.CarIdxOnPitRoad     = GetRawArray<bool>(pm, "CarIdxOnPitRoad");
            s.CarIdxLapCompleted  = GetRawArray<int>(pm, "CarIdxLapCompleted");

            // ── iRating / Safety Rating ─────────────────────────────────────
            // Primary: IRacingExtraProperties plugin properties
            // Fallback 1: iRacing raw session data (DriverInfo YAML parsed by SimHub)
            // Fallback 2: Player's own entry in the Opponents collection
            s.IRating = GetPluginProp<int>(pm, "IRacingExtraProperties.iRacing_DriverInfo_IRating");
            if (s.IRating == 0)
                s.IRating = GetPluginProp<int>(pm, "DataCorePlugin.GameData.IRating");
            if (s.IRating == 0)
                s.IRating = GetRaw<int>(pm, "PlayerCarDriverIRating");
            if (s.IRating == 0)
                s.IRating = _fallbackIRating;

            s.SafetyRating = GetPluginProp<double>(pm, "IRacingExtraProperties.iRacing_DriverInfo_SafetyRating");
            if (s.SafetyRating == 0)
                s.SafetyRating = GetPluginProp<double>(pm, "DataCorePlugin.GameData.SafetyRating");
            if (s.SafetyRating == 0)
                s.SafetyRating = _fallbackSR;

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
            s.BrakeBias              = GetRaw<float>(pm, "dcBrakeBias");
            s.TractionControlSetting = GetRaw<float>(pm, "dcTractionControl");
            s.AbsSetting             = GetRaw<float>(pm, "dcABS");
            s.ArbFront               = GetRaw<float>(pm, "dcAntiRollFront");
            s.ArbRear                = GetRaw<float>(pm, "dcAntiRollRear");

            return s;
        }

        private static T Coalesce<T>(T primary, T fallback) where T : IComparable<T>
            => primary.CompareTo(default(T)) != 0 ? primary : fallback;

        private static T GetRaw<T>(PluginManager pm, string name)
        {
            try
            {
                var val = pm.GetPropertyValue("DataCorePlugin.GameRawData.Telemetry." + name);
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
