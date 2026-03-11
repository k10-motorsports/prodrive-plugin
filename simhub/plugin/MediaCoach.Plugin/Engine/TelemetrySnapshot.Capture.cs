using System;
using System.Reflection;
using GameReaderCommon;
using SimHub.Plugins;

namespace MediaCoach.Plugin.Engine
{
    /// <summary>
    /// SimHub-dependent capture logic for TelemetrySnapshot.
    /// Kept separate so the data class can be shared with the test runner.
    /// </summary>
    public partial class TelemetrySnapshot
    {
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

            // ── Nearest opponents (by race position) ─────────────────────────
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

                        if (pos == s.Position - 1) { s.NearestAheadName = name;  s.NearestAheadRating  = irating; }
                        if (pos == s.Position + 1) { s.NearestBehindName = name; s.NearestBehindRating = irating; }
                    }
                }
            }
            catch { }

            // ── iRacing-only ─────────────────────────────────────────────────
            s.SteeringWheelTorque = GetRaw<float>(pm, "SteeringWheelTorque");
            s.SessionFlags        = GetRaw<int>(pm, "SessionFlags");
            s.IncidentCount       = GetRaw<int>(pm, "PlayerCarMyIncidentCount");
            s.DrsStatus           = GetRaw<int>(pm, "DrsStatus");
            s.ErsBattery          = GetRaw<float>(pm, "EnergyERSBattery");
            s.MgukPower           = GetRaw<float>(pm, "PowerMGUK");
            s.PlayerCarIdx        = GetRaw<int>(pm, "PlayerCarIdx");
            s.CarIdxLapDistPct    = GetRawArray<float>(pm, "CarIdxLapDistPct");
            s.CarIdxOnPitRoad     = GetRawArray<bool>(pm, "CarIdxOnPitRoad");

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
                if (val != null) return (T)Convert.ChangeType(val, typeof(T));
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
                if (val != null) return (T)Convert.ChangeType(val, typeof(T));
            }
            catch { }
            return default(T);
        }
    }
}
