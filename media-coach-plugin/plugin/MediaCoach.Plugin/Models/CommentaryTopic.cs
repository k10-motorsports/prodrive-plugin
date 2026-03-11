using System.Collections.Generic;

namespace MediaCoach.Plugin.Models
{
    public class CommentaryTopicsFile
    {
        public string Version { get; set; }
        public List<CommentaryTopic> Topics { get; set; } = new List<CommentaryTopic>();
    }

    public class CommentaryTopic
    {
        public string Id { get; set; }
        public string Category { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string Sentiment { get; set; }

        /// <summary>
        /// Event severity 1-5. Higher values can interrupt lower-severity prompts.
        /// 1 = ambient/informational, 2 = notable, 3 = significant, 4 = urgent, 5 = critical.
        /// </summary>
        public int Severity { get; set; } = 2;

        /// <summary>
        /// Short, repeatable on-air description of the event for event-only display mode.
        /// Uses {value} placeholder for the triggering data value.
        /// Example: "Tyre temps over {value}°C — fronts are overheating"
        /// </summary>
        public string EventExposition { get; set; }

        public List<string> SessionTypes { get; set; } = new List<string>();
        public List<TriggerCondition> Triggers { get; set; } = new List<TriggerCondition>();
        public List<string> CommentaryPrompts { get; set; } = new List<string>();
        public double CooldownMinutes { get; set; } = 2.0;
    }

    /// <summary>
    /// Fragment-based composition data for a single topic. Allows assembly of unique
    /// sentences from opener + body + closer fragments at runtime.
    /// </summary>
    public class TopicFragments
    {
        public string TopicId { get; set; }
        public FragmentSet Fragments { get; set; }
    }

    public class FragmentSet
    {
        public List<string> Openers { get; set; } = new List<string>();
        public List<string> Bodies { get; set; } = new List<string>();
        public List<string> Closers { get; set; } = new List<string>();
    }

    /// <summary>
    /// Root object for commentary_fragments.json deserialization.
    /// </summary>
    public class CommentaryFragmentsFile
    {
        public List<TopicFragments> Fragments { get; set; } = new List<TopicFragments>();
    }

    public class TriggerCondition
    {
        /// <summary>
        /// The telemetry field to watch. See TelemetrySnapshot for supported names.
        /// </summary>
        public string DataPoint { get; set; }

        /// <summary>
        /// Comparison type: >, <, ==, change, spike, sudden_drop, extreme,
        /// rapid_change, personal_best, player_gain_position, player_lost_position,
        /// player_entering, off_track, yellow_flag, black_flag, race_start, increase,
        /// close_proximity
        /// </summary>
        public string Condition { get; set; }

        /// <summary>Threshold value for >, <, == comparisons.</summary>
        public double? Value { get; set; }

        /// <summary>Absolute value threshold for "extreme" condition.</summary>
        public double? AbsValue { get; set; }

        /// <summary>Minimum delta for "spike" or "sudden_drop" conditions.</summary>
        public double? ThresholdDelta { get; set; }

        /// <summary>Proximity fraction (0-1) for close_proximity.</summary>
        public double? ProximityThreshold { get; set; }

        public string Context { get; set; }
    }
}
