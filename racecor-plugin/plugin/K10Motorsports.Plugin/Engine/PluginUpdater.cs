using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace K10Motorsports.Plugin.Engine
{
    /// <summary>
    /// Checks GitHub Releases for new plugin versions and downloads
    /// the installer. After download, launches the installer and
    /// signals SimHub to restart.
    ///
    /// Uses only .NET Framework 4.8 BCL types (no Newtonsoft dependency)
    /// so the file compiles without SimHub's runtime DLLs on CI.
    /// </summary>
    public class PluginUpdater
    {
        private const string GitHubApiUrl =
            "https://api.github.com/repos/alternatekev/media-coach-simhub-plugin/releases/latest";
        private const string UserAgent = "K10Motorsports-Plugin";

        public string CurrentVersion { get; }
        public string LatestVersion { get; private set; }
        public string DownloadUrl { get; private set; }
        public string ReleaseNotes { get; private set; }
        public bool UpdateAvailable { get; private set; }
        public bool IsChecking { get; private set; }
        public bool IsDownloading { get; private set; }
        public int DownloadPercent { get; private set; }
        public string ErrorMessage { get; private set; }

        public event Action StateChanged;

        public PluginUpdater()
        {
            var asm = typeof(PluginUpdater).Assembly;
            var ver = asm.GetName().Version;
            CurrentVersion = ver != null ? $"{ver.Major}.{ver.Minor}.{ver.Build}" : "0.0.0";
        }

        /// <summary>
        /// Queries the GitHub Releases API for the latest release.
        /// Parses the JSON response with regex — avoids a compile-time
        /// dependency on Newtonsoft.Json (loaded at runtime by SimHub).
        /// </summary>
        public async Task CheckForUpdateAsync()
        {
            if (IsChecking) return;
            IsChecking = true;
            ErrorMessage = null;
            StateChanged?.Invoke();

            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

                var request = (HttpWebRequest)WebRequest.Create(GitHubApiUrl);
                request.UserAgent = UserAgent;
                request.Accept = "application/vnd.github+json";
                request.Timeout = 15000;

                using (var response = (HttpWebResponse)await Task.Factory.FromAsync(
                    request.BeginGetResponse, request.EndGetResponse, null))
                using (var reader = new StreamReader(response.GetResponseStream()))
                {
                    var json = await reader.ReadToEndAsync();

                    // Extract tag_name
                    var tagMatch = Regex.Match(json, @"""tag_name""\s*:\s*""([^""]+)""");
                    var tag = tagMatch.Success ? tagMatch.Groups[1].Value : "";
                    LatestVersion = Regex.Replace(tag, @"^v", "");

                    // Extract body (release notes) — handle escaped quotes
                    var bodyMatch = Regex.Match(json, @"""body""\s*:\s*""((?:[^""\\]|\\.)*)""");
                    ReleaseNotes = bodyMatch.Success
                        ? Regex.Unescape(bodyMatch.Groups[1].Value)
                        : "";

                    // Find the first Setup*.exe asset's browser_download_url.
                    // GitHub's asset JSON has nested objects (e.g. "uploader": {...})
                    // between "name" and "browser_download_url", so we match the
                    // download URL directly — it contains the filename.
                    DownloadUrl = null;
                    var dlUrlPattern = new Regex(
                        @"""browser_download_url""\s*:\s*""([^""]*Setup[^""]*\.exe)""",
                        RegexOptions.IgnoreCase);
                    var dlMatch = dlUrlPattern.Match(json);
                    if (dlMatch.Success)
                    {
                        DownloadUrl = dlMatch.Groups[1].Value;
                    }

                    UpdateAvailable = IsNewerVersion(LatestVersion, CurrentVersion) && DownloadUrl != null;
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Update check failed: {ex.Message}";
                UpdateAvailable = false;
            }
            finally
            {
                IsChecking = false;
                StateChanged?.Invoke();
            }
        }

        /// <summary>
        /// Downloads the installer to a temp file, then launches it.
        /// The Inno Setup installer handles closing SimHub if needed.
        /// </summary>
        public async Task DownloadAndInstallAsync()
        {
            if (IsDownloading || string.IsNullOrEmpty(DownloadUrl)) return;
            IsDownloading = true;
            DownloadPercent = 0;
            ErrorMessage = null;
            StateChanged?.Invoke();

            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

                var tempPath = Path.Combine(Path.GetTempPath(),
                    $"K10-Motorsports-Setup-{LatestVersion}.exe");

                using (var client = new WebClient())
                {
                    client.Headers.Add("User-Agent", UserAgent);
                    client.DownloadProgressChanged += (s, e) =>
                    {
                        DownloadPercent = e.ProgressPercentage;
                        StateChanged?.Invoke();
                    };

                    await client.DownloadFileTaskAsync(new Uri(DownloadUrl), tempPath);
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = tempPath,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Download failed: {ex.Message}";
            }
            finally
            {
                IsDownloading = false;
                StateChanged?.Invoke();
            }
        }

        private static bool IsNewerVersion(string remote, string local)
        {
            try
            {
                var r = new Version(NormalizeVersion(remote));
                var l = new Version(NormalizeVersion(local));
                return r > l;
            }
            catch
            {
                return false;
            }
        }

        private static string NormalizeVersion(string v)
        {
            var parts = v.Split('.');
            while (parts.Length < 3)
            {
                v += ".0";
                parts = v.Split('.');
            }
            return v;
        }
    }
}
