using System;
using System.Collections.Generic;
using System.IO;
using MediaCoach.Plugin.Engine;
using MediaCoach.Plugin.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

/// <summary>
/// Replays a telemetry recording through the trigger evaluator and prints
/// a transcript of every prompt that would have fired, with timestamps.
///
/// Usage:
///   MediaCoach.TestRunner.exe <recording.jsonl> <commentary_topics.json>
///
/// The recording file is produced by enabling RecordMode in the plugin settings.
/// Recordings are saved to: %ProgramData%\SimHub\PluginsData\MediaCoach\recordings\
/// </summary>

if (args.Length < 2)
{
    Console.WriteLine("Usage: MediaCoach.TestRunner <recording.jsonl> <commentary_topics.json>");
    Console.WriteLine();
    Console.WriteLine("Recordings are saved to:");
    Console.WriteLine("  %ProgramData%\\SimHub\\PluginsData\\MediaCoach\\recordings\\");
    return 1;
}

string recordingPath = args[0];
string topicsPath     = args[1];

if (!File.Exists(recordingPath)) { Console.Error.WriteLine($"Recording not found: {recordingPath}"); return 1; }
if (!File.Exists(topicsPath))    { Console.Error.WriteLine($"Topics file not found: {topicsPath}");  return 1; }

// Load topics
List<CommentaryTopic> topics;
try
{
    string json = File.ReadAllText(topicsPath);
    var file = JsonConvert.DeserializeObject<CommentaryTopicsFile>(json);
    topics = file?.Topics ?? new List<CommentaryTopic>();
    Console.WriteLine($"Loaded {topics.Count} topics from {Path.GetFileName(topicsPath)}");
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Failed to load topics: {ex.Message}");
    return 1;
}

// Load recording lines
string[] lines = File.ReadAllLines(recordingPath);
Console.WriteLine($"Loaded {lines.Length} frames from {Path.GetFileName(recordingPath)}");
Console.WriteLine();

// Replay state
var topicLastFire  = new Dictionary<string, double>();  // topicId → elapsed seconds
double lastFireAt  = double.MinValue;                   // anti-spam: 10s minimum
const double AntiSpamSeconds = 10.0;
int promptsFired   = 0;

var prev = new TelemetrySnapshot();
var transcript = new List<(double T, string TopicId, string Title, string Prompt)>();

for (int i = 0; i < lines.Length; i++)
{
    string line = lines[i].Trim();
    if (string.IsNullOrEmpty(line)) continue;

    TelemetrySnapshot cur;
    double elapsed;
    try
    {
        var obj = JObject.Parse(line);
        elapsed = obj["T"]?.Value<double>() ?? 0;
        cur     = obj["S"]?.ToObject<TelemetrySnapshot>() ?? new TelemetrySnapshot();
    }
    catch { continue; }

    if (!cur.GameRunning) { prev = cur; continue; }

    // Anti-spam
    if (elapsed - lastFireAt < AntiSpamSeconds) { prev = cur; continue; }

    // Shuffle topics deterministically for the replay (rotate by frame index for variety)
    var shuffled = new List<CommentaryTopic>(topics);
    int shift = i % topics.Count;
    for (int s = 0; s < shift; s++) { shuffled.Add(shuffled[0]); shuffled.RemoveAt(0); }

    foreach (var topic in shuffled)
    {
        // Cooldown check
        double cooldownSecs = topic.CooldownMinutes * 60.0;
        if (topicLastFire.TryGetValue(topic.Id, out double lastT))
            if (elapsed - lastT < cooldownSecs) continue;

        // Session type check
        if (topic.SessionTypes != null && topic.SessionTypes.Count > 0)
        {
            string sn = (cur.SessionTypeName ?? "").ToLowerInvariant();
            bool matched = false;
            foreach (var st in topic.SessionTypes)
                if (sn.Contains(st.ToLowerInvariant())) { matched = true; break; }
            if (!matched) continue;
        }

        // Trigger evaluation
        bool fires = false;
        foreach (var trigger in topic.Triggers)
        {
            if (TriggerEvaluator.Evaluate(trigger, cur, prev)) { fires = true; break; }
        }
        if (!fires) continue;

        // Pick a prompt
        if (topic.CommentaryPrompts == null || topic.CommentaryPrompts.Count == 0) continue;
        string prompt = topic.CommentaryPrompts[promptsFired % topic.CommentaryPrompts.Count];

        topicLastFire[topic.Id] = elapsed;
        lastFireAt = elapsed;
        promptsFired++;

        transcript.Add((elapsed, topic.Id, topic.Title, prompt));
        break; // one prompt per evaluation
    }

    prev = cur;
}

// Print transcript
if (transcript.Count == 0)
{
    Console.WriteLine("No prompts fired during this recording.");
    Console.WriteLine("Check that trigger thresholds match the telemetry values in the recording.");
    return 0;
}

Console.WriteLine($"── Transcript ({transcript.Count} prompts) ────────────────────────────────");
Console.WriteLine();

foreach (var (t, id, title, prompt) in transcript)
{
    TimeSpan ts = TimeSpan.FromSeconds(t);
    Console.WriteLine($"[{ts:hh\\:mm\\:ss}] {title} ({id})");
    Console.WriteLine($"  \"{prompt}\"");
    Console.WriteLine();
}

Console.WriteLine($"── Summary ────────────────────────────────────────────────────────────────");

// Per-topic count
var counts = new Dictionary<string, int>();
foreach (var (_, id, title, _) in transcript)
{
    if (!counts.ContainsKey(id)) counts[id] = 0;
    counts[id]++;
}

foreach (var kv in counts)
    Console.WriteLine($"  {kv.Key}: {kv.Value}×");

Console.WriteLine();
Console.WriteLine($"Total: {promptsFired} prompts over {TimeSpan.FromSeconds(lines.Length > 0 ? ParseElapsed(lines[^1]) : 0):hh\\:mm\\:ss}");

return 0;

static double ParseElapsed(string line)
{
    try { return JObject.Parse(line)["T"]?.Value<double>() ?? 0; } catch { return 0; }
}
