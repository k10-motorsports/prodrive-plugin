using System;

namespace K10MediaBroadcaster.Plugin.Engine
{
    /// <summary>
    /// Tracks 3-sector split times using iRacing's native sector boundaries
    /// (from SplitTimeInfo.Sectors[].SectorStartPct in the session YAML).
    /// Falls back to equal thirds if native boundaries aren't available.
    /// </summary>
    public class SectorTracker
    {
        // Default boundaries (equal thirds) — overridden by SetBoundaries()
        private double _s2Start = 0.333;
        private double _s3Start = 0.667;
        private bool _hasNativeBoundaries;

        // Best sector splits for the session
        private double _bestS1, _bestS2, _bestS3;

        // Current lap sector entry time
        private double _sectorEntryTime;
        private int _prevSector;

        // Last completed sector splits + deltas
        private double _lastS1, _lastS2, _lastS3;
        private double _deltaS1, _deltaS2, _deltaS3;

        // State: 0=none, 1=pb, 2=faster, 3=slower
        private int _stateS1, _stateS2, _stateS3;

        // Track new-lap detection
        private int _prevCompletedLaps;

        /// <summary>Current sector the player is in (1, 2, or 3).</summary>
        public int CurrentSector { get; private set; } = 1;

        /// <summary>Sector 2 start as LapDistPct (for track map rendering).</summary>
        public double Sector2StartPct => _s2Start;
        /// <summary>Sector 3 start as LapDistPct (for track map rendering).</summary>
        public double Sector3StartPct => _s3Start;
        /// <summary>Whether native iRacing sector boundaries are loaded.</summary>
        public bool HasNativeBoundaries => _hasNativeBoundaries;

        /// <summary>Last completed S1 split time (seconds).</summary>
        public double SplitS1 => _lastS1;
        public double SplitS2 => _lastS2;
        public double SplitS3 => _lastS3;

        public double BestS1 => _bestS1;
        public double BestS2 => _bestS2;
        public double BestS3 => _bestS3;

        public double DeltaS1 => _deltaS1;
        public double DeltaS2 => _deltaS2;
        public double DeltaS3 => _deltaS3;

        /// <summary>0=none, 1=pb, 2=faster, 3=slower</summary>
        public int StateS1 => _stateS1;
        public int StateS2 => _stateS2;
        public int StateS3 => _stateS3;

        /// <summary>
        /// Set sector boundaries from iRacing's SplitTimeInfo YAML.
        /// iRacing defines sectors with SectorStartPct values.
        /// Sector 1 always starts at 0.0, so we need the start of S2 and S3.
        /// </summary>
        public void SetBoundaries(double s2StartPct, double s3StartPct)
        {
            if (s2StartPct > 0 && s2StartPct < 1 && s3StartPct > s2StartPct && s3StartPct < 1)
            {
                _s2Start = s2StartPct;
                _s3Start = s3StartPct;
                _hasNativeBoundaries = true;
                // Reset splits when boundaries change (new track)
                Reset();
            }
        }

        /// <summary>
        /// Call every tick with the player's track position and current lap time.
        /// </summary>
        public void Update(double trackPct, double currentLapTime, int completedLaps)
        {
            if (trackPct < 0 || trackPct > 1.01) return;

            int sector = trackPct < _s2Start ? 1 : trackPct < _s3Start ? 2 : 3;

            // New lap detection
            if (completedLaps > _prevCompletedLaps || (sector == 1 && _prevSector == 3))
            {
                if (_prevSector == 3)
                {
                    double splitTime = currentLapTime > 0
                        ? currentLapTime - _sectorEntryTime : 0;
                    if (splitTime > 0.1)
                        RecordSplit(3, splitTime);
                }
                _sectorEntryTime = 0;
                _prevCompletedLaps = completedLaps;
            }

            // Sector transition
            if (sector != _prevSector && _prevSector > 0)
            {
                double splitTime = currentLapTime - _sectorEntryTime;
                if (splitTime > 0.1)
                    RecordSplit(_prevSector, splitTime);
                _sectorEntryTime = currentLapTime;
            }

            if (_prevSector == 0)
                _sectorEntryTime = currentLapTime;

            _prevSector = sector;
            CurrentSector = sector;
        }

        private void RecordSplit(int sector, double splitTime)
        {
            switch (sector)
            {
                case 1:
                    _lastS1 = splitTime;
                    if (_bestS1 <= 0 || splitTime < _bestS1)
                    { _bestS1 = splitTime; _deltaS1 = 0; _stateS1 = 1; }
                    else
                    { _deltaS1 = splitTime - _bestS1; _stateS1 = _deltaS1 < 0.01 ? 1 : 3; }
                    break;
                case 2:
                    _lastS2 = splitTime;
                    if (_bestS2 <= 0 || splitTime < _bestS2)
                    { _bestS2 = splitTime; _deltaS2 = 0; _stateS2 = 1; }
                    else
                    { _deltaS2 = splitTime - _bestS2; _stateS2 = _deltaS2 < 0.01 ? 1 : 3; }
                    break;
                case 3:
                    _lastS3 = splitTime;
                    if (_bestS3 <= 0 || splitTime < _bestS3)
                    { _bestS3 = splitTime; _deltaS3 = 0; _stateS3 = 1; }
                    else
                    { _deltaS3 = splitTime - _bestS3; _stateS3 = _deltaS3 < 0.01 ? 1 : 3; }
                    break;
            }
        }

        /// <summary>Reset all sector data (session change, track change).</summary>
        public void Reset()
        {
            _bestS1 = _bestS2 = _bestS3 = 0;
            _lastS1 = _lastS2 = _lastS3 = 0;
            _deltaS1 = _deltaS2 = _deltaS3 = 0;
            _stateS1 = _stateS2 = _stateS3 = 0;
            _sectorEntryTime = 0;
            _prevSector = 0;
            _prevCompletedLaps = 0;
            CurrentSector = 1;
        }
    }
}
