using GameReaderCommon;
using SimHub.Plugins;

namespace MediaCoach.Plugin.Engine
{
    /// <summary>
    /// Captures a single frame of telemetry data for trigger evaluation.
    /// Holds both the current-frame and previous-frame values so triggers
    /// can detect changes, spikes, and threshold crossings.
    /// </summary>
    public class TelemetrySnapshot
    {
        // ── Normalized (game-agnostic) ──────────────────────────────────────
        public bool  GameRunning       { get; set; }
        public string GameName         { get; set; }
        public double SpeedKmh         { get; set; }
        public double Rpms             { get; set; }
        public string Gear             { get; set; }
        public double Throttle         { get; set; }
        public double Brake            { get; set; }
        public double FuelLevel        { get; set; }
        public double FuelPercent      { get; set; }
        public int    CurrentLap       { get; set; }
        public int    CompletedLaps    { get; set; }
        public double TrackPositionPct { get; set; }
        public int    Position         { get; set; }
        public bool   IsInPit          { get; set; }
        public bool   IsInPitLane      { get; set; }
        public string SessionTypeName  { get; set; }
        public double TyreWearFL       { get; set; }
        public double TyreWearFR       { get; set; }
        public double TyreWearRL       { get; set; }
        public double TyreWearRR       { get; set; }

        // ── iRacing raw telemetry ────────────────────────────────────────────
        public double LatAccel            { get; set; }
        public double LongAccel           { get; set; }
        public double VertAccel           { get; set; }
        public double YawRate             { get; set; }
        public double SteeringWheelTorque { get; set; }
        public double LapDeltaToBest      { get; set; }
        public double LapCurrentTime      { get; set; }
        public double LapLastTime         { get; set; }
        public double LapBestTime         { get; set; }
        public double SessionTimeRemain   { get; set; }
        public int    SessionFlags        { get; set; }
        public int    IncidentCount       { get; set; }
        public int    DrsStatus           { get; set; }
        public bool   AbsActive           { get; set; }
        public bool   WeatherWet          { get; set; }
        public double TrackTemp           { get; set; }
        public float[] CarIdxLapDistPct   { get; set; } = new float[0];
        public bool[] CarIdxOnPitRoad     { get; set; } = new bool[0];
        public int    PlayerCarIdx        { get; set; }
        public double ErsBattery          { get; set; }
        public double MgukPower           { get; set; }

        // ── iRacing flag bitmasks ────────────────────────────────────────────
        public const int FLAG_YELLOW        = 0x0008 | 0x4000 | 0x8000; // yellow | caution | cautionWaving
        public const int FLAG_BLACK         = 0x00010000;

        // ── Factory: capture current state from SimHub ───────────────────────
        public static TelemetrySnapshot Capture(PluginManager pm, ref GameData data)
        {
            var s = new TelemetrySnapshot();
            s.GameRunning = data.GameRunning;
            s.GameName    = data.GameName ?? "";

            if (!data.GameRunning || data.NewData == null)
                return s;

            var d = data.NewData;
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

            // Raw iRacing telemetry via property bus
            s.LatAccel            = GetRaw<float>(pm, "LatAccel");
            s.LongAccel           = GetRaw<float>(pm, "LongAccel");
            s.VertAccel           = GetRaw<float>(pm, "VertAccel");
            s.YawRate             = GetRaw<float>(pm, "YawRate");
            s.SteeringWheelTorque = GetRaw<float>(pm, "SteeringWheelTorque");
            s.LapDeltaToBest      = GetRaw<float>(pm, "LapDeltaToBestLap");
            s.LapCurrentTime      = GetRaw<float>(pm, "LapCurrentLapTime");
            s.LapLastTime         = GetRaw<float>(pm, "LapLastLapTime");
            s.LapBestTime         = GetRaw<float>(pm, "LapBestLapTime");
            s.SessionTimeRemain   = GetRaw<double>(pm, "SessionTimeRemain");
            s.SessionFlags        = GetRaw<int>(pm, "SessionFlags");
            s.IncidentCount       = GetRaw<int>(pm, "PlayerCarMyIncidentCount");
            s.DrsStatus           = GetRaw<int>(pm, "DrsStatus");
            s.AbsActive           = GetRaw<bool>(pm, "BrakeABSactive");
            s.WeatherWet          = GetRaw<bool>(pm, "WeatherDeclaredWet");
            s.TrackTemp           = GetRaw<float>(pm, "TrackTemp");
            s.ErsBattery          = GetRaw<float>(pm, "EnergyERSBattery");
            s.MgukPower           = GetRaw<float>(pm, "PowerMGUK");
            s.PlayerCarIdx        = GetRaw<int>(pm, "PlayerCarIdx");
            s.CarIdxLapDistPct    = GetRawArray<float>(pm, "CarIdxLapDistPct");
            s.CarIdxOnPitRoad     = GetRawArray<bool>(pm, "CarIdxOnPitRoad");

            return s;
        }

        private static T GetRaw<T>(PluginManager pm, string name)
        {
            try
            {
                var val = pm.GetPropertyValue("DataCorePlugin.GameRawData.Telemetry." + name);
                if (val is T typed) return typed;
                if (val != null) return (T)System.Convert.ChangeType(val, typeof(T));
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
    }
}
