namespace K10MediaBroadcaster.Plugin.Engine
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
        public double MaxRpm            { get; set; }
        public string Gear              { get; set; }
        public double Throttle          { get; set; }
        public double Brake             { get; set; }
        public double Clutch            { get; set; }
        public double FuelLevel         { get; set; }
        public double FuelPercent       { get; set; }
        public int    CurrentLap        { get; set; }
        public int    CompletedLaps     { get; set; }
        public double TrackPositionPct  { get; set; }
        public int    Position          { get; set; }
        public bool   IsInPit           { get; set; }
        public bool   IsInPitLane       { get; set; }
        public bool   PitLimiterOn      { get; set; }
        public double PitSpeedLimitKmh  { get; set; }
        public string SessionTypeName   { get; set; }
        public string CarModel          { get; set; } = "";
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

        // ── World-space velocity (for track map dead reckoning) ──────────────
        // iRacing: VelocityX (lateral, car-local), VelocityZ (forward, car-local)
        // Yaw = heading angle (radians) — needed to convert local → world frame.
        public double VelocityX { get; set; }
        public double VelocityZ { get; set; }
        public double Yaw       { get; set; }

        // ── iRacing-only ─────────────────────────────────────────────────────
        public double SteeringWheelTorque { get; set; } // torque (Nm), not angle
        public double SteeringWheelAngle { get; set; } // angle (radians)
        public double FrameRate           { get; set; } // game render FPS
        public int    SessionFlags        { get; set; } // yellow/black/etc. bitmask
        public int    IncidentCount       { get; set; } // iRacing incident points
        public int    DrsStatus           { get; set; }
        public double ErsBattery          { get; set; }
        public double MgukPower           { get; set; }
        /// <summary>True when the car has demonstrated ERS capability (battery seen > 0).</summary>
        public bool   HasErs              { get; set; }
        public int    IRating             { get; set; }
        public double SafetyRating        { get; set; }
        /// <summary>Estimated iRating change at current position (positive = gaining).</summary>
        public int    EstimatedIRatingDelta { get; set; }
        /// <summary>Number of cars in the field (for iRating estimation).</summary>
        public int    IRatingFieldSize     { get; set; }

        // ── Sector splits (computed by SectorTracker) ──────────────────────
        public int    CurrentSector      { get; set; } = 1;
        public double SectorSplitS1      { get; set; }
        public double SectorSplitS2      { get; set; }
        public double SectorSplitS3      { get; set; }
        public double SectorDeltaS1      { get; set; }
        public double SectorDeltaS2      { get; set; }
        public double SectorDeltaS3      { get; set; }
        /// <summary>0=none, 1=pb, 2=faster, 3=slower</summary>
        public int    SectorStateS1      { get; set; }
        // Sector boundary LapDistPct values (from iRacing SplitTimeInfo)
        public double SectorS2StartPct   { get; set; }
        public double SectorS3StartPct   { get; set; }
        public int    SectorStateS2      { get; set; }
        public int    SectorStateS3      { get; set; }

        // ── In-car adjustments (driver controls) ───────────────────────────
        // These change when the driver adjusts settings via button box / black box.
        // iRacing: dcBrakeBias, dcTractionControl, dcABS, dcAntiRollFront, dcAntiRollRear
        public double BrakeBias           { get; set; }
        public double TractionControlSetting { get; set; }
        public double AbsSetting          { get; set; }
        public double ArbFront            { get; set; }
        public double ArbRear             { get; set; }
        public float[] CarIdxLapDistPct   { get; set; } = new float[0];
        public bool[]  CarIdxOnPitRoad    { get; set; } = new bool[0];
        public int[]   CarIdxLapCompleted { get; set; } = new int[0];
        public int     PlayerCarIdx       { get; set; }

        // ── Nearest opponents (populated from Opponents list) ────────────────
        public string NearestAheadName   { get; set; } = "";
        public int    NearestAheadRating { get; set; }
        public string NearestBehindName  { get; set; } = "";
        public int    NearestBehindRating { get; set; }

        // ── Gap times (seconds) — from IRacingExtraProperties plugin ───────
        public double GapAhead  { get; set; }
        public double GapBehind { get; set; }

        // ── Fuel computation — from SimHub computed properties ──────────────
        public double FuelPerLap     { get; set; }
        public double RemainingLaps  { get; set; }

        // ── Player identity — from game data ────────────────────────────────
        public string PlayerName { get; set; } = "";

        // ── Grid / Formation lap state ─────────────────────────────────────
        // SessionState: iRacing → 0=Invalid, 1=GetInCar, 2=Warmup, 3=ParadeLaps, 4=Racing, 5=Checkered, 6=Cooldown
        public int    SessionState      { get; set; }
        /// <summary>Number of cars that have left pit road and are on track.</summary>
        public int    GriddedCars       { get; set; }
        /// <summary>Total car count in the session.</summary>
        public int    TotalCars         { get; set; }
        /// <summary>iRacing PaceMode: 0=NotPacing, 1=Pacing, 2=Approaching, 3=FieldCrossSF.</summary>
        public int    PaceMode          { get; set; }
        /// <summary>True if the session uses a standing start (from iRacing WeekendOptions).</summary>
        public bool   IsStandingStart   { get; set; }
        /// <summary>ISO country code of the track location (e.g. "DE", "US", "GB").</summary>
        public string TrackCountry { get; set; } = "";

        // ── iRacing flag bitmasks (from irsdk_Flags enum) ────────────────────
        public const int FLAG_CHECKERED = 0x0001;
        public const int FLAG_WHITE     = 0x0002;
        public const int FLAG_GREEN     = 0x0004;
        public const int FLAG_YELLOW    = 0x0008 | 0x4000 | 0x8000; // yellow | caution | caution_waving
        public const int FLAG_RED       = 0x0010;
        public const int FLAG_BLUE      = 0x0020;
        public const int FLAG_DEBRIS    = 0x0040;
        public const int FLAG_BLACK     = 0x00010000;
        public const int FLAG_REPAIR    = 0x100000;   // meatball flag — mechanical issue, pit for repairs

        // ── Start position (captured once at race start for delta) ──────────
        public int    StartPosition     { get; set; }

        // ── Derived flags ────────────────────────────────────────────────────
        public bool IsDebrisFlag  => (SessionFlags & FLAG_DEBRIS) != 0;
        public bool IsRepairFlag  => (SessionFlags & FLAG_REPAIR) != 0;

        // ═══════════════════════════════════════════════════════════════════════
        //  COMPUTED DS.* PROPERTIES — server-side calculations
        //  These replace client-side JS math, reducing per-frame overhead.
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>Throttle normalized 0–1 (SimHub reports 0–100).</summary>
        public double ThrottleNorm => Throttle / 100.0;

        /// <summary>Brake normalized 0–1 (SimHub reports 0–100).</summary>
        public double BrakeNorm => Brake / 100.0;

        /// <summary>Clutch normalized 0–1 (SimHub reports 0–100).</summary>
        public double ClutchNorm => Clutch / 100.0;

        /// <summary>RPM ratio 0–1 (clamped).</summary>
        public double RpmRatio => MaxRpm > 0 ? System.Math.Min(1.0, Rpms / MaxRpm) : 0;

        /// <summary>Fuel percentage 0–100.</summary>
        public double FuelPct => FuelPercent;

        /// <summary>Estimated laps of fuel remaining.</summary>
        public double FuelLapsRemaining => FuelPerLap > 0.01 ? FuelLevel / FuelPerLap : 99;

        /// <summary>Speed in miles per hour.</summary>
        public double SpeedMph => SpeedKmh * 0.621371;

        /// <summary>Pit speed limit in mph.</summary>
        public double PitSpeedLimitMph => PitSpeedLimitKmh * 0.621371;

        /// <summary>True when in pit lane and exceeding the speed limit.</summary>
        public bool IsPitSpeeding => IsInPitLane && PitSpeedLimitKmh > 0 && SpeedKmh > PitSpeedLimitKmh;

        /// <summary>True for practice, qualifying, test, or warmup sessions.</summary>
        public bool IsNonRaceSession
        {
            get
            {
                if (string.IsNullOrEmpty(SessionTypeName)) return false;
                var s = SessionTypeName.ToLowerInvariant();
                return s.Contains("practice") || s.Contains("qualify") || s.Contains("test")
                    || s.Contains("warmup") || s.Contains("warm up");
            }
        }

        /// <summary>True when SessionTimeRemain is actively counting down (timed race).</summary>
        public bool IsTimedRace => SessionTimeRemain > 0;

        /// <summary>True when checkered flag is out.</summary>
        public bool IsEndOfRace => (SessionFlags & FLAG_CHECKERED) != 0;

        /// <summary>Positions gained since start (positive = gained, negative = lost).</summary>
        public int PositionDelta => StartPosition > 0 && Position > 0 ? StartPosition - Position : 0;

        /// <summary>Session remaining time formatted as H:MM:SS or M:SS.</summary>
        public string RemainingTimeFormatted
        {
            get
            {
                if (SessionTimeRemain <= 0) return "";
                int totalSec = (int)SessionTimeRemain;
                int h = totalSec / 3600;
                int m = (totalSec % 3600) / 60;
                int s = totalSec % 60;
                return h > 0
                    ? string.Format("{0}:{1:D2}:{2:D2}", h, m, s)
                    : string.Format("{0}:{1:D2}", m, s);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        //  DISPLAY-READY STRINGS — avoid client-side Math.round / toFixed
        // ═══════════════════════════════════════════════════════════════════════

        /// <summary>Speed rounded to integer string, or "0".</summary>
        public string SpeedDisplay => SpeedKmh > 0 ? ((int)System.Math.Round(SpeedKmh)).ToString() : "0";

        /// <summary>RPM rounded to integer string, or "0".</summary>
        public string RpmDisplay => Rpms > 0 ? ((int)System.Math.Round(Rpms)).ToString() : "0";

        /// <summary>Fuel level formatted to 1 decimal, or "—".</summary>
        public string FuelFormatted => FuelLevel > 0 ? FuelLevel.ToString("F1") : "\u2014";

        /// <summary>Fuel per lap formatted to 2 decimals, or "—".</summary>
        public string FuelPerLapFormatted => FuelPerLap > 0 ? FuelPerLap.ToString("F2") : "\u2014";

        /// <summary>Pit fuel suggestion like "PIT in ~5 laps", or empty if not applicable.</summary>
        public string PitSuggestion
        {
            get
            {
                double lapsEst = FuelLapsRemaining;
                if (lapsEst <= 0 || lapsEst >= 99 || RemainingLaps <= 0) return "";
                if (lapsEst < RemainingLaps)
                    return "PIT in ~" + ((int)System.Math.Ceiling(lapsEst)).ToString() + " laps";
                return "";
            }
        }

        /// <summary>Brake bias normalized 0–1 (maps 30–70% to 0–1).</summary>
        public double BBNorm => System.Math.Min(1.0, System.Math.Max(0.0, (BrakeBias - 30.0) / 40.0));

        /// <summary>Traction control setting normalized 0–1 (0–12 scale).</summary>
        public double TCNorm => System.Math.Min(1.0, TractionControlSetting / 12.0);

        /// <summary>ABS setting normalized 0–1 (0–12 scale).</summary>
        public double ABSNorm => System.Math.Min(1.0, AbsSetting / 12.0);

        /// <summary>Position delta as display string: "▲ 2", "▼ 1", or empty.</summary>
        public string PositionDeltaDisplay
        {
            get
            {
                int d = PositionDelta;
                if (d > 0) return "\u25B2 " + d.ToString();
                if (d < 0) return "\u25BC " + System.Math.Abs(d).ToString();
                return "";
            }
        }

        /// <summary>Lap delta to best as "+0.123" / "-0.456", or empty.</summary>
        public string LapDeltaDisplay
        {
            get
            {
                if (LapLastTime <= 0 || LapBestTime <= 0) return "";
                double delta = LapLastTime - LapBestTime;
                return (delta >= 0 ? "+" : "") + delta.ToString("F3");
            }
        }

        /// <summary>Safety rating formatted to 2 decimals, or "—".</summary>
        public string SafetyRatingDisplay => SafetyRating > 0 ? SafetyRating.ToString("F2") : "\u2014";

        /// <summary>Gap to car ahead, formatted with sign: "-1.23", or "—".</summary>
        public string GapAheadFormatted => GapAhead > 0 ? "-" + GapAhead.ToString("F2") : "\u2014";

        /// <summary>Gap to car behind, formatted with sign: "+1.23", or "—".</summary>
        public string GapBehindFormatted => GapBehind > 0 ? "+" + GapBehind.ToString("F2") : "\u2014";
    }
}
