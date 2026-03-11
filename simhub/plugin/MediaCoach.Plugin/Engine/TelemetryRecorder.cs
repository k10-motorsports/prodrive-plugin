using System;
using System.IO;
using Newtonsoft.Json;

namespace MediaCoach.Plugin.Engine
{
    /// <summary>
    /// Writes telemetry snapshots to a JSONL file for offline trigger testing.
    /// Each line is: {"T": elapsed_seconds, "S": TelemetrySnapshot}
    /// Use MediaCoach.TestRunner to replay recordings and see what prompts fire.
    /// </summary>
    public class TelemetryRecorder : IDisposable
    {
        private StreamWriter _writer;
        private DateTime _sessionStart;

        public bool IsRecording => _writer != null;
        public string CurrentFile { get; private set; }

        public void StartRecording(string directory)
        {
            StopRecording();
            try
            {
                Directory.CreateDirectory(directory);
                string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                string path = Path.Combine(directory, $"session_{timestamp}.jsonl");
                _writer = new StreamWriter(path, append: false) { AutoFlush = true };
                _sessionStart = DateTime.UtcNow;
                CurrentFile = path;
                SimHub.Logging.Current.Info($"[MediaCoach] Recording telemetry to {path}");
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Error($"[MediaCoach] Failed to start recording: {ex.Message}");
                _writer = null;
                CurrentFile = null;
            }
        }

        public void StopRecording()
        {
            if (_writer == null) return;
            _writer.Dispose();
            _writer = null;
            SimHub.Logging.Current.Info($"[MediaCoach] Telemetry recording saved to {CurrentFile}");
        }

        public void Write(TelemetrySnapshot snap)
        {
            if (_writer == null || snap == null) return;
            try
            {
                var record = new
                {
                    T = (DateTime.UtcNow - _sessionStart).TotalSeconds,
                    S = snap
                };
                _writer.WriteLine(JsonConvert.SerializeObject(record));
            }
            catch { }
        }

        public void Dispose() => StopRecording();
    }
}
