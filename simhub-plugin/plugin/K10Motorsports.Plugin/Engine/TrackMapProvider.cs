using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace K10Motorsports.Plugin.Engine
{
    /// <summary>
    /// Records a track outline from telemetry world positions (first lap),
    /// then interpolates car positions along it each frame.
    ///
    /// Data flow:
    ///   1. Each frame, Feed() receives the player's world X/Z + LapDistPct.
    ///   2. During the first recording lap, samples are collected at ~2m intervals.
    ///   3. When the lap completes (LapDistPct wraps), the outline is finalised:
    ///      coordinates are normalised to a 0–100 SVG viewBox with 5% padding.
    ///   4. On subsequent frames, each car's LapDistPct is interpolated along the
    ///      recorded outline to produce XY pixel positions.
    ///   5. The plugin exposes: SvgPath, PlayerXY, and a compact OpponentXY array
    ///      as string properties the dashboard reads each frame.
    ///
    /// SimHub stores its own track outlines in PluginsData\Common\TrackMaps\
    /// or PluginsData\IRacing\MapRecords\. If we find a matching file on disk
    /// we load it instead of recording — so the map appears from lap 1.
    /// </summary>
    public class TrackMapProvider
    {
        // ── Recording state ────────────────────────────────────────────────
        private readonly List<TrackPoint> _samples = new List<TrackPoint>();
        private bool _recording = false;
        private bool _ready = false;
        private double _lastSampleDist = -1;
        private string _currentTrackId = "";
        private string _simhubDir = "";

        // ── Dead reckoning from car-local VelocityX/Z + heading ──────────
        private double _drX = 0, _drZ = 0;           // accumulated world position
        private DateTime _drLastTick = DateTime.MinValue;
#pragma warning disable CS0414 // assigned but never read — reserved for future dead-reckoning rotation
        private double _lastYaw = double.NaN;         // heading (radians) for local→world
#pragma warning restore CS0414

        // ── Finalised outline (normalised to 0–100) ───────────────────────
        private TrackPoint[] _outline = new TrackPoint[0];
        private string _svgPath = "";

        // ── Per-frame car positions ────────────────────────────────────────
        private double _playerX, _playerY;
        private readonly List<OpponentPos> _opponents = new List<OpponentPos>();
        private readonly Dictionary<int, OpponentPos> _oppSmoothed = new Dictionary<int, OpponentPos>();
        private int _oppCleanupCounter = 0;

        // ── Demo track ─────────────────────────────────────────────────────
        private static TrackPoint[] _demoOutline;
        private static string _demoSvgPath;
        private bool _demoMode = false;

        // Min distance² between samples (world units) to avoid over-sampling
        private const double MinSampleDistSq = 4.0; // ~2m apart

        // Car reset detection — if player teleports to pit during recording, restart
        private bool _wasOnTrack = false;  // was the player on track (not in pit) last frame?

        // ── Public read-only state ─────────────────────────────────────────

        /// <summary>True when we have a valid track outline (recorded or loaded).</summary>
        public bool IsReady => _ready;

        /// <summary>The track ID / name used to key the current map (matches the name the plugin saved/loaded under).</summary>
        public string TrackName => _currentTrackId;

        /// <summary>SVG path data string for the track outline, in a 0 0 100 100 viewBox.</summary>
        public string SvgPath => _demoMode ? DemoSvgPath : _svgPath;

        /// <summary>Player X position in SVG coords (0–100).</summary>
        public double PlayerX => _playerX;

        /// <summary>Player Y position in SVG coords (0–100).</summary>
        public double PlayerY => _playerY;

        /// <summary>Player heading in degrees (0 = north, clockwise positive). Used for driving-direction map rotation.</summary>
        public double PlayerHeadingDeg { get; private set; }

        /// <summary>
        /// Compact opponent string: "x1,y1,p1;x2,y2,p2;..." where p=1 if in pit.
        /// Dashboard parses this to place opponent dots.
        /// </summary>
        public string OpponentData { get; private set; } = "";

        /// <summary>Number of active opponents on the map.</summary>
        public int OpponentCount => _opponents.Count;

        // ── Initialisation ─────────────────────────────────────────────────

        /// <summary>
        /// Call once at plugin init to set the SimHub install directory.
        /// This is used to locate existing track map files.
        /// </summary>
        public void SetSimHubDirectory(string dir)
        {
            _simhubDir = dir ?? "";
        }

        /// <summary>
        /// Call when a new session starts (track changes).
        /// Attempts to load an existing map file; if none found, starts recording.
        /// </summary>
        public void OnTrackChanged(string trackId)
        {
            _currentTrackId = trackId ?? "";
            _samples.Clear();
            _outline = new TrackPoint[0];
            _svgPath = "";
            _ready = false;
            _recording = false;
            _lastSampleDist = -1;
            _demoMode = false;
            _drX = 0; _drZ = 0;
            _drLastTick = DateTime.MinValue;
            _lastYaw = double.NaN;

            // Try to load from bundled dataset (checked into git)
            if (TryLoadFromBundledMaps(trackId))
            {
                SimHub.Logging.Current.Info($"[K10Motorsports] Loaded track map for '{trackId}' from bundled dataset");
                return;
            }

            // Try to load from SimHub's map cache
            if (TryLoadFromSimHub(trackId))
            {
                SimHub.Logging.Current.Info($"[K10Motorsports] Loaded track map for '{trackId}' from SimHub cache");
                return;
            }

            // Try to load from our own cache
            if (TryLoadFromOwnCache(trackId))
            {
                SimHub.Logging.Current.Info($"[K10Motorsports] Loaded track map for '{trackId}' from K10 cache");
                return;
            }

            // No cached map — start recording
            _recording = true;
            SimHub.Logging.Current.Info($"[K10Motorsports] Recording track map for '{trackId}' — drive one clean lap");
        }

        /// <summary>
        /// Enable demo mode with a fake track outline and animated positions.
        /// </summary>
        public void SetDemoMode(bool enabled)
        {
            _demoMode = enabled;
            if (enabled)
            {
                EnsureDemoOutline();
                _ready = true;
            }
        }

        // ── Per-frame update ───────────────────────────────────────────────

        /// <summary>
        /// Called every evaluation frame with the player's velocity and all car positions.
        /// Dead-reckons a world position from VelocityX/Z to build the track outline.
        /// </summary>
        public void Update(
            double velocityX, double velocityZ,
            double yaw,
            double playerLapDistPct,
            float[] carIdxLapDistPct,
            bool[] carIdxOnPitRoad,
            int playerCarIdx,
            int playerPosition,
            bool playerInPitLane = false)
        {
            if (_demoMode) return; // demo positions handled separately

            // Expose heading in degrees for dashboard map rotation (driving direction lock)
            if (!double.IsNaN(yaw)) PlayerHeadingDeg = yaw * (180.0 / Math.PI);

            // ── Dead reckoning: rotate car-local velocity by heading → world position ──
            // iRacing VelocityX = lateral (car-local), VelocityZ = forward (car-local)
            // Yaw = heading angle (radians, 0 = north, clockwise positive)
            DateTime now = DateTime.UtcNow;
            if (_drLastTick != DateTime.MinValue)
            {
                double dt = (now - _drLastTick).TotalSeconds;
                if (dt > 0 && dt < 1.0) // sanity: skip if paused or huge gap
                {
                    double heading = yaw;
                    if (double.IsNaN(heading) || heading == 0)
                    {
                        _drX += velocityX * dt;
                        _drZ += velocityZ * dt;
                    }
                    else
                    {
                        double cosH = Math.Cos(heading);
                        double sinH = Math.Sin(heading);
                        _drX += (velocityZ * sinH + velocityX * cosH) * dt;
                        _drZ += (velocityZ * cosH - velocityX * sinH) * dt;
                    }
                }
            }
            _drLastTick = now;

            // ── Car reset / tow detection ─────────────────────────────────
            // If player was on track and suddenly teleports to pit lane with no velocity,
            // they've reset their car. Clear recording and start fresh.
            if (_recording && _wasOnTrack && playerInPitLane && _samples.Count > 5)
            {
                bool noVelocity = Math.Abs(velocityX) < 0.5 && Math.Abs(velocityZ) < 0.5;
                if (noVelocity)
                {
                    SimHub.Logging.Current.Info("[K10Motorsports] Car reset detected during map recording — restarting");
                    _samples.Clear();
                    _lastSampleDist = -1;
                    _drX = 0; _drZ = 0;
                    _drLastTick = DateTime.MinValue;
                    _lastYaw = double.NaN;
                }
            }
            _wasOnTrack = !playerInPitLane;

            // ── Recording phase ────────────────────────────────────────────
            // Skip samples while player is in pit lane — prevents pit road spurs
            // in the track outline that cause extra lines and shape corruption.
            bool hasVelocity = Math.Abs(velocityX) > 0.01 || Math.Abs(velocityZ) > 0.01;
            if (_recording && hasVelocity && !playerInPitLane)
            {
                RecordSample(_drX, _drZ, playerLapDistPct);
            }

            // ── Interpolation phase ────────────────────────────────────────
            if (!_ready || _outline.Length < 4) return;

            // Player position — with sanity clamping and smoothing
            var pp = InterpolatePosition(playerLapDistPct);
            pp.X = Math.Max(0, Math.Min(100, pp.X));
            pp.Y = Math.Max(0, Math.Min(100, pp.Y));
            double jumpDist = Math.Sqrt((_playerX - pp.X) * (_playerX - pp.X) + (_playerY - pp.Y) * (_playerY - pp.Y));
            if (_playerX > 0 && _playerY > 0 && jumpDist > 15.0)
            {
                _playerX += (pp.X - _playerX) * 0.15;
                _playerY += (pp.Y - _playerY) * 0.15;
            }
            else
            {
                _playerX += (pp.X - _playerX) * 0.5;
                _playerY += (pp.Y - _playerY) * 0.5;
            }

            // Opponents — with smoothing to reduce jitter
            // Reuse _opponents list but apply per-car low-pass filter
            var newOpps = new List<OpponentPos>();
            if (carIdxLapDistPct != null)
            {
                for (int i = 0; i < carIdxLapDistPct.Length; i++)
                {
                    if (i == playerCarIdx) continue;
                    float dist = carIdxLapDistPct[i];
                    if (dist <= 0 || dist > 1) continue;

                    var op = InterpolatePosition(dist);
                    op.X = Math.Max(0, Math.Min(100, op.X));
                    op.Y = Math.Max(0, Math.Min(100, op.Y));
                    bool inPit = carIdxOnPitRoad != null && i < carIdxOnPitRoad.Length && carIdxOnPitRoad[i];

                    // Apply per-car smoothing via the _oppSmoothed dictionary
                    double sx = op.X, sy = op.Y;
                    if (_oppSmoothed.TryGetValue(i, out var prev))
                    {
                        double odx = op.X - prev.X;
                        double ody = op.Y - prev.Y;
                        double oDist = Math.Sqrt(odx * odx + ody * ody);
                        // Large jump = glitch or pit teleport — slow blend; else normal blend
                        double alpha = oDist > 15.0 ? 0.10 : 0.40;
                        sx = prev.X + odx * alpha;
                        sy = prev.Y + ody * alpha;
                    }
                    _oppSmoothed[i] = new OpponentPos { X = sx, Y = sy, InPit = inPit };

                    newOpps.Add(new OpponentPos { X = sx, Y = sy, InPit = inPit });
                }
            }

            // Clean up smoothing state for cars that are no longer present
            if (_oppCleanupCounter++ > 120) // every ~2s at 60fps
            {
                _oppCleanupCounter = 0;
                var activeIds = new HashSet<int>();
                if (carIdxLapDistPct != null)
                    for (int i = 0; i < carIdxLapDistPct.Length; i++)
                        if (carIdxLapDistPct[i] > 0) activeIds.Add(i);
                var stale = new List<int>();
                foreach (var k in _oppSmoothed.Keys)
                    if (!activeIds.Contains(k)) stale.Add(k);
                foreach (var k in stale) _oppSmoothed.Remove(k);
            }

            _opponents.Clear();
            _opponents.AddRange(newOpps);

            BuildOpponentData();
        }

        /// <summary>
        /// Reset the track map and restart recording from scratch.
        /// Call this when the map looks corrupted (wonky outlines, extra lines, etc.).
        /// </summary>
        public void ResetTrackMap()
        {
            SimHub.Logging.Current.Info("[K10Motorsports] Track map reset — will re-record next clean lap");
            _samples.Clear();
            _outline = new TrackPoint[0];
            _svgPath = "";
            _ready = false;
            _recording = true;
            _lastSampleDist = -1;
            _drX = 0; _drZ = 0;
            _drLastTick = DateTime.MinValue;
            _lastYaw = double.NaN;
            _playerX = 0; _playerY = 0;
            _opponents.Clear();
            _oppSmoothed.Clear();
            OpponentData = "";
            _wasOnTrack = false;

            // Delete cached file so the bad data doesn't reload
            try
            {
                string path = GetOwnCachePath(_currentTrackId);
                if (File.Exists(path)) File.Delete(path);
            }
            catch { }
        }

        /// <summary>
        /// Update demo mode positions based on simulated track positions.
        /// Called from DemoTelemetryProvider.
        /// </summary>
        public void UpdateDemo(double playerTrackPct, int carCount, double elapsed)
        {
            if (!_demoMode) return;
            EnsureDemoOutline();

            var pp = InterpolateOnOutline(_demoOutline, playerTrackPct);
            _playerX = pp.X;
            _playerY = pp.Y;

            // Simulate opponents spread around the track
            _opponents.Clear();
            for (int i = 0; i < carCount; i++)
            {
                double offset = (double)(i + 1) / (carCount + 1);
                // Add subtle drift so they move at slightly different speeds
                double drift = Math.Sin(elapsed * 0.3 + i * 1.7) * 0.015;
                double pos = (playerTrackPct + offset + drift) % 1.0;
                if (pos < 0) pos += 1.0;
                var op = InterpolateOnOutline(_demoOutline, pos);
                _opponents.Add(new OpponentPos { X = op.X, Y = op.Y, InPit = false });
            }

            BuildOpponentData();
        }

        // ── Recording ──────────────────────────────────────────────────────

        private void RecordSample(double wx, double wz, double dist)
        {
            // Detect lap completion (dist wraps from ~1.0 to ~0.0)
            if (_lastSampleDist > 0.95 && dist < 0.05 && _samples.Count > 20)
            {
                FinaliseRecording();
                return;
            }

            // Reject samples where LapDistPct goes backwards significantly
            // (happens with pit lane data bleed-in or teleport glitches)
            if (_lastSampleDist >= 0 && dist < _lastSampleDist - 0.01 && !(dist < 0.05 && _lastSampleDist > 0.95))
            {
                // Not a normal lap wrap — skip this sample
                return;
            }

            // Check minimum distance from last sample and reject outlier jumps
            if (_samples.Count > 0)
            {
                var last = _samples[_samples.Count - 1];
                double dx = wx - last.WorldX;
                double dz = wz - last.WorldZ;
                double distSq = dx * dx + dz * dz;
                // Too close — skip
                if (distSq < MinSampleDistSq)
                {
                    _lastSampleDist = dist;
                    return;
                }
                // Too far (>200m jump) — likely a dead-reckoning glitch, skip
                if (distSq > 40000.0)
                {
                    _lastSampleDist = dist;
                    return;
                }
            }

            _samples.Add(new TrackPoint
            {
                WorldX = wx,
                WorldZ = wz,
                LapDistPct = dist
            });

            _lastSampleDist = dist;
        }

        private void FinaliseRecording()
        {
            _recording = false;

            if (_samples.Count < 10)
            {
                SimHub.Logging.Current.Warn("[K10Motorsports] Track recording too short, discarding");
                _recording = true; // retry next lap
                _samples.Clear();
                return;
            }

            // Validate the recording isn't degenerate (straight line)
            if (!ValidateTrackShape(_samples))
            {
                SimHub.Logging.Current.Warn("[K10Motorsports] Track recording looks like a straight line (bad velocity data?), retrying next lap");
                _recording = true;
                _samples.Clear();
                return;
            }

            // Sort by LapDistPct to ensure monotonic order
            _samples.Sort((a, b) => a.LapDistPct.CompareTo(b.LapDistPct));

            // Normalise to 0–100 SVG viewBox with 5% padding
            NormaliseAndBuild(_samples);

            // Save to our cache + bundled dataset for git
            SaveToOwnCache(_currentTrackId);
            SaveToBundledMaps(_currentTrackId);

            SimHub.Logging.Current.Info($"[K10Motorsports] Track map recorded: {_outline.Length} points");
        }

        /// <summary>
        /// Check if the recorded points form a real circuit (2D shape)
        /// rather than a degenerate straight line.
        /// Uses the ratio of bounding box dimensions — a real track has
        /// both width and height, while a line is very narrow in one axis.
        /// </summary>
        private static bool ValidateTrackShape(List<TrackPoint> pts)
        {
            if (pts.Count < 20) return false;

            double minX = double.MaxValue, maxX = double.MinValue;
            double minZ = double.MaxValue, maxZ = double.MinValue;

            foreach (var p in pts)
            {
                if (p.WorldX < minX) minX = p.WorldX;
                if (p.WorldX > maxX) maxX = p.WorldX;
                if (p.WorldZ < minZ) minZ = p.WorldZ;
                if (p.WorldZ > maxZ) maxZ = p.WorldZ;
            }

            double rangeX = maxX - minX;
            double rangeZ = maxZ - minZ;
            double maxRange = Math.Max(rangeX, rangeZ);
            double minRange = Math.Min(rangeX, rangeZ);

            // If the narrower dimension is less than 5% of the wider, it's a line
            if (maxRange < 0.01) return false; // all points at same location
            double ratio = minRange / maxRange;
            return ratio > 0.05;
        }

        // ── Normalisation ──────────────────────────────────────────────────

        private void NormaliseAndBuild(List<TrackPoint> points)
        {
            double minX = double.MaxValue, maxX = double.MinValue;
            double minZ = double.MaxValue, maxZ = double.MinValue;

            foreach (var p in points)
            {
                if (p.WorldX < minX) minX = p.WorldX;
                if (p.WorldX > maxX) maxX = p.WorldX;
                if (p.WorldZ < minZ) minZ = p.WorldZ;
                if (p.WorldZ > maxZ) maxZ = p.WorldZ;
            }

            double rangeX = maxX - minX;
            double rangeZ = maxZ - minZ;
            if (rangeX < 0.01) rangeX = 1;
            if (rangeZ < 0.01) rangeZ = 1;

            // Uniform scale to fit in 90x90 (with 5% padding on each side)
            double scale = 90.0 / Math.Max(rangeX, rangeZ);
            double offsetX = (100.0 - rangeX * scale) / 2.0;
            double offsetZ = (100.0 - rangeZ * scale) / 2.0;

            _outline = new TrackPoint[points.Count];
            for (int i = 0; i < points.Count; i++)
            {
                _outline[i] = new TrackPoint
                {
                    X = (points[i].WorldX - minX) * scale + offsetX,
                    Y = (points[i].WorldZ - minZ) * scale + offsetZ,
                    LapDistPct = points[i].LapDistPct
                };
            }

            _svgPath = BuildSvgPath(_outline);
            _ready = true;
        }

        // ── SVG path building ──────────────────────────────────────────────

        private static string BuildSvgPath(TrackPoint[] pts)
        {
            if (pts.Length < 2) return "";

            var sb = new StringBuilder(pts.Length * 16);
            sb.Append("M ");
            sb.Append(F(pts[0].X));
            sb.Append(',');
            sb.Append(F(pts[0].Y));

            // Use Catmull-Rom → Cubic Bezier conversion for smooth curves
            for (int i = 0; i < pts.Length; i++)
            {
                int i0 = (i - 1 + pts.Length) % pts.Length;
                int i1 = i;
                int i2 = (i + 1) % pts.Length;
                int i3 = (i + 2) % pts.Length;

                double x1 = pts[i1].X + (pts[i2].X - pts[i0].X) / 6.0;
                double y1 = pts[i1].Y + (pts[i2].Y - pts[i0].Y) / 6.0;
                double x2 = pts[i2].X - (pts[i3].X - pts[i1].X) / 6.0;
                double y2 = pts[i2].Y - (pts[i3].Y - pts[i1].Y) / 6.0;

                sb.Append(" C ");
                sb.Append(F(x1)); sb.Append(','); sb.Append(F(y1));
                sb.Append(' ');
                sb.Append(F(x2)); sb.Append(','); sb.Append(F(y2));
                sb.Append(' ');
                sb.Append(F(pts[i2].X)); sb.Append(','); sb.Append(F(pts[i2].Y));
            }

            sb.Append(" Z");
            return sb.ToString();
        }

        private static string F(double v) => v.ToString("F1", CultureInfo.InvariantCulture);

        // ── Position interpolation ─────────────────────────────────────────

        private TrackPoint InterpolatePosition(double lapDistPct)
        {
            return InterpolateOnOutline(_outline, lapDistPct);
        }

        private static TrackPoint InterpolateOnOutline(TrackPoint[] outline, double lapDistPct)
        {
            if (outline == null || outline.Length < 2)
                return new TrackPoint { X = 50, Y = 50 };

            lapDistPct = lapDistPct % 1.0;
            if (lapDistPct < 0) lapDistPct += 1.0;

            // Handle near-wrap: if lapDistPct is very close to 0 or 1, snap to endpoints
            if (lapDistPct < outline[0].LapDistPct)
            {
                // Before the first sample — interpolate between last and first (wrap)
                double d0 = outline[outline.Length - 1].LapDistPct;
                double d1 = outline[0].LapDistPct + 1.0;
                double range = d1 - d0;
                if (range <= 0) range = 1;
                double t = (lapDistPct + 1.0 - d0) / range;
                t = Math.Max(0, Math.Min(1, t));
                return new TrackPoint
                {
                    X = outline[outline.Length - 1].X + (outline[0].X - outline[outline.Length - 1].X) * t,
                    Y = outline[outline.Length - 1].Y + (outline[0].Y - outline[outline.Length - 1].Y) * t
                };
            }

            // Binary search for the segment containing this lapDistPct
            int lo = 0, hi = outline.Length - 1;
            while (lo < hi - 1)
            {
                int mid = (lo + hi) / 2;
                if (outline[mid].LapDistPct <= lapDistPct) lo = mid;
                else hi = mid;
            }

            double d0b = outline[lo].LapDistPct;
            double d1b = outline[hi].LapDistPct;
            double rangeb = d1b - d0b;
            if (rangeb <= 0) rangeb = 1;

            double tb = (lapDistPct - d0b) / rangeb;
            tb = Math.Max(0, Math.Min(1, tb));

            return new TrackPoint
            {
                X = outline[lo].X + (outline[hi].X - outline[lo].X) * tb,
                Y = outline[lo].Y + (outline[hi].Y - outline[lo].Y) * tb
            };
        }

        // ── Opponent data serialisation ────────────────────────────────────

        private void BuildOpponentData()
        {
            if (_opponents.Count == 0) { OpponentData = ""; return; }

            var sb = new StringBuilder(_opponents.Count * 12);
            for (int i = 0; i < _opponents.Count; i++)
            {
                if (i > 0) sb.Append(';');
                sb.Append(F(_opponents[i].X));
                sb.Append(',');
                sb.Append(F(_opponents[i].Y));
                sb.Append(',');
                sb.Append(_opponents[i].InPit ? '1' : '0');
            }
            OpponentData = sb.ToString();
        }

        // ── File I/O: Track maps directory (CSV files loaded directly at runtime) ────

        /// <summary>
        /// Resolve the trackmaps directory. Checks two locations in order:
        ///   1. {SimHub}/k10-motorsports-data/trackmaps/  (post-build copy location)
        ///   2. {SimHub}/trackmaps/  (simple flat folder)
        /// Returns the first one that exists, or the primary path if neither does.
        /// </summary>
        private string GetTrackmapsDir()
        {
            if (string.IsNullOrEmpty(_simhubDir)) return "";

            // Primary: nested under k10-motorsports-data
            string primary = Path.Combine(_simhubDir, "k10-motorsports-data", "trackmaps");
            if (Directory.Exists(primary)) return primary;

            // Fallback: flat trackmaps folder in SimHub root
            string flat = Path.Combine(_simhubDir, "trackmaps");
            if (Directory.Exists(flat)) return flat;

            // Return the primary path (will be created on first save)
            return primary;
        }

        /// <summary>
        /// Returns all directories that may contain track maps (for UI display).
        /// </summary>
        public List<string> GetTrackMapSearchPaths()
        {
            var paths = new List<string>();
            if (string.IsNullOrEmpty(_simhubDir)) return paths;
            paths.Add(Path.Combine(_simhubDir, "k10-motorsports-data", "trackmaps"));
            paths.Add(Path.Combine(_simhubDir, "trackmaps"));
            paths.Add(GetOwnCacheDir());
            return paths;
        }

        private string GetTrackmapPath(string trackId)
        {
            string safe = trackId;
            foreach (char c in Path.GetInvalidFileNameChars())
                safe = safe.Replace(c, '_');
            return Path.Combine(GetTrackmapsDir(), safe + ".csv");
        }

        /// <summary>
        /// Try to load a track map from the trackmaps directory.
        /// Scans both the primary and flat locations. Uses CSV format (WorldX,WorldZ,LapDistPct).
        /// </summary>
        private bool TryLoadFromBundledMaps(string trackId)
        {
            if (string.IsNullOrEmpty(_simhubDir)) return false;

            // Check both possible trackmaps directories
            string[] dirs = new[]
            {
                Path.Combine(_simhubDir, "k10-motorsports-data", "trackmaps"),
                Path.Combine(_simhubDir, "trackmaps"),
            };

            string tidLower = (trackId ?? "").ToLowerInvariant().Replace(" ", "");

            foreach (string dir in dirs)
            {
                if (!Directory.Exists(dir)) continue;

                // Exact match first
                string safe = trackId ?? "";
                foreach (char c in Path.GetInvalidFileNameChars())
                    safe = safe.Replace(c, '_');
                string exactPath = Path.Combine(dir, safe + ".csv");
                if (File.Exists(exactPath) && TryLoadCsvMap(exactPath))
                    return true;

                // Fuzzy match: look for files containing the track ID
                if (string.IsNullOrEmpty(tidLower)) continue;
                foreach (string file in Directory.GetFiles(dir, "*.csv"))
                {
                    string name = Path.GetFileNameWithoutExtension(file).ToLowerInvariant().Replace(" ", "");
                    if (name.Contains(tidLower) || tidLower.Contains(name))
                    {
                        if (TryLoadCsvMap(file))
                            return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Load a CSV track map file (WorldX,WorldZ,LapDistPct per line).
        /// Shared between bundled maps and K10 cache loading.
        /// </summary>
        private bool TryLoadCsvMap(string filePath)
        {
            try
            {
                var points = new List<TrackPoint>();
                foreach (string line in File.ReadAllLines(filePath))
                {
                    string[] parts = line.Split(',');
                    if (parts.Length < 3) continue;
                    if (!double.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out double wx)) continue;
                    if (!double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out double wz)) continue;
                    if (!double.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out double dist)) continue;
                    points.Add(new TrackPoint { WorldX = wx, WorldZ = wz, LapDistPct = dist });
                }
                if (points.Count < 10) return false;
                points.Sort((a, b) => a.LapDistPct.CompareTo(b.LapDistPct));
                NormaliseAndBuild(points);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Save a recorded track map to the trackmaps directory as a CSV file.
        /// These CSV files are loaded directly at runtime — no recompilation needed.
        /// </summary>
        private void SaveToBundledMaps(string trackId)
        {
            try
            {
                string dir = GetTrackmapsDir();
                if (string.IsNullOrEmpty(dir)) return;
                Directory.CreateDirectory(dir);
                string path = GetTrackmapPath(trackId);

                var sb = new StringBuilder(_samples.Count * 40);
                foreach (var s in _samples)
                {
                    sb.Append(s.WorldX.ToString("F4", CultureInfo.InvariantCulture));
                    sb.Append(',');
                    sb.Append(s.WorldZ.ToString("F4", CultureInfo.InvariantCulture));
                    sb.Append(',');
                    sb.AppendLine(s.LapDistPct.ToString("F6", CultureInfo.InvariantCulture));
                }

                File.WriteAllText(path, sb.ToString());
                SimHub.Logging.Current.Info($"[K10Motorsports] Track map saved to bundled dataset: {path}");
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Warn($"[K10Motorsports] Failed to save to bundled maps: {ex.Message}");
            }
        }

        /// <summary>
        /// Returns a list of all track IDs that have maps in the trackmaps directory.
        /// </summary>
        public List<string> GetBundledTrackIds()
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var ids = new List<string>();

            // Scan all trackmaps directories
            string[] dirs = string.IsNullOrEmpty(_simhubDir) ? new string[0] : new[]
            {
                Path.Combine(_simhubDir, "k10-motorsports-data", "trackmaps"),
                Path.Combine(_simhubDir, "trackmaps"),
            };

            foreach (string dir in dirs)
            {
                if (!Directory.Exists(dir)) continue;
                foreach (string file in Directory.GetFiles(dir, "*.csv"))
                {
                    string name = Path.GetFileNameWithoutExtension(file);
                    if (seen.Add(name))
                        ids.Add(name);
                }
            }

            ids.Sort(StringComparer.OrdinalIgnoreCase);
            return ids;
        }

        /// <summary>
        /// Returns track IDs that exist only in the local K10 cache (recorded during gameplay)
        /// but not yet in the trackmaps directory.
        /// </summary>
        public List<string> GetLocalOnlyTrackIds()
        {
            var localOnly = new List<string>();
            string cacheDir = GetOwnCacheDir();
            if (!Directory.Exists(cacheDir)) return localOnly;

            var inDir = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string[] dirs = string.IsNullOrEmpty(_simhubDir) ? new string[0] : new[]
            {
                Path.Combine(_simhubDir, "k10-motorsports-data", "trackmaps"),
                Path.Combine(_simhubDir, "trackmaps"),
            };

            foreach (string dir in dirs)
            {
                if (!Directory.Exists(dir)) continue;
                foreach (string file in Directory.GetFiles(dir, "*.csv"))
                    inDir.Add(Path.GetFileNameWithoutExtension(file));
            }

            foreach (string file in Directory.GetFiles(cacheDir, "*.csv"))
            {
                string name = Path.GetFileNameWithoutExtension(file);
                if (!inDir.Contains(name))
                    localOnly.Add(name);
            }

            localOnly.Sort(StringComparer.OrdinalIgnoreCase);
            return localOnly;
        }

        /// <summary>
        /// Copies all local-only track maps (not already in trackmaps dir) to the specified directory.
        /// Returns the number of files copied.
        /// </summary>
        public int ExportLocalMapsTo(string destinationDir)
        {
            if (string.IsNullOrEmpty(destinationDir)) return 0;

            string cacheDir = GetOwnCacheDir();
            if (!Directory.Exists(cacheDir)) return 0;

            var inDir = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string[] dirs = string.IsNullOrEmpty(_simhubDir) ? new string[0] : new[]
            {
                Path.Combine(_simhubDir, "k10-motorsports-data", "trackmaps"),
                Path.Combine(_simhubDir, "trackmaps"),
            };

            foreach (string dir in dirs)
            {
                if (!Directory.Exists(dir)) continue;
                foreach (string file in Directory.GetFiles(dir, "*.csv"))
                    inDir.Add(Path.GetFileNameWithoutExtension(file));
            }

            Directory.CreateDirectory(destinationDir);
            int count = 0;

            foreach (string file in Directory.GetFiles(cacheDir, "*.csv"))
            {
                string name = Path.GetFileNameWithoutExtension(file);
                if (inDir.Contains(name)) continue;

                string dest = Path.Combine(destinationDir, Path.GetFileName(file));
                File.Copy(file, dest, true);
                count++;
            }

            return count;
        }

        // ── File I/O: SimHub map cache ─────────────────────────────────────

        private bool TryLoadFromSimHub(string trackId)
        {
            if (string.IsNullOrEmpty(_simhubDir) || string.IsNullOrEmpty(trackId))
                return false;

            // SimHub stores map records in several possible locations
            string[] searchPaths = new[]
            {
                Path.Combine(_simhubDir, "PluginsData", "IRacing", "MapRecords"),
                Path.Combine(_simhubDir, "PluginsData", "Common", "TrackMaps"),
                Path.Combine(_simhubDir, "PluginsData", "Common", "PersistantTracker"),
            };

            foreach (string dir in searchPaths)
            {
                if (!Directory.Exists(dir)) continue;

                // Look for files matching the track ID
                foreach (string file in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
                {
                    string name = Path.GetFileNameWithoutExtension(file).ToLowerInvariant();
                    string tid = trackId.ToLowerInvariant().Replace(" ", "");
                    if (name.Contains(tid) || tid.Contains(name))
                    {
                        if (TryParseMapFile(file))
                            return true;
                    }
                }
            }

            return false;
        }

        private bool TryParseMapFile(string filePath)
        {
            try
            {
                string content = File.ReadAllText(filePath);

                // Try to parse as JSON array of {x, y} or {X, Y} or [x, y] points
                var points = ParseCoordinateJson(content);
                if (points.Count < 10) return false;

                // Assign evenly-spaced LapDistPct values
                // (TrackPoint is a struct, so we must replace the whole element)
                for (int i = 0; i < points.Count; i++)
                {
                    var pt = points[i];
                    pt.LapDistPct = (double)i / points.Count;
                    points[i] = pt;
                }

                NormaliseAndBuild(points);
                return true;
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Warn($"[K10Motorsports] Failed to parse map file '{filePath}': {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Parses various JSON formats that SimHub and community map tools use:
        ///   - Array of objects: [{"x": 1.0, "y": 2.0}, ...]
        ///   - Array of arrays:  [[1.0, 2.0], [3.0, 4.0], ...]
        ///   - Object with points array: {"points": [...], ...}
        /// Uses simple string parsing to avoid needing Newtonsoft.Json dependency.
        /// </summary>
        private static List<TrackPoint> ParseCoordinateJson(string json)
        {
            var points = new List<TrackPoint>();

            // Strip whitespace for easier parsing
            json = json.Trim();

            // Look for arrays of numbers — extract all number pairs
            // Pattern: find sequences of two adjacent numbers
            var numbers = new List<double>();
            int idx = 0;
            while (idx < json.Length)
            {
                // Skip to next digit or minus sign
                while (idx < json.Length && !char.IsDigit(json[idx]) && json[idx] != '-' && json[idx] != '.')
                    idx++;

                if (idx >= json.Length) break;

                // Extract number
                int start = idx;
                if (json[idx] == '-') idx++;
                while (idx < json.Length && (char.IsDigit(json[idx]) || json[idx] == '.' || json[idx] == 'e' || json[idx] == 'E' || json[idx] == '+' || json[idx] == '-'))
                {
                    if ((json[idx] == '-' || json[idx] == '+') && idx > start && json[idx - 1] != 'e' && json[idx - 1] != 'E')
                        break;
                    idx++;
                }

                string numStr = json.Substring(start, idx - start);
                if (double.TryParse(numStr, NumberStyles.Float, CultureInfo.InvariantCulture, out double val))
                {
                    numbers.Add(val);
                }
            }

            // Pair up as X, Y coordinates
            for (int i = 0; i + 1 < numbers.Count; i += 2)
            {
                points.Add(new TrackPoint { WorldX = numbers[i], WorldZ = numbers[i + 1] });
            }

            return points;
        }

        // ── File I/O: our own cache ────────────────────────────────────────

        private string GetOwnCacheDir()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SimHub", "PluginsData", "K10Motorsports", "TrackMaps");
        }

        private string GetOwnCachePath(string trackId)
        {
            // Sanitise track ID for filename
            string safe = trackId;
            foreach (char c in Path.GetInvalidFileNameChars())
                safe = safe.Replace(c, '_');
            return Path.Combine(GetOwnCacheDir(), safe + ".csv");
        }

        private bool TryLoadFromOwnCache(string trackId)
        {
            string path = GetOwnCachePath(trackId);
            if (!File.Exists(path)) return false;
            return TryLoadCsvMap(path);
        }

        private void SaveToOwnCache(string trackId)
        {
            try
            {
                string dir = GetOwnCacheDir();
                Directory.CreateDirectory(dir);
                string path = GetOwnCachePath(trackId);

                var sb = new StringBuilder(_samples.Count * 40);
                foreach (var s in _samples)
                {
                    sb.Append(s.WorldX.ToString("F4", CultureInfo.InvariantCulture));
                    sb.Append(',');
                    sb.Append(s.WorldZ.ToString("F4", CultureInfo.InvariantCulture));
                    sb.Append(',');
                    sb.AppendLine(s.LapDistPct.ToString("F6", CultureInfo.InvariantCulture));
                }

                File.WriteAllText(path, sb.ToString());
                SimHub.Logging.Current.Info($"[K10Motorsports] Track map saved to {path}");
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Warn($"[K10Motorsports] Failed to save track map: {ex.Message}");
            }
        }

        // ── Demo track outline ─────────────────────────────────────────────

        private static string DemoSvgPath
        {
            get
            {
                EnsureDemoOutline();
                return _demoSvgPath;
            }
        }

        private static void EnsureDemoOutline()
        {
            if (_demoOutline != null) return;

            // A fictitious circuit resembling a classic European road course
            // 48 points, normalised to 0–100 viewBox
            double[][] raw = new double[][]
            {
                new[]{35.0, 95.0}, new[]{25.0, 93.0}, new[]{15.0, 88.0}, new[]{8.0, 80.0},
                new[]{5.0, 70.0},  new[]{6.0, 60.0},  new[]{10.0, 50.0}, new[]{8.0, 40.0},
                new[]{5.0, 32.0},  new[]{8.0, 22.0},  new[]{15.0, 14.0}, new[]{25.0, 8.0},
                new[]{35.0, 5.0},  new[]{45.0, 5.0},  new[]{52.0, 8.0},  new[]{55.0, 15.0},
                new[]{53.0, 22.0}, new[]{48.0, 28.0},  new[]{50.0, 35.0}, new[]{56.0, 40.0},
                new[]{65.0, 38.0}, new[]{72.0, 32.0},  new[]{78.0, 25.0}, new[]{85.0, 20.0},
                new[]{92.0, 22.0}, new[]{95.0, 30.0},  new[]{93.0, 40.0}, new[]{88.0, 48.0},
                new[]{82.0, 52.0}, new[]{78.0, 58.0},  new[]{80.0, 65.0}, new[]{85.0, 70.0},
                new[]{90.0, 75.0}, new[]{92.0, 82.0},  new[]{88.0, 88.0}, new[]{80.0, 92.0},
                new[]{70.0, 94.0}, new[]{60.0, 93.0},  new[]{52.0, 90.0}, new[]{45.0, 95.0},
            };

            _demoOutline = new TrackPoint[raw.Length];
            for (int i = 0; i < raw.Length; i++)
            {
                _demoOutline[i] = new TrackPoint
                {
                    X = raw[i][0],
                    Y = raw[i][1],
                    LapDistPct = (double)i / raw.Length
                };
            }

            _demoSvgPath = BuildSvgPath(_demoOutline);
        }

        // ── Data types ─────────────────────────────────────────────────────

        private struct TrackPoint
        {
            public double WorldX, WorldZ;  // raw world coordinates (recording phase)
            public double X, Y;            // normalised SVG coordinates (0–100)
            public double LapDistPct;      // 0.0–1.0 fraction around the lap
        }

        private struct OpponentPos
        {
            public double X, Y;
            public bool InPit;
        }
    }
}
