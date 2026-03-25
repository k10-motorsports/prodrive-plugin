using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using GameReaderCommon;
using K10MediaBroadcaster.Plugin.Engine;
using SimHub.Plugins;

namespace K10MediaBroadcaster.Plugin
{
    [PluginDescription("Displays real-time commentary prompts while sim racing, timed to telemetry events.")]
    [PluginAuthor("K10MediaBroadcaster")]
    [PluginName("K10 Media Broadcaster")]
    public class Plugin : IPlugin, IDataPlugin, IWPFSettingsV2
    {
        public Settings Settings { get; private set; }
        public PluginManager PluginManager { get; set; }

        public ImageSource PictureIcon => new BitmapImage(new Uri(
            "pack://application:,,,/K10MediaBroadcaster.Plugin;component/icon.png"));
        public string LeftMenuTitle => "K10 Media Broadcaster";

#if CROSS_PLATFORM
        // Cross-platform build: settings panel excluded (no XAML compiler on Linux/macOS).
        // Return null — SimHub shows default settings when the plugin has no WPF panel.
        public System.Windows.Controls.Control GetWPFSettingsControl(PluginManager pluginManager) => null;
#endif

        // Engine
        private readonly CommentaryEngine  _engine   = new CommentaryEngine();
        private readonly TelemetryRecorder _recorder = new TelemetryRecorder();
        private readonly TrackMapProvider  _trackMap = new TrackMapProvider();
        private readonly Engine.IRacingSdkBridge _sdkBridge = new Engine.IRacingSdkBridge();
        private FeedbackEngine _feedback;

        // Telemetry frames (current + previous for delta calculations)
        private TelemetrySnapshot _current  = new TelemetrySnapshot();
        private TelemetrySnapshot _previous = new TelemetrySnapshot();

        // Frame counter — we evaluate triggers every N frames to reduce CPU load
        // at 60fps, every 6 frames = ~100ms evaluation cadence
        private int _frameCount = 0;
        private const int EvalEveryNFrames = 6;

        // Track change detection — triggers map reload
        private string _lastTrackId = "";

        // HTTP state server — exposes plugin state on port 8889 for Homebridge
        private HttpListener _httpListener;
        private Thread _httpThread;

        // Start position tracking — captured once when race goes green
        private int _startPosition = 0;
        private bool _startPositionCaptured = false;

        // Start lights state machine — synthesized from PaceMode/SessionState
        private int _lightsPhase = 0;         // 0=off, 1-5=building reds, 6=all red, 7=green, 8=done
        private int _lightsPrevPaceMode = 0;
        private int _lightsPrevSessionState = 0;
        private int _lightsHoldFrames = 0;    // countdown for timed phases
        private int _lightsStepFrame = 0;     // countdown for building each red

        // Leaderboard: compact JSON string of nearby drivers, updated each eval cycle
        private volatile string _leaderboardJson = "[]";

        // ── Track map queries (for settings UI) ─────────────────────────────

        /// <summary>Track IDs bundled with the plugin (compiled into git).</summary>
        public List<string> GetBundledTrackIds() => _trackMap.GetBundledTrackIds();

        /// <summary>Track IDs recorded locally but not yet in the trackmaps directory.</summary>
        public List<string> GetLocalOnlyTrackIds() => _trackMap.GetLocalOnlyTrackIds();

        /// <summary>Copy local-only track maps to a destination folder. Returns count copied.</summary>
        public int ExportLocalMapsTo(string destinationDir) => _trackMap.ExportLocalMapsTo(destinationDir);

        /// <summary>Returns the list of directories searched for track map CSVs.</summary>
        public List<string> GetTrackMapSearchPaths() => _trackMap.GetTrackMapSearchPaths();

        // ── IWPFSettingsV2 ────────────────────────────────────────────────────

#if !CROSS_PLATFORM
        private SettingsControl _settingsControl;
        public System.Windows.Controls.Control GetWPFSettingsControl(PluginManager pluginManager)
            => _settingsControl = new SettingsControl(this);
#endif

        // ── IDataPlugin ───────────────────────────────────────────────────────

        public void Init(PluginManager pluginManager)
        {
            SimHub.Logging.Current.Info("[K10MediaBroadcaster] Initialising K10 Media Broadcaster plugin");

            // Load settings
            Settings = this.ReadCommonSettings<Settings>("GeneralSettings", () => new Settings());

            // Initialise feedback engine
            string feedbackPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SimHub", "PluginsData", "K10MediaBroadcaster", "feedback.json");
            _feedback = new FeedbackEngine(feedbackPath);
            _engine.GetCooldownMultiplier = id => _feedback.GetMultiplier(id);

            ApplySettings();

            // Load topics dataset
            string topicsPath = ResolveTopicsPath();
            _engine.LoadTopics(topicsPath);

            // Load sentiments (for background colors)
            string sentimentsPath = ResolveDatasetFile("sentiments.json");
            _engine.LoadSentiments(sentimentsPath);

            // Load commentary fragments (for sentence composition)
            string fragmentsPath = ResolveDatasetFile("commentary_fragments.json");
            _engine.LoadFragments(fragmentsPath);

            // Initialise iRacing SDK bridge (direct shared memory via IRSDKSharper)
            TelemetrySnapshot._sdkBridge = _sdkBridge;
            _sdkBridge.Start();

            // Initialise track map provider
            // The DLL is output directly into the SimHub root folder (not a Plugins\ subfolder),
            // so the assembly's directory IS the SimHub directory.
            string simhubDir = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? "";
            _trackMap.SetSimHubDirectory(simhubDir);

            // ── Register dashboard properties ─────────────────────────────────

            // The full commentary prompt text (or event exposition in event-only mode)
            this.AttachDelegate("CommentaryText", () => BuildDisplayText());

            // Boolean: whether the panel should be visible
            this.AttachDelegate("CommentaryVisible", () => _engine.IsVisible ? 1 : 0);

            // Category with severity/sentiment label, e.g. "car_response — Urgent"
            this.AttachDelegate("CommentaryCategory", () =>
            {
                string cat = _engine.CurrentCategory;
                string label = _engine.CurrentSentimentLabel;
                return string.IsNullOrEmpty(label) ? cat : cat + " — " + label;
            });

            // Track position: sector + lap distance percentage
            this.AttachDelegate("CommentaryTrackPosition", () =>
            {
                if (!_current.GameRunning) return "";
                int pct = (int)Math.Round(_current.TrackPositionPct * 100);
                return $"Lap {_current.CurrentLap} · {pct}%";
            });

            // Short topic title
            this.AttachDelegate("CommentaryTopicTitle", () => _engine.CurrentTitle);

            // Topic ID (snake_case) for icon lookup in dashboard
            this.AttachDelegate("CommentaryTopicId", () => _engine.CurrentTopicId);

            // Seconds remaining until auto-clear (integer for clean display)
            this.AttachDelegate("CommentarySecondsRemaining", () => (int)Math.Round(_engine.SecondsRemaining));

            // Overlay color: category determines hue, severity determines opacity (#AARRGGBB)
            this.AttachDelegate("CommentarySentimentColor", () => _engine.CurrentSentimentColor);

            // WCAG-compliant text color — same shade as overlay, bright for readability (#AARRGGBB)
            this.AttachDelegate("CommentaryTextColor", () => _engine.CurrentTextColor);

            // Severity level (1-5) for the current prompt, 0 when no prompt visible.
            // Dashboard uses this to toggle per-severity background elements.
            this.AttachDelegate("CommentarySeverity", () => _engine.IsVisible ? _engine.CurrentSeverity : 0);

            // Flag state for Homebridge and dashboard — priority order, most urgent first.
            // All iRacing flags are now exposed so lights respond correctly.
            // "meatball" = repair required (iRacing 0x100000)
            // "orange" = car ahead is being blue-flagged for us (we are lapping them)
            this.AttachDelegate("CurrentFlagState", () =>
            {
                if (!_current.GameRunning) return "none";
                int f = _current.SessionFlags;
                if ((f & TelemetrySnapshot.FLAG_RED)       != 0) return "red";
                if ((f & TelemetrySnapshot.FLAG_REPAIR)    != 0) return "meatball";
                if ((f & TelemetrySnapshot.FLAG_BLACK)     != 0) return "black";
                if ((f & TelemetrySnapshot.FLAG_YELLOW)    != 0) return "yellow";
                if ((f & TelemetrySnapshot.FLAG_BLUE)      != 0) return "blue";
                if ((f & TelemetrySnapshot.FLAG_DEBRIS)    != 0) return "debris";
                if ((f & TelemetrySnapshot.FLAG_WHITE)     != 0) return "white";
                if ((f & TelemetrySnapshot.FLAG_CHECKERED) != 0) return "checkered";
                if ((f & TelemetrySnapshot.FLAG_GREEN)     != 0) return "green";
                // Orange flag: detect if we are lapping the car immediately ahead
                if (IsLappingCarAhead(_current)) return "orange";
                return "none";
            });

            // ── Demo mode flag — dashboard reads this to swap data sources ─────
            this.AttachDelegate("DemoMode", () => Settings.DemoMode ? 1 : 0);

            // ── Demo telemetry properties — populated by DemoTelemetryProvider ──
            // When DemoMode == 1, the dashboard reads these instead of GameData
            var dt = _engine.DemoTelemetry; // shorthand

            this.AttachDelegate("Demo.Gear",       () => dt.Gear);
            this.AttachDelegate("Demo.Rpm",        () => dt.Rpm);
            this.AttachDelegate("Demo.MaxRpm",     () => dt.MaxRpm);
            this.AttachDelegate("Demo.SpeedMph",   () => dt.SpeedMph);
            this.AttachDelegate("Demo.Throttle",   () => dt.Throttle * 100); // 0-100 to match SimHub GameData
            this.AttachDelegate("Demo.Brake",      () => dt.Brake * 100);
            this.AttachDelegate("Demo.Clutch",     () => dt.Clutch * 100);
            this.AttachDelegate("Demo.Fuel",       () => dt.Fuel);
            this.AttachDelegate("Demo.MaxFuel",    () => dt.MaxFuel);
            this.AttachDelegate("Demo.FuelPerLap", () => dt.FuelPerLap);
            this.AttachDelegate("Demo.RemainingLaps", () => dt.RemainingLaps);
            this.AttachDelegate("Demo.TyreTempFL", () => dt.TyreTempFL);
            this.AttachDelegate("Demo.TyreTempFR", () => dt.TyreTempFR);
            this.AttachDelegate("Demo.TyreTempRL", () => dt.TyreTempRL);
            this.AttachDelegate("Demo.TyreTempRR", () => dt.TyreTempRR);
            this.AttachDelegate("Demo.TyreWearFL", () => dt.TyreWearFL);
            this.AttachDelegate("Demo.TyreWearFR", () => dt.TyreWearFR);
            this.AttachDelegate("Demo.TyreWearRL", () => dt.TyreWearRL);
            this.AttachDelegate("Demo.TyreWearRR", () => dt.TyreWearRR);
            this.AttachDelegate("Demo.BrakeBias",  () => dt.BrakeBias);
            this.AttachDelegate("Demo.TC",         () => dt.TC);
            this.AttachDelegate("Demo.ABS",        () => dt.ABS);
            this.AttachDelegate("Demo.Position",   () => dt.Position);
            this.AttachDelegate("Demo.CurrentLap", () => dt.CurrentLap);
            this.AttachDelegate("Demo.BestLapTime",() => dt.BestLapTime);
            this.AttachDelegate("Demo.CarModel",   () => dt.CarModel);
            this.AttachDelegate("Demo.SessionTime",   () => dt.SessionTime);
            this.AttachDelegate("Demo.LastLapTime",   () => dt.LastLapTime);
            this.AttachDelegate("Demo.RemainingTime", () => dt.RemainingTime);
            this.AttachDelegate("Demo.TotalLaps",     () => dt.TotalLaps);
            this.AttachDelegate("Demo.IRating",    () => dt.IRating);
            this.AttachDelegate("Demo.SafetyRating",() => dt.SafetyRating);
            this.AttachDelegate("Demo.GapAhead",   () => dt.GapAhead);
            this.AttachDelegate("Demo.GapBehind",  () => dt.GapBehind);
            this.AttachDelegate("Demo.DriverAhead", () => dt.DriverAhead);
            this.AttachDelegate("Demo.DriverBehind",() => dt.DriverBehind);
            this.AttachDelegate("Demo.IRAhead",    () => dt.IRAhead);
            this.AttachDelegate("Demo.IRBehind",   () => dt.IRBehind);

            // ── Track map properties — SVG path + car positions ────────────────
            this.AttachDelegate("TrackMap.Ready",      () => _trackMap.IsReady ? 1 : 0);
            this.AttachDelegate("TrackMap.SvgPath",    () => _trackMap.SvgPath);
            this.AttachDelegate("TrackMap.PlayerX",    () => _trackMap.PlayerX);
            this.AttachDelegate("TrackMap.PlayerY",    () => _trackMap.PlayerY);
            this.AttachDelegate("TrackMap.Opponents",  () => _trackMap.OpponentData);
            this.AttachDelegate("TrackMap.OpponentCount", () => _trackMap.OpponentCount);
            this.AttachDelegate("TrackMap.Recording",  () => !_trackMap.IsReady ? 1 : 0);

            // Nearest car distance fraction for proximity-based lighting
            this.AttachDelegate("NearestCarDistance", () =>
            {
                if (!_current.GameRunning || _current.CarIdxLapDistPct == null || _current.CarIdxLapDistPct.Length == 0)
                    return 1.0;
                double playerPos = _current.TrackPositionPct;
                int playerIdx = _current.PlayerCarIdx;
                double minDist = 1.0;
                for (int i = 0; i < _current.CarIdxLapDistPct.Length; i++)
                {
                    if (i == playerIdx) continue;
                    double otherPos = _current.CarIdxLapDistPct[i];
                    if (otherPos <= 0) continue;
                    double delta = Math.Abs(playerPos - otherPos);
                    delta = Math.Min(delta, 1.0 - delta);
                    if (delta < minDist) minDist = delta;
                }
                return minDist;
            });

            // ── Actions ───────────────────────────────────────────────────────

            // Manually dismiss the current prompt
            this.AddAction("DismissPrompt", (a, b) =>
            {
                _engine.ClearPrompt();
                SimHub.Logging.Current.Info("[K10MediaBroadcaster] Prompt dismissed by user action");
            });

            // Feedback actions — bind to a button box or SimHub Control Mapper
            this.AddAction("ThumbsUp", (a, b) =>
            {
                _feedback.Record(_engine.CurrentTopicId, _engine.CurrentText, +1);
                SimHub.Logging.Current.Info($"[K10MediaBroadcaster] ThumbsUp: {_engine.CurrentTopicId}");
            });

            this.AddAction("ThumbsDown", (a, b) =>
            {
                _feedback.Record(_engine.CurrentTopicId, _engine.CurrentText, -1);
                SimHub.Logging.Current.Info($"[K10MediaBroadcaster] ThumbsDown: {_engine.CurrentTopicId}");
            });

            // Recording toggle actions
            this.AddAction("StartRecording", (a, b) =>
            {
                Settings.RecordMode = true;
                ApplySettings();
            });

            this.AddAction("StopRecording", (a, b) =>
            {
                Settings.RecordMode = false;
                ApplySettings();
            });

            // ── Events ────────────────────────────────────────────────────────
            this.AddEvent("NewCommentaryPrompt");

            // Show a brief placeholder so the dashboard is visible before any game starts
            _engine.ShowDemoPrompt();

            // Start local HTTP server for Homebridge integration
            StartHttpServer();

            SimHub.Logging.Current.Info("[K10MediaBroadcaster] Initialisation complete");
        }

        /// <summary>
        /// Detect if the player is lapping the car immediately ahead.
        /// Returns true when the nearest car ahead has fewer completed laps
        /// AND is within ~3s gap — meaning they should be yielding (blue flag for them).
        /// The dashboard shows this as an "orange flag" so the player knows the car
        /// ahead is being told to let them through.
        /// </summary>
        private static bool IsLappingCarAhead(TelemetrySnapshot s)
        {
            if (s.CarIdxLapDistPct == null || s.CarIdxLapDistPct.Length == 0) return false;
            if (s.CarIdxLapCompleted == null || s.CarIdxLapCompleted.Length == 0) return false;
            if (s.PlayerCarIdx < 0 || s.PlayerCarIdx >= s.CarIdxLapCompleted.Length) return false;

            int playerLaps = s.CarIdxLapCompleted[s.PlayerCarIdx];
            if (playerLaps <= 0) return false;

            float playerDist = s.PlayerCarIdx < s.CarIdxLapDistPct.Length
                ? s.CarIdxLapDistPct[s.PlayerCarIdx] : 0;
            if (playerDist <= 0) return false;

            // Find the nearest car ahead on track (by LapDistPct)
            double bestGap = double.MaxValue;
            int bestIdx = -1;
            for (int i = 0; i < s.CarIdxLapDistPct.Length; i++)
            {
                if (i == s.PlayerCarIdx) continue;
                float dist = s.CarIdxLapDistPct[i];
                if (dist <= 0 || dist > 1) continue;
                // Skip cars in pit
                if (s.CarIdxOnPitRoad != null && i < s.CarIdxOnPitRoad.Length && s.CarIdxOnPitRoad[i]) continue;

                // Gap ahead = their dist - our dist (positive = they're ahead)
                double gap = dist - playerDist;
                if (gap < 0) gap += 1.0; // wrap around
                if (gap > 0 && gap < bestGap)
                {
                    bestGap = gap;
                    bestIdx = i;
                }
            }

            if (bestIdx < 0) return false;
            if (bestIdx >= s.CarIdxLapCompleted.Length) return false;

            // The car ahead has fewer laps = they're a lapped car
            int aheadLaps = s.CarIdxLapCompleted[bestIdx];
            if (aheadLaps >= playerLaps) return false;

            // Only show when we're close enough that the blue flag would be shown to them
            // (~3% track distance ≈ within about 3-5 seconds at typical speeds)
            return bestGap < 0.04;
        }

        public void DataUpdate(PluginManager pluginManager, ref GameData data)
        {
            // Capture current telemetry every frame (cheap snapshot)
            _previous = _current;
            _current  = TelemetrySnapshot.Capture(pluginManager, ref data);

            // ── Start position tracking ──
            // Capture the grid position once when the session goes to Racing (state 4)
            // Reset when session state drops back (new race / reconnect).
            if (_current.SessionState == 4 && !_startPositionCaptured && _current.Position > 0)
            {
                _startPosition = _current.Position;
                _startPositionCaptured = true;
            }
            else if (_current.SessionState < 4)
            {
                _startPositionCaptured = false;
                _startPosition = 0;
            }
            _current.StartPosition = _startPosition;

            // Detect track changes — reload map when track ID changes
            if (_current.GameRunning)
            {
                string trackId = GetTrackId(pluginManager);
                if (!string.IsNullOrEmpty(trackId) && trackId != _lastTrackId)
                {
                    _lastTrackId = trackId;
                    _trackMap.OnTrackChanged(trackId);
                }

                // Feed velocity + car positions to the track map provider every frame
                // (recording needs high sample rate; interpolation is cheap)
                _trackMap.Update(
                    _current.VelocityX, _current.VelocityZ,
                    _current.Yaw,
                    _current.TrackPositionPct,
                    _current.CarIdxLapDistPct,
                    _current.CarIdxOnPitRoad,
                    _current.PlayerCarIdx,
                    _current.Position,
                    _current.IsInPitLane);
            }

            // Only run commentary evaluation every N frames
            _frameCount++;
            if (_frameCount < EvalEveryNFrames) return;
            _frameCount = 0;

            // Update demo track map if in demo mode
            if (Settings.DemoMode)
            {
                var dt = _engine.DemoTelemetry;
                _trackMap.UpdateDemo(dt.TrackPosition, 19, dt.Elapsed); // 19 opponents = 20 car field
            }

            // ── Leaderboard capture ───────────────────────────────────────
            try
            {
                if (Settings.DemoMode)
                    _leaderboardJson = BuildDemoLeaderboard(_engine.DemoTelemetry);
                else if (_current.GameRunning && data.NewData != null)
                    _leaderboardJson = BuildLeaderboard(data.NewData, _current.Position);
                else
                    _leaderboardJson = "[]";
            }
            catch { _leaderboardJson = "[]"; }

            // Push live driver name from iRacing into commentary engine
            if (!string.IsNullOrEmpty(_current.PlayerName))
            {
                var parts = _current.PlayerName.Trim().Split(new[] { ' ' }, 2);
                _engine.DriverFirstName = parts[0];
                _engine.DriverLastName  = parts.Length > 1 ? parts[1] : "";
            }

            // Synthesize start lights from PaceMode/SessionState
            UpdateLightsPhase();

            bool wasVisible = _engine.IsVisible;
            _engine.Update(_current, _previous);

            // Write telemetry frame to recording if active
            if (_recorder.IsRecording)
                _recorder.Write(_current);

            // Fire event when a new prompt appears
            if (_engine.IsVisible && !wasVisible)
                this.TriggerEvent("NewCommentaryPrompt");
        }

        public void End(PluginManager pluginManager)
        {
            _sdkBridge.Stop();
            StopHttpServer();
            _recorder.StopRecording();
            this.SaveCommonSettings("GeneralSettings", Settings);
            SimHub.Logging.Current.Info("[K10MediaBroadcaster] Plugin stopped, settings saved");
        }

        // ── Internal helpers ──────────────────────────────────────────────────

        /// <summary>
        /// Synthesize F1-style start lights from iRacing PaceMode / SessionState.
        /// Rolling start: PaceMode 2 (Approaching) → build reds, PaceMode 3 (CrossSF) → all red hold,
        /// SessionState 3→4 transition → green. Called every eval cycle (~100ms).
        /// </summary>
        private void UpdateLightsPhase()
        {
            int ss = _current.SessionState;
            int pm = _current.PaceMode;

            // Green flag: session just went to Racing (4) from formation (3)
            if (ss == 4 && _lightsPrevSessionState == 3 && _lightsPhase >= 1 && _lightsPhase <= 6)
            {
                _lightsPhase = 7; // GREEN!
                _lightsHoldFrames = 15; // hold green ~1.5s
            }
            // Green hold → done
            else if (_lightsPhase == 7)
            {
                _lightsHoldFrames--;
                if (_lightsHoldFrames <= 0) _lightsPhase = 8;
            }
            // Done → fade out → reset
            else if (_lightsPhase == 8)
            {
                _lightsHoldFrames--;
                if (_lightsHoldFrames <= -10) _lightsPhase = 0;
            }
            // All red hold — waiting for green
            else if (_lightsPhase == 6)
            {
                // Just hold until green flag (handled above)
            }
            // Building reds 1-5
            else if (_lightsPhase >= 1 && _lightsPhase < 6)
            {
                _lightsStepFrame--;
                if (_lightsStepFrame <= 0)
                {
                    _lightsPhase++;
                    _lightsStepFrame = 8; // ~0.8s per light column
                }
            }
            // Not active — detect start condition
            else if (_lightsPhase == 0)
            {
                // PaceMode transitions to 2+ during formation (SS 3)
                bool pmTransition = ss == 3 && pm >= 2 && _lightsPrevPaceMode < 2;
                // SessionState transitions to 3 while PaceMode already >= 2
                // (rolling starts: PM can already be 2 when SS goes to 3)
                bool ssTransition = ss == 3 && _lightsPrevSessionState != 3 && pm >= 2;

                if (pmTransition || ssTransition)
                {
                    if (pm == 3)
                        _lightsPhase = 6; // jump to all red
                    else
                    {
                        _lightsPhase = 1;
                        _lightsStepFrame = 8;
                    }
                }
                // If we somehow get PaceMode 3 directly
                else if (ss == 3 && pm == 3 && _lightsPrevPaceMode < 3)
                {
                    _lightsPhase = 6; // jump to all red
                }
            }

            // If session goes back to non-formation unexpectedly, reset
            if (ss <= 1 && _lightsPhase > 0 && _lightsPhase < 7)
            {
                _lightsPhase = 0;
            }

            _lightsPrevPaceMode = pm;
            _lightsPrevSessionState = ss;
        }

        public void ApplySettings()
        {
            _engine.DisplaySeconds    = Settings.PromptDisplaySeconds;
            _engine.EventOnlyMode     = Settings.EventOnlyMode;
            _engine.DemoMode          = Settings.DemoMode;
            _engine.DriverFirstName   = Settings.DriverFirstName ?? "";
            _engine.DriverLastName    = Settings.DriverLastName ?? "";
            _trackMap.SetDemoMode(Settings.DemoMode);
            _engine.EnabledCategories = Settings.EnabledCategories?.Count > 0
                ? new System.Collections.Generic.HashSet<string>(Settings.EnabledCategories)
                : null;

            if (Settings.RecordMode && !_recorder.IsRecording)
            {
                string dllDir = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? "";
                string dir = Path.Combine(dllDir, "k10-media-broadcaster-data", "recordings");
                _recorder.StartRecording(dir);
            }
            else if (!Settings.RecordMode && _recorder.IsRecording)
            {
                _recorder.StopRecording();
            }
        }

        private string BuildDisplayText()
        {
            if (!_engine.IsVisible) return "";

            // Event-only mode: show concise exposition instead of commentary prompt
            if (Settings.EventOnlyMode)
            {
                string expo = _engine.CurrentEventExposition;
                return string.IsNullOrEmpty(expo)
                    ? _engine.CurrentTitle
                    : expo;
            }

            if (Settings.ShowTopicTitle && !string.IsNullOrEmpty(_engine.CurrentTitle))
                return _engine.CurrentTitle + "\n" + _engine.CurrentText;
            return _engine.CurrentText;
        }

        private string GetTrackId(PluginManager pm)
        {
            try
            {
                // iRacing: SessionInfo contains track name
                var val = pm.GetPropertyValue("DataCorePlugin.GameData.TrackName")
                       ?? pm.GetPropertyValue("DataCorePlugin.GameData.TrackId");
                if (val != null)
                {
                    string id = val.ToString().Trim();
                    if (!string.IsNullOrEmpty(id)) return id;
                }
            }
            catch { }
            return _current.GameName ?? "";
        }

        /// <summary>
        /// Build leaderboard JSON from SimHub's Opponents list.
        /// Returns a window of drivers centred on the player, compact JSON array.
        /// Each entry: [pos, name, irating, bestLap, lastLap, gapToPlayer, inPit]
        /// </summary>
        private string BuildLeaderboard(object newData, int playerPos)
        {
            var ic = System.Globalization.CultureInfo.InvariantCulture;
            try
            {
                var oppsProp = newData.GetType().GetProperty("Opponents",
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var opps = oppsProp?.GetValue(newData) as System.Collections.IList;
                if (opps == null || opps.Count == 0) return "[]";

                // Collect all opponent data
                var entries = new System.Collections.Generic.List<string>(opps.Count + 1);
                foreach (var opp in opps)
                {
                    var t = opp.GetType();
                    int pos = Convert.ToInt32(t.GetProperty("Position")?.GetValue(opp) ?? 0);
                    string name = (t.GetProperty("Name")?.GetValue(opp) as string) ?? "";
                    int irating = 0;
                    var irProp = t.GetProperty("IRating") ?? t.GetProperty("Irating");
                    if (irProp != null) { var v = irProp.GetValue(opp); if (v != null) irating = Convert.ToInt32(v); }
                    double best = 0, last = 0;
                    var bestProp = t.GetProperty("BestLapTime");
                    if (bestProp != null) { var v = bestProp.GetValue(opp); if (v is TimeSpan ts && ts.TotalSeconds > 0) best = ts.TotalSeconds; }
                    var lastProp = t.GetProperty("LastLapTime");
                    if (lastProp != null) { var v = lastProp.GetValue(opp); if (v is TimeSpan ts2 && ts2.TotalSeconds > 0) last = ts2.TotalSeconds; }
                    double gapToPlayer = 0;
                    var gapProp = t.GetProperty("GapToPlayer");
                    if (gapProp != null) { var v = gapProp.GetValue(opp); if (v != null) gapToPlayer = Convert.ToDouble(v); }
                    bool inPit = false;
                    var pitProp = t.GetProperty("IsInPit") ?? t.GetProperty("IsInPitLane");
                    if (pitProp != null) { var v = pitProp.GetValue(opp); if (v is bool b) inPit = b; else if (v is int iv) inPit = iv != 0; }
                    bool isPlayer = (pos == playerPos);

                    if (pos <= 0) continue;

                    // Compact: [pos,"name",irating,bestLap,lastLap,gap,inPit,isPlayer]
                    entries.Add(string.Format(ic,
                        "[{0},\"{1}\",{2},{3:F3},{4:F3},{5:F2},{6},{7}]",
                        pos, Escape(name), irating, best, last, gapToPlayer, inPit ? 1 : 0, isPlayer ? 1 : 0));
                }

                // Sort by position
                entries.Sort((a, b) =>
                {
                    // Extract position number from "[pos,..."
                    int pa = int.Parse(a.Substring(1, a.IndexOf(',') - 1));
                    int pb = int.Parse(b.Substring(1, b.IndexOf(',') - 1));
                    return pa.CompareTo(pb);
                });

                // Window: 3 ahead of player, player, 3 behind
                int playerIdx = entries.FindIndex(e =>
                {
                    int lastComma = e.LastIndexOf(',');
                    return e[lastComma + 1] == '1';
                });
                if (playerIdx < 0) playerIdx = 0;
                int start = Math.Max(0, playerIdx - 3);
                int end = Math.Min(entries.Count, playerIdx + 4); // +4 = player + 3 behind
                var window = entries.GetRange(start, end - start);

                return "[" + string.Join(",", window) + "]";
            }
            catch { return "[]"; }
        }

        /// <summary>Build demo leaderboard with fake data around the player.</summary>
        private string BuildDemoLeaderboard(DemoTelemetryProvider dt)
        {
            var ic = System.Globalization.CultureInfo.InvariantCulture;
            int pp = dt.Position;
            var names = new[] { "L. Hamilton", "M. Verstappen", "C. Leclerc", dt.DriverAhead, "YOU",
                                dt.DriverBehind, "S. Vettel", "D. Ricciardo", "L. Norris", "C. Sainz" };
            var iratings = new[] { 5200, 4800, 3900, dt.IRAhead, dt.IRating,
                                   dt.IRBehind, 2400, 2200, 2100, 1900 };
            double baseLap = dt.BestLapTime > 0 ? dt.BestLapTime : 92.4;
            var rng = new Random(42); // deterministic seed

            int windowStart = Math.Max(1, pp - 3);
            var sb = new StringBuilder(512);
            sb.Append("[");
            for (int i = 0; i < 7; i++)
            {
                int pos = windowStart + i;
                if (pos < 1 || pos > 20) continue;
                int nameIdx = i < names.Length ? i : i % names.Length;
                string name = (pos == pp) ? "YOU" : (nameIdx < names.Length ? names[nameIdx] : "Driver " + pos);
                int ir = (nameIdx < iratings.Length) ? iratings[nameIdx] : 2000 + rng.Next(500);
                double best = baseLap + (pos - pp) * 0.4 + rng.NextDouble() * 0.3;
                double last = best + (rng.NextDouble() - 0.3) * 1.5;
                double gap = (pos - pp) * 1.8 + rng.NextDouble() * 0.5;
                bool isPlayer = (pos == pp);
                if (sb.Length > 1) sb.Append(",");
                sb.AppendFormat(ic, "[{0},\"{1}\",{2},{3:F3},{4:F3},{5:F2},{6},{7}]",
                    pos, Escape(name), ir, best, last, gap, 0, isPlayer ? 1 : 0);
            }
            sb.Append("]");
            return sb.ToString();
        }

        private void StartHttpServer()
        {
            // Try binding in order of preference:
            // 1. Wildcard (*) — works if SimHub runs as admin or URL ACL is registered
            // 2. localhost only — always works without admin, sufficient for local overlays
            string[] prefixes = new[]
            {
                "http://*:8889/k10mediabroadcaster/",
                "http://localhost:8889/k10mediabroadcaster/"
            };

            foreach (var prefix in prefixes)
            {
                try
                {
                    _httpListener = new HttpListener();
                    _httpListener.Prefixes.Add(prefix);
                    _httpListener.Start();
                    _httpThread = new Thread(HttpServerLoop) { IsBackground = true, Name = "K10MediaBroadcaster-HTTP" };
                    _httpThread.Start();
                    SimHub.Logging.Current.Info($"[K10MediaBroadcaster] HTTP state server listening on port 8889 (prefix: {prefix})");
                    return;
                }
                catch (Exception ex)
                {
                    SimHub.Logging.Current.Warn($"[K10MediaBroadcaster] HTTP server failed with prefix {prefix}: {ex.Message}");
                    try { _httpListener?.Close(); } catch { }
                    _httpListener = null;
                }
            }

            SimHub.Logging.Current.Warn("[K10MediaBroadcaster] HTTP server could not start on any prefix — dashboard overlay will not receive data");
        }

        private void StopHttpServer()
        {
            try { _httpListener?.Stop(); } catch { }
        }

        private void HttpServerLoop()
        {
            var ic = System.Globalization.CultureInfo.InvariantCulture;

            while (_httpListener != null && _httpListener.IsListening)
            {
                HttpListenerContext ctx;
                try { ctx = _httpListener.GetContext(); }
                catch { break; }

                try
                {
                    // Handle CORS preflight
                    if (ctx.Request.HttpMethod == "OPTIONS")
                    {
                        ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                        ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                        ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                        ctx.Response.StatusCode = 204;
                        ctx.Response.OutputStream.Close();
                        continue;
                    }

                    // ── Handle action endpoints ──────────────────────────────
                    string rawUrl = ctx.Request.RawUrl ?? "";
                    if (rawUrl.Contains("action=resetmap"))
                    {
                        _trackMap.ResetTrackMap();
                        byte[] okBytes = System.Text.Encoding.UTF8.GetBytes("{\"ok\":true}");
                        ctx.Response.ContentType = "application/json";
                        ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                        ctx.Response.StatusCode = 200;
                        ctx.Response.OutputStream.Write(okBytes, 0, okBytes.Length);
                        ctx.Response.OutputStream.Close();
                        continue;
                    }

                    if (rawUrl.Contains("action=listtracks"))
                    {
                        var ids = _trackMap.GetBundledTrackIds();
                        string json = "[" + string.Join(",", ids.ConvertAll(id => "\"" + id.Replace("\"", "\\\"") + "\"")) + "]";
                        byte[] listBytes = System.Text.Encoding.UTF8.GetBytes(json);
                        ctx.Response.ContentType = "application/json";
                        ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                        ctx.Response.StatusCode = 200;
                        ctx.Response.OutputStream.Write(listBytes, 0, listBytes.Length);
                        ctx.Response.OutputStream.Close();
                        continue;
                    }

                    if (rawUrl.Contains("action=restartdemo"))
                    {
                        _engine.DemoTelemetry.Reset();
                        byte[] okBytes = System.Text.Encoding.UTF8.GetBytes("{\"ok\":true}");
                        ctx.Response.ContentType = "application/json";
                        ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                        ctx.Response.StatusCode = 200;
                        ctx.Response.OutputStream.Write(okBytes, 0, okBytes.Length);
                        ctx.Response.OutputStream.Close();
                        continue;
                    }

                    // ── Build complete state snapshot ────────────────────────
                    var s = _current; // snapshot reference (safe — replaced atomically in DataUpdate)
                    var dt = _engine.DemoTelemetry;
                    bool demo = Settings.DemoMode;

                    // Flag state — demo flags take priority when in demo mode
                    string flagState = "none";
                    {
                        int f = 0;
                        if (demo && _engine.CurrentDemoFlags != 0)
                            f = _engine.CurrentDemoFlags;
                        else if (s.GameRunning)
                            f = s.SessionFlags;
                        if      ((f & TelemetrySnapshot.FLAG_RED)       != 0) flagState = "red";
                        else if ((f & TelemetrySnapshot.FLAG_REPAIR)    != 0) flagState = "meatball";
                        else if ((f & TelemetrySnapshot.FLAG_BLACK)     != 0) flagState = "black";
                        else if ((f & TelemetrySnapshot.FLAG_YELLOW)    != 0) flagState = "yellow";
                        else if ((f & TelemetrySnapshot.FLAG_BLUE)      != 0) flagState = "blue";
                        else if ((f & TelemetrySnapshot.FLAG_DEBRIS)    != 0) flagState = "debris";
                        else if ((f & TelemetrySnapshot.FLAG_WHITE)     != 0) flagState = "white";
                        else if ((f & TelemetrySnapshot.FLAG_CHECKERED) != 0) flagState = "checkered";
                        else if ((f & TelemetrySnapshot.FLAG_GREEN)     != 0) flagState = "green";
                        else if (!demo && IsLappingCarAhead(s)) flagState = "orange";
                    }

                    // Nearest car distance
                    double nearestDist = 1.0;
                    if (s.GameRunning && s.CarIdxLapDistPct != null && s.CarIdxLapDistPct.Length > 0)
                    {
                        double playerPos = s.TrackPositionPct;
                        int playerIdx = s.PlayerCarIdx;
                        for (int i = 0; i < s.CarIdxLapDistPct.Length; i++)
                        {
                            if (i == playerIdx) continue;
                            double other = s.CarIdxLapDistPct[i];
                            if (other <= 0) continue;
                            double d = Math.Abs(playerPos - other);
                            d = Math.Min(d, 1.0 - d);
                            if (d < nearestDist) nearestDist = d;
                        }
                    }

                    // Commentary state
                    string cat = _engine.CurrentCategory ?? "";
                    string label = _engine.CurrentSentimentLabel ?? "";
                    string category = string.IsNullOrEmpty(label) ? cat : cat + " \u2014 " + label;

                    // Build JSON — flat key-value map matching PROP_KEYS the dashboard expects
                    var sb = new StringBuilder(2048);
                    sb.Append("{\n");

                    // ── Game data (live telemetry from snapshot) ──
                    Jp(sb, "DataCorePlugin.GameRunning", s.GameRunning ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.GameId", Escape(s.GameName ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.SessionTypeName", Escape(s.SessionTypeName ?? ""));
                    Jp(sb, "DataCorePlugin.GameData.Gear", Escape(s.Gear ?? "N"));
                    Jp(sb, "DataCorePlugin.GameData.Rpms", s.Rpms, ic);
                    Jp(sb, "DataCorePlugin.GameData.CarSettings_MaxRPM", 8000.0, ic); // fallback; snapshot doesn't carry maxRPM
                    Jp(sb, "DataCorePlugin.GameData.SpeedMph", s.SpeedKmh * 0.621371, ic);
                    Jp(sb, "DataCorePlugin.GameData.Throttle", s.Throttle * 100, ic);
                    Jp(sb, "DataCorePlugin.GameData.Brake", s.Brake * 100, ic);
                    Jp(sb, "DataCorePlugin.GameData.Clutch", 0.0, ic); // not in snapshot currently
                    Jp(sb, "DataCorePlugin.GameData.Fuel", s.FuelLevel, ic);
                    Jp(sb, "DataCorePlugin.GameData.MaxFuel", s.FuelLevel > 0 ? s.FuelLevel / Math.Max(s.FuelPercent, 0.01) : 0, ic);
                    Jp(sb, "DataCorePlugin.Computed.Fuel_LitersPerLap", s.FuelPerLap, ic);
                    Jp(sb, "DataCorePlugin.GameData.RemainingLaps", s.RemainingLaps, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreTempFrontLeft", s.TyreTempFL, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreTempFrontRight", s.TyreTempFR, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreTempRearLeft", s.TyreTempRL, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreTempRearRight", s.TyreTempRR, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreWearFrontLeft", s.TyreWearFL, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreWearFrontRight", s.TyreWearFR, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreWearRearLeft", s.TyreWearRL, ic);
                    Jp(sb, "DataCorePlugin.GameData.TyreWearRearRight", s.TyreWearRR, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcBrakeBias", s.BrakeBias, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcTractionControl", s.TractionControlSetting, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcABS", s.AbsSetting, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcAntiRollFront", s.ArbFront, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcAntiRollRear", s.ArbRear, ic);
                    // Additional car adjustments
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcEnginePower", s.EnginePower, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcFuelMixture", s.FuelMixture, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcWeightJackerLeft", s.WeightJackerLeft, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcWeightJackerRight", s.WeightJackerRight, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcWingFront", s.WingFront, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.dcWingRear", s.WingRear, ic);
                    // Pit stop selections
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PitSvFlags", s.PitSvFlags);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PitSvFuel", s.PitSvFuel, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PitSvLFP", s.PitSvLFP, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PitSvRFP", s.PitSvRFP, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PitSvLRP", s.PitSvLRP, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PitSvRRP", s.PitSvRRP, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.TireCompound", s.PitSvTireCompound);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.FastRepair", s.PitSvFastRepair);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.Windshield", s.PitSvWindshieldTearoff);
                    // Pit box computed display strings
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.TireLF", s.PitTireLF ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.TireRF", s.PitTireRF ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.TireLR", s.PitTireLR ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.TireRR", s.PitTireRR ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.TiresRequested", s.PitTiresRequested ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.FuelRequested", s.PitFuelRequested ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.FastRepairRequested", s.PitFastRepairRequested ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.WindshieldRequested", s.PitWindshieldRequested ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.FuelDisplay", Escape(s.PitFuelDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PressureLF", Escape(s.PitPressureLFDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PressureRF", Escape(s.PitPressureRFDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PressureLR", Escape(s.PitPressureLRDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.PressureRR", Escape(s.PitPressureRRDisplay));
                    // Car-specific adjustment availability
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasTC", s.HasTC ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasABS", s.HasABS ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasARBFront", s.HasARBFront ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasARBRear", s.HasARBRear ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasEnginePower", s.HasEnginePower ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasFuelMixture", s.HasFuelMixture ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasWeightJackerL", s.HasWeightJackerL ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasWeightJackerR", s.HasWeightJackerR ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasWingFront", s.HasWingFront ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.PitBox.HasWingRear", s.HasWingRear ? 1 : 0);
                    Jp(sb, "DataCorePlugin.GameData.Position", s.Position);
                    Jp(sb, "DataCorePlugin.GameData.CurrentLap", s.CurrentLap);
                    Jp(sb, "DataCorePlugin.GameData.BestLapTime", s.LapBestTime, ic);
                    Jp(sb, "DataCorePlugin.GameData.LastLapTime", s.LapLastTime, ic);
                    // Estimate session elapsed: current lap time + completed laps × average lap
                    double avgLap = s.LapBestTime > 0 ? s.LapBestTime : (s.LapLastTime > 0 ? s.LapLastTime : 90);
                    double sessionElapsed = s.LapCurrentTime + s.CompletedLaps * avgLap;
                    Jp(sb, "DataCorePlugin.GameData.SessionTimeSpan", sessionElapsed, ic);
                    Jp(sb, "DataCorePlugin.GameData.RemainingTime", s.SessionTimeRemain, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SessionLapsRemaining", s.SessionLapsRemaining);
                    Jp(sb, "DataCorePlugin.GameData.TotalLaps", 0);  // populated from game data when available
                    Jp(sb, "DataCorePlugin.GameData.CarModel", Escape(s.CarModel ?? ""));
                    Jp(sb, "IRacingExtraProperties.iRacing_DriverInfo_IRating", s.IRating);
                    Jp(sb, "IRacingExtraProperties.iRacing_DriverInfo_SafetyRating", s.SafetyRating, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.EstimatedIRatingDelta", s.EstimatedIRatingDelta);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IRatingFieldSize", s.IRatingFieldSize);
                    Jp(sb, "IRacingExtraProperties.iRacing_Opponent_Ahead_Gap", s.GapAhead, ic);
                    Jp(sb, "IRacingExtraProperties.iRacing_Opponent_Behind_Gap", s.GapBehind, ic);
                    Jp(sb, "IRacingExtraProperties.iRacing_Opponent_Ahead_Name", Escape(s.NearestAheadName ?? ""));
                    Jp(sb, "IRacingExtraProperties.iRacing_Opponent_Behind_Name", Escape(s.NearestBehindName ?? ""));
                    Jp(sb, "IRacingExtraProperties.iRacing_Opponent_Ahead_IRating", s.NearestAheadRating);
                    Jp(sb, "IRacingExtraProperties.iRacing_Opponent_Behind_IRating", s.NearestBehindRating);

                    // ── Datastream (advanced physics/performance) ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.LatG", s.LatAccel, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.LongG", s.LongAccel, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.YawRate", s.YawRate, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SteerTorque", s.SteeringWheelTorque, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.TrackTemp", s.TrackTemp, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IncidentCount", s.IncidentCount);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IncidentLimitPenalty", s.IncidentLimitPenalty);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IncidentLimitDQ", s.IncidentLimitDQ);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.LicenseString", Escape(s.LicenseString ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.AbsActive", s.AbsActive ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.TcActive", s.TcActive ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.TrackPct", s.TrackPositionPct, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.LapDelta", s.LapDeltaToBest, ic);
                    // Sector splits (legacy 3-sector + N-sector)
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.CurrentSector", s.CurrentSector);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorCount", s.SectorCount);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorSplitS1", s.SectorSplitS1, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorSplitS2", s.SectorSplitS2, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorSplitS3", s.SectorSplitS3, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorDeltaS1", s.SectorDeltaS1, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorDeltaS2", s.SectorDeltaS2, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorDeltaS3", s.SectorDeltaS3, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorStateS1", s.SectorStateS1);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorStateS2", s.SectorStateS2);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorStateS3", s.SectorStateS3);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorS2StartPct", s.SectorS2StartPct, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SectorS3StartPct", s.SectorS3StartPct, ic);
                    // N-sector arrays (serialized as comma-separated for tracks with >3 sectors)
                    if (s.SectorSplits != null && s.SectorCount > 3)
                    {
                        sb.Append("\"K10MediaBroadcaster.Plugin.DS.SectorSplits\":\"");
                        for (int si = 0; si < s.SectorSplits.Length; si++)
                        { if (si > 0) sb.Append(','); sb.Append(s.SectorSplits[si].ToString("F3", ic)); }
                        sb.Append("\",");
                        sb.Append("\"K10MediaBroadcaster.Plugin.DS.SectorDeltas\":\"");
                        for (int si = 0; si < s.SectorDeltas.Length; si++)
                        { if (si > 0) sb.Append(','); sb.Append(s.SectorDeltas[si].ToString("F3", ic)); }
                        sb.Append("\",");
                        sb.Append("\"K10MediaBroadcaster.Plugin.DS.SectorStates\":\"");
                        for (int si = 0; si < s.SectorStates.Length; si++)
                        { if (si > 0) sb.Append(','); sb.Append(s.SectorStates[si]); }
                        sb.Append("\",");
                        sb.Append("\"K10MediaBroadcaster.Plugin.DS.SectorBoundaryPcts\":\"");
                        if (s.SectorBoundaries != null)
                        {
                            for (int si = 0; si < s.SectorBoundaries.Length; si++)
                            { if (si > 0) sb.Append(','); sb.Append(s.SectorBoundaries[si].ToString("F6", ic)); }
                        }
                        sb.Append("\",");
                    }
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.CompletedLaps", s.CompletedLaps);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IsInPitLane", s.IsInPitLane ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SpeedKmh", s.SpeedKmh, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.PitLimiterOn", s.PitLimiterOn ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.PitSpeedLimitKmh", s.PitSpeedLimitKmh, ic);

                    // ── Computed DS.* — server-side calculations ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.ThrottleNorm", s.ThrottleNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.BrakeNorm", s.BrakeNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.ClutchNorm", s.ClutchNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.RpmRatio", s.RpmRatio, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.FuelPct", s.FuelPct, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.FuelLapsRemaining", s.FuelLapsRemaining, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SpeedMph", s.SpeedMph, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.PitSpeedLimitMph", s.PitSpeedLimitMph, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IsPitSpeeding", s.IsPitSpeeding ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IsNonRaceSession", s.IsNonRaceSession ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IsTimedRace", s.IsTimedRace ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.IsEndOfRace", s.IsEndOfRace ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.PositionDelta", s.PositionDelta);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.StartPosition", s.StartPosition);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.RemainingTimeFormatted", Escape(s.RemainingTimeFormatted ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SpeedDisplay", Escape(s.SpeedDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.RpmDisplay", Escape(s.RpmDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.FuelFormatted", Escape(s.FuelFormatted));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.FuelPerLapFormatted", Escape(s.FuelPerLapFormatted));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.PitSuggestion", Escape(s.PitSuggestion ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.BBNorm", s.BBNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.TCNorm", s.TCNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.ABSNorm", s.ABSNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.PositionDeltaDisplay", Escape(s.PositionDeltaDisplay ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.LapDeltaDisplay", Escape(s.LapDeltaDisplay ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.SafetyRatingDisplay", Escape(s.SafetyRatingDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.GapAheadFormatted", Escape(s.GapAheadFormatted));
                    Jp(sb, "K10MediaBroadcaster.Plugin.DS.GapBehindFormatted", Escape(s.GapBehindFormatted));

                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.FrameRate", s.FrameRate, ic);
                    Jp(sb, "DataCorePlugin.GameRawData.Telemetry.SteeringWheelAngle", s.SteeringWheelAngle, ic);

                    // ── Commentary ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentaryVisible", _engine.IsVisible ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentaryText", Escape(_engine.CurrentText ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentaryTopicTitle", Escape(_engine.CurrentTitle ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentaryTopicId", Escape(_engine.CurrentTopicId ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentaryCategory", Escape(category));
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentarySentimentColor", Escape(_engine.CurrentSentimentColor ?? "#FF000000"));
                    Jp(sb, "K10MediaBroadcaster.Plugin.CommentarySeverity", _engine.IsVisible ? _engine.CurrentSeverity : 0);

                    // ── Demo mode ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.DemoMode", demo ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Gear", Escape(dt.Gear ?? "N"));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Rpm", dt.Rpm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.MaxRpm", dt.MaxRpm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.SpeedMph", dt.SpeedMph, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Throttle", dt.Throttle * 100, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Brake", dt.Brake * 100, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Clutch", dt.Clutch * 100, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Fuel", dt.Fuel, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.MaxFuel", dt.MaxFuel, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.FuelPerLap", dt.FuelPerLap, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.RemainingLaps", dt.RemainingLaps, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreTempFL", dt.TyreTempFL, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreTempFR", dt.TyreTempFR, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreTempRL", dt.TyreTempRL, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreTempRR", dt.TyreTempRR, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreWearFL", dt.TyreWearFL, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreWearFR", dt.TyreWearFR, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreWearRL", dt.TyreWearRL, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TyreWearRR", dt.TyreWearRR, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.BrakeBias", dt.BrakeBias, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TC", dt.TC, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.ABS", dt.ABS, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.SessionTypeName", Escape(dt.SessionTypeName ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Position", dt.Position);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.CurrentLap", dt.CurrentLap);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.BestLapTime", dt.BestLapTime, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.CarModel", Escape(dt.CarModel ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.SessionTime", dt.SessionTime, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.LastLapTime", dt.LastLapTime, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.RemainingTime", dt.RemainingTime, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.TotalLaps", dt.TotalLaps);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.IRating", dt.IRating);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.SafetyRating", dt.SafetyRating, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.GapAhead", dt.GapAhead, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.GapBehind", dt.GapBehind, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DriverAhead", Escape(dt.DriverAhead ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DriverBehind", Escape(dt.DriverBehind ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.IRAhead", dt.IRAhead);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.IRBehind", dt.IRBehind);

                    // ── Demo Datastream ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.LatG", dt.LatG, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.LongG", dt.LongG, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.YawRate", dt.YawRate, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.SteerTorque", dt.SteerTorque, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.TrackTemp", dt.TrackTemp, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.IncidentCount", dt.IncidentCount);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.AbsActive", dt.AbsActive ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.TcActive", dt.TcActive ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.LapDelta", dt.LapDelta, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.IsInPitLane", dt.IsInPitLane ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.SpeedKmh", dt.SpeedKmh, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.PitLimiterOn", dt.IsInPitLane ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.PitSpeedLimitKmh", 72.0, ic);

                    // ── Demo Computed DS.* ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.ThrottleNorm", dt.ThrottleNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.BrakeNorm", dt.BrakeNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.ClutchNorm", dt.ClutchNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.RpmRatio", dt.RpmRatio, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.FuelPct", dt.FuelPct, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.FuelLapsRemaining", dt.FuelLapsRemaining, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.SpeedMph", dt.SpeedMph, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.PitSpeedLimitMph", dt.PitSpeedLimitMph, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.IsPitSpeeding", dt.IsPitSpeeding ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.IsNonRaceSession", dt.IsNonRaceSession ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.IsTimedRace", dt.IsTimedRace ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.IsEndOfRace", dt.IsEndOfRace ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.PositionDelta", dt.PositionDelta);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.StartPosition", dt.StartPosition);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.RemainingTimeFormatted", Escape(dt.RemainingTimeFormatted ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.SpeedDisplay", Escape(dt.SpeedDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.RpmDisplay", Escape(dt.RpmDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.FuelFormatted", Escape(dt.FuelFormatted));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.FuelPerLapFormatted", Escape(dt.FuelPerLapFormatted));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.PitSuggestion", Escape(dt.PitSuggestion ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.BBNorm", dt.BBNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.TCNorm", dt.TCNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.ABSNorm", dt.ABSNorm, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.PositionDeltaDisplay", Escape(dt.PositionDeltaDisplay ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.LapDeltaDisplay", Escape(dt.LapDeltaDisplay ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.SafetyRatingDisplay", Escape(dt.SafetyRatingDisplay));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.GapAheadFormatted", Escape(dt.GapAheadFormatted));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.DS.GapBehindFormatted", Escape(dt.GapBehindFormatted));

                    // ── Grid / Formation state ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.SessionState", s.SessionState);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.GriddedCars", s.GriddedCars);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.TotalCars", s.TotalCars);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.PaceMode", s.PaceMode);
                    // Start type: read from iRacing WeekendOptions via shared memory
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.StartType", Escape(s.IsStandingStart ? "standing" : "rolling"));
                    // Lights phase: synthesized from PaceMode/SessionState transitions
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.LightsPhase", _lightsPhase);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Grid.TrackCountry", Escape(s.TrackCountry ?? ""));

                    // ── Demo Grid state ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.SessionState", dt.SessionState);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.GriddedCars", dt.GriddedCars);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.TotalCars", dt.TotalCars);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.PaceMode", dt.PaceMode);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.LightsPhase", dt.LightsPhase);
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.StartType", Escape(dt.IsStandingStart ? "standing" : "rolling"));
                    Jp(sb, "K10MediaBroadcaster.Plugin.Demo.Grid.TrackCountry", Escape(dt.TrackCountry ?? ""));

                    // ── Driver name (for leaderboard display) ──
                    // Prefer live player name from game data; fall back to settings
                    string livePlayerName = s.PlayerName ?? "";
                    if (!string.IsNullOrEmpty(livePlayerName))
                    {
                        // Split "First Last" into first/last for dashboard display
                        var nameParts = livePlayerName.Trim().Split(new[] { ' ' }, 2);
                        Jp(sb, "K10MediaBroadcaster.Plugin.DriverFirstName", Escape(nameParts[0]));
                        Jp(sb, "K10MediaBroadcaster.Plugin.DriverLastName", Escape(nameParts.Length > 1 ? nameParts[1] : ""));
                    }
                    else
                    {
                        Jp(sb, "K10MediaBroadcaster.Plugin.DriverFirstName", Escape(Settings.DriverFirstName ?? ""));
                        Jp(sb, "K10MediaBroadcaster.Plugin.DriverLastName", Escape(Settings.DriverLastName ?? ""));
                    }

                    // ── Track map ──
                    Jp(sb, "K10MediaBroadcaster.Plugin.TrackMap.Ready", _trackMap.IsReady ? 1 : 0);
                    Jp(sb, "K10MediaBroadcaster.Plugin.TrackMap.SvgPath", Escape(_trackMap.SvgPath ?? ""));
                    Jp(sb, "K10MediaBroadcaster.Plugin.TrackMap.PlayerX", _trackMap.PlayerX, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.TrackMap.PlayerY", _trackMap.PlayerY, ic);
                    Jp(sb, "K10MediaBroadcaster.Plugin.TrackMap.Opponents", Escape(_trackMap.OpponentData ?? ""));

                    // ── Leaderboard ──
                    // Raw JSON array — NOT string-escaped, injected directly
                    sb.AppendFormat("\"K10MediaBroadcaster.Plugin.Leaderboard\":{0},\n", _leaderboardJson ?? "[]");

                    // ── Extra (homebridge / legacy) ──
                    Jp(sb, "currentFlagState", Escape(flagState));
                    Jp(sb, "nearestCarDistance", nearestDist, ic);

                    // Remove trailing comma and close
                    if (sb.Length > 2 && sb[sb.Length - 2] == ',')
                        sb.Remove(sb.Length - 2, 1); // remove last comma
                    sb.Append("}");

                    byte[] buf = Encoding.UTF8.GetBytes(sb.ToString());
                    ctx.Response.ContentType     = "application/json";
                    ctx.Response.ContentLength64 = buf.Length;
                    ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                    ctx.Response.OutputStream.Write(buf, 0, buf.Length);
                }
                catch (Exception ex)
                {
                    SimHub.Logging.Current.Warn($"[K10MediaBroadcaster] HTTP handler error: {ex.Message}");
                }
                finally
                {
                    try { ctx.Response.OutputStream.Close(); } catch { }
                }
            }
        }

        // JSON property helpers — avoid pulling in Newtonsoft for a simple flat map
        private static void Jp(StringBuilder sb, string key, int val)
            => sb.Append($"  \"{key}\": {val},\n");
        private static void Jp(StringBuilder sb, string key, double val, System.Globalization.CultureInfo ic)
            => sb.Append($"  \"{key}\": {val.ToString("G", ic)},\n");
        private static void Jp(StringBuilder sb, string key, string val)
            => sb.Append($"  \"{key}\": \"{val}\",\n");

        private static string Escape(string s) =>
            s?.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") ?? "";

        private string ResolveTopicsPath()
        {
            if (!string.IsNullOrEmpty(Settings.TopicsFilePath) && File.Exists(Settings.TopicsFilePath))
                return Settings.TopicsFilePath;
            return ResolveDatasetFile("commentary_topics.json");
        }

        private string ResolveDatasetFile(string filename)
        {
            string dllDir = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? "";
            string candidate = Path.Combine(dllDir, "k10-media-broadcaster-data", filename);
            if (File.Exists(candidate)) return candidate;

            string pluginsData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SimHub", "PluginsData", "K10MediaBroadcaster", filename);
            if (File.Exists(pluginsData)) return pluginsData;

            SimHub.Logging.Current.Warn($"[K10MediaBroadcaster] {filename} not found in k10-media-broadcaster-data folder");
            return "";
        }
    }
}
