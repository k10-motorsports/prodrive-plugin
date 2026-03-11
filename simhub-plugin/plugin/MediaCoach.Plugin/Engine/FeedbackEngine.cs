using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace MediaCoach.Plugin.Engine
{
    /// <summary>
    /// Records ThumbsUp / ThumbsDown ratings per topic and adjusts per-topic
    /// cooldown multipliers based on accumulated feedback.
    ///
    /// Thumbs down → longer cooldown (up to 4×, so annoying topics fire much less).
    /// Thumbs up   → shorter cooldown (down to 0.25×, so good topics fire more often).
    ///
    /// Multipliers are computed from the last 20 ratings per topic so recent
    /// feedback matters more than old feedback.
    /// </summary>
    public class FeedbackEngine
    {
        private readonly string _feedbackPath;
        private List<FeedbackEntry> _entries = new List<FeedbackEntry>();
        private readonly Dictionary<string, double> _multipliers = new Dictionary<string, double>();

        public int TotalEntries => _entries.Count;

        public FeedbackEngine(string feedbackPath)
        {
            _feedbackPath = feedbackPath;
            Load();
        }

        private void Load()
        {
            if (!File.Exists(_feedbackPath)) return;
            try
            {
                string json = File.ReadAllText(_feedbackPath);
                var loaded = JsonConvert.DeserializeObject<List<FeedbackEntry>>(json);
                if (loaded != null) _entries = loaded;
                ComputeMultipliers();
                SimHub.Logging.Current.Info($"[MediaCoach] Loaded {_entries.Count} feedback entries");
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Warn($"[MediaCoach] Could not load feedback: {ex.Message}");
            }
        }

        /// <summary>Records a rating for the currently-displayed prompt.</summary>
        /// <param name="rating">+1 for thumbs up, -1 for thumbs down.</param>
        public void Record(string topicId, string promptText, int rating)
        {
            if (string.IsNullOrEmpty(topicId)) return;

            _entries.Add(new FeedbackEntry
            {
                TopicId    = topicId,
                PromptText = promptText,
                Rating     = rating,
                Timestamp  = DateTime.UtcNow
            });

            try
            {
                string dir = Path.GetDirectoryName(_feedbackPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(_feedbackPath, JsonConvert.SerializeObject(_entries, Formatting.Indented));
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Warn($"[MediaCoach] Could not save feedback: {ex.Message}");
            }

            ComputeMultipliers();
        }

        /// <summary>
        /// Returns the cooldown multiplier for a topic based on its feedback history.
        /// 1.0 = no adjustment, 4.0 = 4× longer cooldown, 0.25 = 4× shorter.
        /// </summary>
        public double GetMultiplier(string topicId)
            => _multipliers.TryGetValue(topicId, out double m) ? m : 1.0;

        private void ComputeMultipliers()
        {
            // Group ratings per topic
            var grouped = new Dictionary<string, List<int>>();
            foreach (var e in _entries)
            {
                if (!grouped.ContainsKey(e.TopicId))
                    grouped[e.TopicId] = new List<int>();
                grouped[e.TopicId].Add(e.Rating);
            }

            _multipliers.Clear();
            foreach (var kv in grouped)
            {
                var ratings = kv.Value;
                // Use only the last 20 ratings so old feedback fades out
                int start = Math.Max(0, ratings.Count - 20);
                double sum = 0;
                for (int i = start; i < ratings.Count; i++) sum += ratings[i];
                double avg = sum / (ratings.Count - start);

                // avg = -1 (all thumbs down) → multiplier 4.0
                // avg =  0 (neutral)          → multiplier 1.0
                // avg = +1 (all thumbs up)    → multiplier 0.25
                double mult = avg < 0
                    ? 1.0 + (-avg * 3.0)   // -1 → 4.0
                    : 1.0 - (avg * 0.75);  // +1 → 0.25

                _multipliers[kv.Key] = Math.Max(0.25, Math.Min(4.0, mult));
            }
        }
    }

    public class FeedbackEntry
    {
        public string   TopicId    { get; set; }
        public string   PromptText { get; set; }
        public int      Rating     { get; set; } // +1 or -1
        public DateTime Timestamp  { get; set; }
    }
}
