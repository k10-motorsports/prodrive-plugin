using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MediaCoach.Plugin.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace MediaCoach.Plugin.Engine
{
    /// <summary>
    /// Core commentary logic. Evaluates telemetry triggers, enforces cooldowns,
    /// selects prompts, manages severity-based interruption, and controls the
    /// display lifecycle.
    /// </summary>
    public class CommentaryEngine
    {
        // ── Category → color mapping ────────────────────────────────────────
        // Color encodes event TYPE (category). Avoids all flag colors:
        // red, yellow/amber, blue, orange, black.
        private static readonly Dictionary<string, string> CategoryColors =
            new Dictionary<string, string>
            {
                { "hardware",          "00ACC1" },  // cyan — equipment / FFB
                { "game_feel",         "AB47BC" },  // purple — sim-specific observations
                { "car_response",      "66BB6A" },  // green — grip, wear, temps, balance
                { "racing_experience", "EC407A" },  // magenta/pink — drivers, flags, incidents
            };

        // ── Category → WCAG text color (bright same-shade for dark backgrounds) ─
        // High-contrast, fully opaque text colors in the same hue family.
        // Meet WCAG AA (4.5:1) against the translucent overlay on black.
        private static readonly Dictionary<string, string> CategoryTextColors =
            new Dictionary<string, string>
            {
                { "hardware",          "#FFB2EBF2" },  // light cyan
                { "game_feel",         "#FFCE93D8" },  // light purple
                { "car_response",      "#FFA5D6A7" },  // light green
                { "racing_experience", "#FFF48FB1" },  // light pink
            };

        // ── Severity → alpha (opacity) mapping ──────────────────────────────
        // Higher severity = more opaque overlay. Alpha as hex string.
        private static readonly Dictionary<int, string> SeverityAlphas =
            new Dictionary<int, string>
            {
                { 1, "66" },  // 40% — ambient / informational
                { 2, "8C" },  // 55% — notable
                { 3, "B3" },  // 70% — significant
                { 4, "D9" },  // 85% — urgent
                { 5, "FF" },  // 100% — critical
            };

        private static readonly Dictionary<int, string> SeverityLabels =
            new Dictionary<int, string>
            {
                { 1, "Info" },
                { 2, "Notable" },
                { 3, "Significant" },
                { 4, "Urgent" },
                { 5, "Critical" },
            };

        // ── Sentiment → category mapping (retained for non-event-only mode) ─
        private static readonly Dictionary<string, string[]> CategorySentiments =
            new Dictionary<string, string[]>
            {
                { "hardware",          new[] { "technical_analytical", "car_praise" } },
                { "game_feel",         new[] { "sim_comparison", "technical_analytical" } },
                { "car_response",      new[] { "excitement_positive", "frustration_negative", "technical_analytical" } },
                { "racing_experience", new[] { "neutral_narrative", "excitement_positive", "frustration_negative", "self_deprecating" } },
            };

        // ── State ─────────────────────────────────────────────────────────────
        private List<CommentaryTopic> _topics = new List<CommentaryTopic>();
        private Dictionary<string, string> _sentimentColors = new Dictionary<string, string>();
        private Dictionary<string, string> _sentimentLabels = new Dictionary<string, string>();
        private readonly Random _rng = new Random();
        private readonly FragmentAssembler _fragmentAssembler = new FragmentAssembler();

        // Per-topic last trigger time
        private readonly Dictionary<string, DateTime> _topicLastTrigger = new Dictionary<string, DateTime>();
        // Anti-spam: minimum seconds between any two prompts (only for same-or-lower severity)
        private DateTime _lastPromptFireTime = DateTime.MinValue;
        private const double AntiSpamSeconds = 8.0;

        // Current displayed prompt
        private volatile string _currentText           = "";
        private volatile string _currentCategory       = "";
        private volatile string _currentTitle          = "";
        private volatile string _currentTopicId        = "";
        private volatile string _currentSentimentLabel = "";
        private volatile string _currentSentimentColor = "#FF000000";
        private volatile string _currentTextColor      = "#FFFFFFFF";
        private volatile string _currentEventExposition = "";
        private DateTime _promptDisplayedAt             = DateTime.MinValue;
        private int _currentSeverity                    = 0;

        // ── Demo mode state ──────────────────────────────────────────────────
        private List<DemoSequence.Step> _demoSteps;
        private int      _demoIndex      = 0;
        private DateTime _demoNextFireAt = DateTime.MinValue;
        private bool     _demoPrev       = false; // tracks DemoMode on→off transitions

        // ── Settings (set by plugin from Settings object) ────────────────────
        public double DisplaySeconds      { get; set; } = 15.0;
        public HashSet<string> EnabledCategories { get; set; }
        public bool EventOnlyMode { get; set; } = false;
        public bool DemoMode      { get; set; } = false;

        /// <summary>
        /// Optional hook — returns a cooldown multiplier for a given topic ID.
        /// Supplied by the plugin from FeedbackEngine. Default: no adjustment.
        /// </summary>
        public Func<string, double> GetCooldownMultiplier { get; set; } = _ => 1.0;

        // ── Public state (read by plugin, passed to dashboard) ───────────────
        public string CurrentText           => _currentText;
        public string CurrentCategory       => _currentCategory;
        public string CurrentTitle          => _currentTitle;
        public string CurrentTopicId        => _currentTopicId;
        public string CurrentSentimentLabel => _currentSentimentLabel;
        public string CurrentSentimentColor => _currentSentimentColor;
        public string CurrentTextColor      => _currentTextColor;
        public string CurrentEventExposition => _currentEventExposition;
        public int    CurrentSeverity       => _currentSeverity;
        public bool   IsVisible       => _currentText.Length > 0
                                         && (DateTime.UtcNow - _promptDisplayedAt).TotalSeconds < DisplaySeconds;
        public double SecondsRemaining
        {
            get
            {
                double elapsed = (DateTime.UtcNow - _promptDisplayedAt).TotalSeconds;
                return Math.Max(0, DisplaySeconds - elapsed);
            }
        }

        // ── Initialise ──────────────────────────────────────────────────────

        /// <summary>
        /// Shows a brief placeholder prompt so the dashboard is visible on startup
        /// before any game session begins. Auto-clears after DisplaySeconds.
        /// </summary>
        public void ShowDemoPrompt()
        {
            _currentText           = "Media Coach is active. Prompts will appear here when telemetry events fire during your session.";
            _currentCategory       = "hardware";
            _currentTitle          = "Media Coach Ready";
            _currentSentimentColor = "#6637474F"; // neutral dark slate, low alpha (AARRGGBB)
            _currentTextColor      = "#FFFFFFFF"; // default white text
            _currentSeverity       = 1;
            _promptDisplayedAt     = DateTime.UtcNow;
        }

        public void LoadTopics(string jsonPath)
        {
            if (!File.Exists(jsonPath))
            {
                SimHub.Logging.Current.Warn($"[MediaCoach] Topics file not found: {jsonPath}");
                LoadBuiltinTopics();
                return;
            }

            try
            {
                string json = File.ReadAllText(jsonPath);
                var settings = new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver()
                };
                var file = JsonConvert.DeserializeObject<CommentaryTopicsFile>(json, settings);
                _topics = file?.Topics ?? new List<CommentaryTopic>();
                SimHub.Logging.Current.Info($"[MediaCoach] Loaded {_topics.Count} topics from {jsonPath}");
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Error($"[MediaCoach] Failed to load topics: {ex.Message}");
                LoadBuiltinTopics();
            }
        }

        public void LoadSentiments(string jsonPath)
        {
            if (!File.Exists(jsonPath))
            {
                SimHub.Logging.Current.Warn($"[MediaCoach] Sentiments file not found: {jsonPath}");
                return;
            }

            try
            {
                string json = File.ReadAllText(jsonPath);
                var settings = new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver()
                };
                var file = JsonConvert.DeserializeObject<SentimentsFile>(json, settings);
                if (file?.Sentiments != null)
                {
                    _sentimentColors.Clear();
                    _sentimentLabels.Clear();
                    foreach (var s in file.Sentiments)
                    {
                        if (string.IsNullOrEmpty(s.Id)) continue;
                        if (!string.IsNullOrEmpty(s.Color))
                            _sentimentColors[s.Id] = NormalizeColor(s.Color);
                        if (!string.IsNullOrEmpty(s.Label))
                            _sentimentLabels[s.Id] = s.Label;
                    }
                }
                SimHub.Logging.Current.Info($"[MediaCoach] Loaded {_sentimentColors.Count} sentiment colors");
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Error($"[MediaCoach] Failed to load sentiments: {ex.Message}");
            }
        }

        public void LoadFragments(string jsonPath)
        {
            _fragmentAssembler.LoadFragments(jsonPath);
        }

        private void LoadBuiltinTopics()
        {
            _topics = new List<CommentaryTopic>
            {
                new CommentaryTopic
                {
                    Id = "car_balance_fallback",
                    Category = "car_response",
                    Title = "Car Balance",
                    Severity = 2,
                    EventExposition = "Lateral load at {value}G — car working hard through the corner",
                    CommentaryPrompts = new List<string>
                    {
                        "Talk about how the car is feeling right now — is it balanced or fighting you?",
                        "What does the car need right now to go faster?"
                    },
                    Triggers = new List<TriggerCondition>
                    {
                        new TriggerCondition { DataPoint = "LatAccel", Condition = ">", Value = 2.5 }
                    },
                    CooldownMinutes = 2
                },
                new CommentaryTopic
                {
                    Id = "fuel_fallback",
                    Category = "racing_experience",
                    Title = "Fuel Strategy",
                    Severity = 3,
                    EventExposition = "Fuel at {value}% — running low on this stint",
                    CommentaryPrompts = new List<string>
                    {
                        "Talk about your fuel situation — how many laps do you have left?"
                    },
                    Triggers = new List<TriggerCondition>
                    {
                        new TriggerCondition { DataPoint = "FuelPercent", Condition = "<", Value = 0.25 }
                    },
                    CooldownMinutes = 3
                }
            };
        }

        // ── Main update loop ────────────────────────────────────────────────

        /// <summary>
        /// Called once per DataUpdate frame. Branches into demo mode if enabled,
        /// otherwise evaluates real telemetry triggers. Supports severity-based
        /// interruption: higher-severity events override lower ones immediately.
        /// Thread-safe via volatile writes.
        /// </summary>
        public void Update(TelemetrySnapshot current, TelemetrySnapshot previous)
        {
            if (DemoMode)
            {
                UpdateDemo();
                return;
            }

            // When demo mode is turned off, reset demo state and clear any demo prompt
            if (_demoPrev)
            {
                _demoSteps      = null;
                _demoIndex      = 0;
                _demoNextFireAt = DateTime.MinValue;
                _demoPrev       = false;
                ClearPrompt();
            }

            // Auto-clear expired prompts
            if (!IsVisible && _currentText.Length > 0)
                ClearPrompt();

            if (!current.GameRunning) return;

            // Evaluate topics in severity-descending order so the most important fires first,
            // then randomize within the same severity tier.
            var ordered = _topics
                .OrderByDescending(t => t.Severity)
                .ThenBy(_ => _rng.Next())
                .ToList();

            foreach (var topic in ordered)
            {
                if (!IsTopicEnabled(topic, current.SessionTypeName)) continue;
                if (!IsTopicCooledDown(topic)) continue;
                if (!AnyTriggerFires(topic, current, previous)) continue;

                // Severity-based interruption logic:
                // If a prompt is currently visible, only replace it if the new topic
                // has strictly higher severity.
                if (IsVisible)
                {
                    if (topic.Severity <= _currentSeverity)
                        continue; // skip — current prompt is same or higher severity

                    // Higher-severity event: interrupt immediately
                    SimHub.Logging.Current.Info(
                        $"[MediaCoach] Interrupting [{_currentTitle}] (sev {_currentSeverity}) with [{topic.Title}] (sev {topic.Severity})");
                }
                else
                {
                    // No prompt visible: enforce anti-spam for non-critical events
                    double elapsed = (DateTime.UtcNow - _lastPromptFireTime).TotalSeconds;
                    if (elapsed < AntiSpamSeconds && topic.Severity < 4)
                        continue;
                }

                ShowPrompt(topic, current);
                return; // one prompt per evaluation
            }
        }

        /// <summary>
        /// Demo mode update path. Fires curated steps from DemoSequence in order,
        /// respecting each step's delay (capped at 30 s). Interruption steps fire
        /// while the previous prompt is still visible, demonstrating the severity system.
        /// Loops continuously so the dashboard stays animated.
        /// </summary>
        private void UpdateDemo()
        {
            _demoPrev = true;

            // Auto-clear expired prompts
            if (!IsVisible && _currentText.Length > 0)
                ClearPrompt();

            // Initialise sequence on first entry
            if (_demoSteps == null)
            {
                _demoSteps      = DemoSequence.Build();
                _demoIndex      = 0;
                _demoNextFireAt = DateTime.UtcNow; // fire first step immediately
            }

            if (DateTime.UtcNow < _demoNextFireAt) return;

            // Find the topic for this step
            int safeIndex = _demoIndex % _demoSteps.Count;
            var step = _demoSteps[safeIndex];
            _demoIndex++;

            CommentaryTopic topic = _topics.Find(t => t.Id == step.TopicId);
            if (topic == null)
            {
                // Topic not found (e.g., filtered out) — skip and schedule next
                double skipDelay = Math.Min(step.DelaySeconds, 30.0);
                _demoNextFireAt = DateTime.UtcNow.AddSeconds(Math.Max(skipDelay, 3.0));
                return;
            }

            // Schedule the NEXT step before firing this one
            double nextDelay = safeIndex + 1 < _demoSteps.Count
                ? _demoSteps[safeIndex + 1].DelaySeconds
                : _demoSteps[0].DelaySeconds;
            _demoNextFireAt = DateTime.UtcNow.AddSeconds(Math.Min(nextDelay, 30.0));

            // In demo mode, severity-based interruption logic still applies so viewers see it live.
            if (IsVisible && topic.Severity <= _currentSeverity)
            {
                // This step would be blocked — advance immediately so the sequence keeps moving
                _demoNextFireAt = DateTime.UtcNow.AddSeconds(2.0);
                return;
            }

            if (step.IsInterrupt && IsVisible)
                SimHub.Logging.Current.Info(
                    $"[MediaCoach][Demo] Interrupting [{_currentTitle}] (sev {_currentSeverity}) with [{topic.Title}] (sev {topic.Severity})");

            ShowPrompt(topic, step.Snapshot);
        }

        public void ClearPrompt()
        {
            _currentText            = "";
            _currentCategory        = "";
            _currentTitle           = "";
            _currentTopicId         = "";
            _currentSentimentLabel  = "";
            _currentSentimentColor  = "#FF000000";
            _currentTextColor       = "#FFFFFFFF";
            _currentEventExposition = "";
            _currentSeverity        = 0;
        }

        // ── Helpers ─────────────────────────────────────────────────────────

        private bool IsTopicEnabled(CommentaryTopic topic, string sessionTypeName)
        {
            if (EnabledCategories != null && EnabledCategories.Count > 0)
                if (!EnabledCategories.Contains(topic.Category)) return false;

            // Session type filter: if topic specifies session types, enforce them
            if (topic.SessionTypes != null && topic.SessionTypes.Count > 0)
            {
                string sn = (sessionTypeName ?? "").ToLowerInvariant();
                bool matched = false;
                foreach (var st in topic.SessionTypes)
                {
                    if (sn.Contains(st.ToLowerInvariant())) { matched = true; break; }
                }
                if (!matched) return false;
            }

            return true;
        }

        private bool IsTopicCooledDown(CommentaryTopic topic)
        {
            if (!_topicLastTrigger.TryGetValue(topic.Id, out DateTime last))
                return true;
            double multiplier = GetCooldownMultiplier(topic.Id);
            return (DateTime.UtcNow - last).TotalMinutes >= topic.CooldownMinutes * multiplier;
        }

        private bool AnyTriggerFires(CommentaryTopic topic, TelemetrySnapshot cur, TelemetrySnapshot prev)
        {
            foreach (var trigger in topic.Triggers)
            {
                if (TriggerEvaluator.Evaluate(trigger, cur, prev))
                    return true;
            }
            return false;
        }

        /// <summary>
        /// Resolves the overlay color for a topic.
        /// Color (RGB) comes from the topic's CATEGORY — avoids flag color collisions.
        /// Alpha (opacity) comes from the topic's SEVERITY — higher = more opaque.
        /// Returns #AARRGGBB format.
        /// </summary>
        private string ResolveSentimentColor(CommentaryTopic topic)
        {
            // Get RGB from category
            string rgb = CategoryColors.TryGetValue(topic.Category ?? "", out var catRgb)
                ? catRgb
                : "37474F"; // fallback slate grey

            // Get alpha from severity
            string alpha = SeverityAlphas.TryGetValue(topic.Severity, out var a)
                ? a
                : "B3"; // fallback 70%

            return $"#{alpha}{rgb}";
        }

        /// <summary>
        /// Resolves the WCAG-compliant text color for a topic.
        /// Same hue family as the overlay, but bright enough for AA contrast
        /// against the translucent overlay on a dark/black background.
        /// Returns #AARRGGBB (fully opaque).
        /// </summary>
        private string ResolveTextColor(CommentaryTopic topic)
        {
            return CategoryTextColors.TryGetValue(topic.Category ?? "", out var textColor)
                ? textColor
                : "#FFFFFFFF"; // fallback white
        }

        private void ShowPrompt(CommentaryTopic topic, TelemetrySnapshot context)
        {
            // Try to assemble from fragments first; fall back to static prompts if not available
            string prompt = _fragmentAssembler.Assemble(topic.Id, context);

            if (prompt == null)
            {
                // Fallback to static commentary prompts
                if (topic.CommentaryPrompts == null || topic.CommentaryPrompts.Count == 0) return;

                prompt = topic.CommentaryPrompts[_rng.Next(topic.CommentaryPrompts.Count)];

                // Substitute driver-name placeholders if opponent data is available
                if (context != null)
                {
                    prompt = prompt.Replace("{ahead}",  FormatDriver(context.NearestAheadName,  context.NearestAheadRating));
                    prompt = prompt.Replace("{behind}", FormatDriver(context.NearestBehindName, context.NearestBehindRating));
                }
            }

            // Build event exposition text (used in event-only mode)
            string exposition = BuildEventExposition(topic, context);

            // Resolve colors — category determines hue, severity determines opacity
            string sentimentColor = ResolveSentimentColor(topic);
            string textColor      = ResolveTextColor(topic);
            string sentimentLabel = SeverityLabels.TryGetValue(topic.Severity, out var sl)
                ? sl
                : (!string.IsNullOrEmpty(topic.Sentiment) && _sentimentLabels.TryGetValue(topic.Sentiment, out var l) ? l : "");

            _currentText            = prompt;
            _currentCategory        = topic.Category;
            _currentTitle           = topic.Title;
            _currentTopicId         = topic.Id;
            _currentSentimentLabel  = sentimentLabel;
            _currentSentimentColor  = sentimentColor;
            _currentTextColor       = textColor;
            _currentEventExposition = exposition;
            _currentSeverity        = topic.Severity;
            _promptDisplayedAt      = DateTime.UtcNow;

            _topicLastTrigger[topic.Id] = DateTime.UtcNow;
            _lastPromptFireTime = DateTime.UtcNow;

            SimHub.Logging.Current.Info($"[MediaCoach] Prompt shown: [{topic.Title}] (sev {topic.Severity}) {prompt}");
        }

        /// <summary>
        /// Builds a concise, on-air-readable exposition string for event-only mode.
        /// Uses the topic's EventExposition template if present, otherwise generates
        /// a default from the topic title and trigger data.
        /// </summary>
        private string BuildEventExposition(CommentaryTopic topic, TelemetrySnapshot context)
        {
            string template = topic.EventExposition;

            if (string.IsNullOrEmpty(template))
            {
                // Generate a sensible default from the topic title + severity
                string sevTag = SeverityLabels.TryGetValue(topic.Severity, out var s) ? s.ToUpper() : "";
                return $"[{sevTag}] {topic.Title}";
            }

            // Substitute {value} with the primary trigger's current value
            if (context != null && topic.Triggers.Count > 0)
            {
                var primaryTrigger = topic.Triggers[0];
                double val = TriggerEvaluator.GetValuePublic(context, primaryTrigger.DataPoint);
                template = template.Replace("{value}", FormatValue(val, primaryTrigger.DataPoint));
            }

            // Substitute driver-name placeholders
            if (context != null)
            {
                template = template.Replace("{ahead}",  FormatDriver(context.NearestAheadName,  context.NearestAheadRating));
                template = template.Replace("{behind}", FormatDriver(context.NearestBehindName, context.NearestBehindRating));
            }

            return template;
        }

        private static string FormatValue(double val, string dataPoint)
        {
            string dp = (dataPoint ?? "").ToLower();
            // Percentage fields: display as integer percent
            if (dp.Contains("pct") || dp.Contains("percent") || dp == "fuelpercent" || dp == "fuellevelpct")
                return $"{val * 100:0}";
            // Temperatures
            if (dp.Contains("temp"))
                return $"{val:0.0}";
            // Accel / rates: one decimal
            if (dp.Contains("accel") || dp.Contains("yaw") || dp.Contains("torque"))
                return $"{val:0.0}";
            // Lap times: display as seconds
            if (dp.Contains("laptime") || dp.Contains("delta"))
                return $"{val:0.000}";
            // Default: sensible rounding
            return Math.Abs(val) >= 100 ? $"{val:0}" : $"{val:0.0}";
        }

        private static string FormatDriver(string name, int rating)
        {
            if (string.IsNullOrEmpty(name)) return "the car";
            return rating > 0 ? $"{name} ({rating:N0} iR)" : name;
        }

        /// <summary>
        /// Converts a color string to #AARRGGBB format for SimHub dashboard compatibility.
        /// Accepts #RGB, #RRGGBB, or #AARRGGBB input.
        /// </summary>
        public static string NormalizeColor(string color)
        {
            if (string.IsNullOrEmpty(color)) return "#FF000000";
            color = color.Trim();
            if (!color.StartsWith("#")) color = "#" + color;

            // Already in #AARRGGBB format (9 chars)
            if (color.Length == 9) return color.ToUpper();

            // #RRGGBB format (7 chars) — prepend FF alpha
            if (color.Length == 7) return "#FF" + color.Substring(1).ToUpper();

            // #RGB shorthand (4 chars)
            if (color.Length == 4)
            {
                char r = color[1], g = color[2], b = color[3];
                return $"#FF{r}{r}{g}{g}{b}{b}".ToUpper();
            }

            return "#FF000000";
        }
    }
}
