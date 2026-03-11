using System;
using System.IO;
using System.Windows.Media;
using GameReaderCommon;
using MediaCoach.Plugin.Engine;
using SimHub.Plugins;

namespace MediaCoach.Plugin
{
    [PluginDescription("Displays real-time commentary prompts while sim racing, timed to telemetry events.")]
    [PluginAuthor("MediaCoach")]
    [PluginName("Media Coach")]
    public class Plugin : IPlugin, IDataPlugin, IWPFSettingsV2
    {
        public Settings Settings { get; private set; }
        public PluginManager PluginManager { get; set; }

        public ImageSource PictureIcon => null;
        public string LeftMenuTitle => "Media Coach";

        // Engine
        private readonly CommentaryEngine  _engine   = new CommentaryEngine();
        private readonly TelemetryRecorder _recorder = new TelemetryRecorder();
        private FeedbackEngine _feedback;

        // Telemetry frames (current + previous for delta calculations)
        private TelemetrySnapshot _current  = new TelemetrySnapshot();
        private TelemetrySnapshot _previous = new TelemetrySnapshot();

        // Frame counter — we evaluate triggers every N frames to reduce CPU load
        // at 60fps, every 6 frames = ~100ms evaluation cadence
        private int _frameCount = 0;
        private const int EvalEveryNFrames = 6;

        // ── IWPFSettingsV2 ────────────────────────────────────────────────────

        private SettingsControl _settingsControl;
        public System.Windows.Controls.Control GetWPFSettingsControl(PluginManager pluginManager)
            => _settingsControl = new SettingsControl(this);

        // ── IDataPlugin ───────────────────────────────────────────────────────

        public void Init(PluginManager pluginManager)
        {
            SimHub.Logging.Current.Info("[MediaCoach] Initialising Media Coach plugin");

            // Load settings
            Settings = this.ReadCommonSettings<Settings>("GeneralSettings", () => new Settings());

            // Initialise feedback engine
            string feedbackPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SimHub", "PluginsData", "MediaCoach", "feedback.json");
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
            this.AttachDelegate("CurrentFlagState", () =>
            {
                if (!_current.GameRunning) return "none";
                int f = _current.SessionFlags;
                if ((f & TelemetrySnapshot.FLAG_RED)       != 0) return "red";
                if ((f & TelemetrySnapshot.FLAG_BLACK)     != 0) return "black";
                if ((f & TelemetrySnapshot.FLAG_YELLOW)    != 0) return "yellow";
                if ((f & TelemetrySnapshot.FLAG_BLUE)      != 0) return "blue";
                if ((f & TelemetrySnapshot.FLAG_DEBRIS)    != 0) return "debris";
                if ((f & TelemetrySnapshot.FLAG_WHITE)     != 0) return "white";
                if ((f & TelemetrySnapshot.FLAG_CHECKERED) != 0) return "checkered";
                if ((f & TelemetrySnapshot.FLAG_GREEN)     != 0) return "green";
                return "none";
            });

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
                SimHub.Logging.Current.Info("[MediaCoach] Prompt dismissed by user action");
            });

            // Feedback actions — bind to a button box or SimHub Control Mapper
            this.AddAction("ThumbsUp", (a, b) =>
            {
                _feedback.Record(_engine.CurrentTopicId, _engine.CurrentText, +1);
                SimHub.Logging.Current.Info($"[MediaCoach] ThumbsUp: {_engine.CurrentTopicId}");
            });

            this.AddAction("ThumbsDown", (a, b) =>
            {
                _feedback.Record(_engine.CurrentTopicId, _engine.CurrentText, -1);
                SimHub.Logging.Current.Info($"[MediaCoach] ThumbsDown: {_engine.CurrentTopicId}");
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

            SimHub.Logging.Current.Info("[MediaCoach] Initialisation complete");
        }

        public void DataUpdate(PluginManager pluginManager, ref GameData data)
        {
            // Capture current telemetry every frame (cheap snapshot)
            _previous = _current;
            _current  = TelemetrySnapshot.Capture(pluginManager, ref data);

            // Only run commentary evaluation every N frames
            _frameCount++;
            if (_frameCount < EvalEveryNFrames) return;
            _frameCount = 0;

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
            _recorder.StopRecording();
            this.SaveCommonSettings("GeneralSettings", Settings);
            SimHub.Logging.Current.Info("[MediaCoach] Plugin stopped, settings saved");
        }

        // ── Internal helpers ──────────────────────────────────────────────────

        public void ApplySettings()
        {
            _engine.DisplaySeconds    = Settings.PromptDisplaySeconds;
            _engine.EventOnlyMode     = Settings.EventOnlyMode;
            _engine.DemoMode          = Settings.DemoMode;
            _engine.EnabledCategories = Settings.EnabledCategories?.Count > 0
                ? new System.Collections.Generic.HashSet<string>(Settings.EnabledCategories)
                : null;

            if (Settings.RecordMode && !_recorder.IsRecording)
            {
                string dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                    "SimHub", "PluginsData", "MediaCoach", "recordings");
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

        private string ResolveTopicsPath()
        {
            if (!string.IsNullOrEmpty(Settings.TopicsFilePath) && File.Exists(Settings.TopicsFilePath))
                return Settings.TopicsFilePath;
            return ResolveDatasetFile("commentary_topics.json");
        }

        private string ResolveDatasetFile(string filename)
        {
            string dllDir = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? "";
            string candidate = Path.Combine(dllDir, "dataset", filename);
            if (File.Exists(candidate)) return candidate;

            string pluginsData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SimHub", "PluginsData", "MediaCoach", filename);
            if (File.Exists(pluginsData)) return pluginsData;

            SimHub.Logging.Current.Warn($"[MediaCoach] {filename} not found in dataset folder");
            return "";
        }
    }
}
