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
        private readonly CommentaryEngine _engine = new CommentaryEngine();

        // Telemetry frames (current + previous for delta calculations)
        private TelemetrySnapshot _current  = new TelemetrySnapshot();
        private TelemetrySnapshot _previous = new TelemetrySnapshot();

        // Frame counter — we evaluate triggers every N frames to reduce CPU load
        // at 60fps, every 60 frames = ~1 second evaluation cadence
        private int _frameCount = 0;
        private const int EvalEveryNFrames = 60;

        // ── IWPFSettingsV2 ────────────────────────────────────────────────────

        private Control _settingsControl;
        public System.Windows.Controls.Control GetWPFSettingsControl(PluginManager pluginManager)
            => _settingsControl = new Control(this);

        // ── IDataPlugin ───────────────────────────────────────────────────────

        public void Init(PluginManager pluginManager)
        {
            SimHub.Logging.Current.Info("[MediaCoach] Initialising Media Coach plugin");

            // Load settings
            Settings = this.ReadCommonSettings<Settings>("GeneralSettings", () => new Settings());
            ApplySettings();

            // Load topics dataset
            string topicsPath = ResolveTopicsPath();
            _engine.LoadTopics(topicsPath);

            // ── Register dashboard properties ─────────────────────────────────

            // The full commentary prompt text
            this.AttachDelegate("CommentaryText", () => BuildDisplayText());

            // Boolean: whether the panel should be visible
            this.AttachDelegate("CommentaryVisible", () => _engine.IsVisible ? 1 : 0);

            // Category (hardware / game_feel / car_response / racing_experience)
            this.AttachDelegate("CommentaryCategory", () => _engine.CurrentCategory);

            // Short topic title
            this.AttachDelegate("CommentaryTopicTitle", () => _engine.CurrentTitle);

            // Seconds remaining until auto-clear
            this.AttachDelegate("CommentarySecondsRemaining", () => _engine.SecondsRemaining);

            // Current interval setting (so dashboard can display it)
            this.AttachDelegate("SettingIntervalMinutes", () => Settings.MinSuggestionIntervalMinutes);

            // ── Actions ───────────────────────────────────────────────────────

            // Manually dismiss the current prompt
            this.AddAction("DismissPrompt", (a, b) =>
            {
                _engine.ClearPrompt();
                SimHub.Logging.Current.Info("[MediaCoach] Prompt dismissed by user action");
            });

            // Adjust suggestion interval from Control Mapper / button box
            this.AddAction("IncreaseInterval", (a, b) =>
            {
                Settings.MinSuggestionIntervalMinutes = Math.Min(10, Settings.MinSuggestionIntervalMinutes + 0.5);
                ApplySettings();
            });

            this.AddAction("DecreaseInterval", (a, b) =>
            {
                Settings.MinSuggestionIntervalMinutes = Math.Max(0.5, Settings.MinSuggestionIntervalMinutes - 0.5);
                ApplySettings();
            });

            // ── Events ────────────────────────────────────────────────────────
            this.AddEvent("NewCommentaryPrompt");

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

            // Fire event when a new prompt appears
            if (_engine.IsVisible && !wasVisible)
                this.TriggerEvent("NewCommentaryPrompt");
        }

        public void End(PluginManager pluginManager)
        {
            this.SaveCommonSettings("GeneralSettings", Settings);
            SimHub.Logging.Current.Info("[MediaCoach] Plugin stopped, settings saved");
        }

        // ── Internal helpers ──────────────────────────────────────────────────

        private void ApplySettings()
        {
            _engine.MinIntervalMinutes = Settings.MinSuggestionIntervalMinutes;
            _engine.DisplaySeconds     = Settings.PromptDisplaySeconds;
            _engine.EnabledCategories  = Settings.EnabledCategories?.Count > 0
                ? new System.Collections.Generic.HashSet<string>(Settings.EnabledCategories)
                : null;
        }

        private string BuildDisplayText()
        {
            if (!_engine.IsVisible) return "";
            if (Settings.ShowTopicTitle && !string.IsNullOrEmpty(_engine.CurrentTitle))
                return _engine.CurrentTitle + "\n" + _engine.CurrentText;
            return _engine.CurrentText;
        }

        private string ResolveTopicsPath()
        {
            // 1. Use path from settings if set
            if (!string.IsNullOrEmpty(Settings.TopicsFilePath) && File.Exists(Settings.TopicsFilePath))
                return Settings.TopicsFilePath;

            // 2. Look for dataset folder next to the DLL
            string dllDir = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? "";
            string candidate = Path.Combine(dllDir, "dataset", "commentary_topics.json");
            if (File.Exists(candidate)) return candidate;

            // 3. Look in PluginsData folder
            string pluginsData = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "SimHub", "PluginsData", "MediaCoach", "commentary_topics.json");
            if (File.Exists(pluginsData)) return pluginsData;

            SimHub.Logging.Current.Warn("[MediaCoach] commentary_topics.json not found — using built-in fallback topics");
            return "";
        }
    }
}
