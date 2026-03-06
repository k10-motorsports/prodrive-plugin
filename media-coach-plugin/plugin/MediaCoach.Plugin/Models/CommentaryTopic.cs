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
        public List<TriggerCondition> Triggers { get; set; } = new List<TriggerCondition>();
        public List<string> CommentaryPrompts { get; set; } = new List<string>();
        public double CooldownMinutes { get; set; } = 2.0;
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
