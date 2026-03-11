namespace MediaCoach.Plugin.Engine
{
    /// <summary>
    /// Single frame of telemetry data for trigger evaluation.
    /// Pure data class — no SimHub dependencies.
    /// Capture logic lives in TelemetrySnapshot.Capture.cs.
    /// </summary>
    public partial class TelemetrySnapshot
    {
        // ── Normalized (game-agnostic) ──────────────────────────────────────
        public bool   GameRunning       { get; set; }
        public string GameName          { get; set; }
        public double SpeedKmh          { get; set; }
        public double Rpms              { get; set; }
        public string Gear              { get; set; }
        public double Throttle          { get; set; }
        public double Brake             { get; set; }
        public double FuelLevel         { get; set; }
        public double FuelPercent       { get; set; }
        public int    CurrentLap        { get; set; }
        public int    CompletedLaps     { get; set; }
        public double TrackPositionPct  { get; set; }
        public int    Position          { get; set; }
        public bool   IsInPit           { get; set; }
        public bool   IsInPitLane       { get; set; }
        public string SessionTypeName   { get; set; }
        public double TyreWearFL        { get; set; }
        public double TyreWearFR        { get; set; }
        public double TyreWearRL        { get; set; }
        public double TyreWearRR        { get; set; }

        // ── Physics — iRacing raw, with cross-game normalized fallback ───────
        // Available: iRacing, AC, ACC, AMS2, LMU (via SimHub motion physics)
        public double LatAccel          { get; set; }
        public double LongAccel         { get; set; }
        public double VertAccel         { get; set; }
        public double YawRate           { get; set; }

        // ── Driver aids — cross-game where supported ─────────────────────────
        // AbsActive:  iRacing, AC, ACC, AMS2, LMU
        // TcActive:   AC, ACC, AMS2, LMU (iRacing exposes TC differently)
        public bool   AbsActive         { get; set; }
        public bool   TcActive          { get; set; }

        // ── Tyre temperatures — cross-game where supported ───────────────────
        // Available: AC, ACC, AMS2, LMU; partially in iRacing
        public double TyreTempFL        { get; set; }
        public double TyreTempFR        { get; set; }
        public double TyreTempRL        { get; set; }
        public double TyreTempRR        { get; set; }

        // ── Environment — cross-game where supported ─────────────────────────
        // TrackTemp:  iRacing, AC, ACC, AMS2, LMU
        // WeatherWet: iRacing (flag), AC/AMS2/LMU (RainIntensity > threshold)
        public double TrackTemp         { get; set; }
        public bool   WeatherWet        { get; set; }

        // ── Lap timing — iRacing raw, with cross-game normalized fallback ────
        // All fields available in most SimHub-supported games
        public double LapDeltaToBest    { get; set; }
        public double LapCurrentTime    { get; set; }
        public double LapLastTime       { get; set; }
        public double LapBestTime       { get; set; }
        public double SessionTimeRemain { get; set; }

        // ── iRacing-only ─────────────────────────────────────────────────────
        public double SteeringWheelTorque { get; set; } // torque (Nm), not angle
        public int    SessionFlags        { get; set; } // yellow/black/etc. bitmask
        public int    IncidentCount       { get; set; } // iRacing incident points
        public int    DrsStatus           { get; set; }
        public double ErsBattery          { get; set; }
        public double MgukPower           { get; set; }
        public float[] CarIdxLapDistPct   { get; set; } = new float[0];
        public bool[]  CarIdxOnPitRoad    { get; set; } = new bool[0];
        public int     PlayerCarIdx       { get; set; }

        // ── Nearest opponents (populated from Opponents list) ────────────────
        public string NearestAheadName   { get; set; } = "";
        public int    NearestAheadRating { get; set; }
        public string NearestBehindName  { get; set; } = "";
        public int    NearestBehindRating { get; set; }

        // ── iRacing flag bitmasks (from irsdk_Flags enum) ────────────────────
        public const int FLAG_CHECKERED = 0x0001;
        public const int FLAG_WHITE     = 0x0002;
        public const int FLAG_GREEN     = 0x0004;
        public const int FLAG_YELLOW    = 0x0008 | 0x4000 | 0x8000; // yellow | caution | caution_waving
        public const int FLAG_RED       = 0x0010;
        public const int FLAG_BLUE      = 0x0020;
        public const int FLAG_DEBRIS    = 0x0040;
        public const int FLAG_BLACK     = 0x00010000;

        // ── Derived flags ────────────────────────────────────────────────────
        public bool IsDebrisFlag => (SessionFlags & FLAG_DEBRIS) != 0;
    }
}
