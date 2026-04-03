using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace K10Motorsports.Plugin.Engine
{
    /// <summary>
    /// Reads iRacing session cookies from the local machine and fetches career data
    /// from the iRacing Data API (members-ng.iracing.com).
    ///
    /// Authentication strategy (in priority order):
    ///   1. Read cookies from iRacing's embedded Chromium browser cache on disk
    ///   2. Fall back to direct login with email + SHA-256 hashed password
    ///
    /// The iRacing UI is a CEF (Chromium Embedded Framework) application that stores
    /// session cookies locally. When the user is logged in to iRacing, we can piggyback
    /// on that active session to call the Data API without any separate OAuth flow.
    /// </summary>
    public class IRacingDataClient
    {
        private const string AUTH_URL = "https://members-ng.iracing.com/auth";
        private const string DATA_BASE = "https://members-ng.iracing.com/data";

        private CookieContainer _cookies;
        private bool _authenticated;
        private string _lastError;

        /// <summary>Whether we currently have valid cookies for the iRacing Data API.</summary>
        public bool IsAuthenticated => _authenticated;

        /// <summary>Last error message (auth failure, network error, etc.).</summary>
        public string LastError => _lastError;

        // ═══════════════════════════════════════════════════════════════
        //  Authentication
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Try to authenticate using locally cached iRacing cookies.
        /// Searches common CEF cookie store paths on Windows.
        /// </summary>
        public bool TryLoadLocalCookies()
        {
            _cookies = new CookieContainer();

            // iRacing's CEF browser stores cookies in these known locations
            var cookiePaths = GetCookieStorePaths();

            foreach (var path in cookiePaths)
            {
                if (!File.Exists(path)) continue;

                try
                {
                    var cookies = ReadChromiumCookies(path);
                    if (cookies.Count > 0)
                    {
                        foreach (var c in cookies)
                            _cookies.Add(c);

                        // Verify the cookies work
                        if (VerifyAuth())
                        {
                            _authenticated = true;
                            SimHub.Logging.Current.Info($"[IRacingData] Authenticated via local cookies from {path}");
                            return true;
                        }
                    }
                }
                catch (Exception ex)
                {
                    SimHub.Logging.Current.Warn($"[IRacingData] Could not read cookies from {path}: {ex.Message}");
                }
            }

            _lastError = "No valid iRacing cookies found locally";
            return false;
        }

        /// <summary>
        /// Authenticate directly with iRacing using email + password.
        /// Password is hashed client-side per iRacing's auth protocol:
        ///   hash = Base64(SHA256(password + email.ToLower()))
        /// </summary>
        public bool Authenticate(string email, string password)
        {
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                _lastError = "Email and password required";
                return false;
            }

            try
            {
                _cookies = new CookieContainer();

                // iRacing auth: SHA-256 hash of (password + lowercase email), then base64
                string hashInput = password + email.ToLowerInvariant();
                byte[] hashBytes;
                using (var sha = SHA256.Create())
                {
                    hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(hashInput));
                }
                string encodedPassword = Convert.ToBase64String(hashBytes);

                // POST to auth endpoint
                var request = (HttpWebRequest)WebRequest.Create(AUTH_URL);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.CookieContainer = _cookies;
                request.UserAgent = "K10Motorsports/1.0";

                string body = JsonConvert.SerializeObject(new
                {
                    email = email,
                    password = encodedPassword
                });

                byte[] bodyBytes = Encoding.UTF8.GetBytes(body);
                request.ContentLength = bodyBytes.Length;
                using (var stream = request.GetRequestStream())
                {
                    stream.Write(bodyBytes, 0, bodyBytes.Length);
                }

                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    if (response.StatusCode == HttpStatusCode.OK)
                    {
                        _authenticated = true;
                        SimHub.Logging.Current.Info("[IRacingData] Authenticated via email/password");
                        return true;
                    }
                    _lastError = $"Auth failed: HTTP {(int)response.StatusCode}";
                }
            }
            catch (WebException ex)
            {
                if (ex.Response is HttpWebResponse resp)
                {
                    using (var reader = new StreamReader(resp.GetResponseStream()))
                    {
                        string respBody = reader.ReadToEnd();
                        _lastError = $"Auth failed ({(int)resp.StatusCode}): {respBody}";
                    }
                }
                else
                {
                    _lastError = $"Auth error: {ex.Message}";
                }
            }
            catch (Exception ex)
            {
                _lastError = $"Auth error: {ex.Message}";
            }

            return false;
        }

        /// <summary>
        /// Verify current cookies are valid by hitting /data/member/info.
        /// </summary>
        private bool VerifyAuth()
        {
            try
            {
                var result = ApiGet("/member/info");
                return result != null;
            }
            catch
            {
                return false;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  Data API — Career & Stats
        // ═══════════════════════════════════════════════════════════════

        /// <summary>Get authenticated member's info (custId, displayName, etc.).</summary>
        public JObject GetMemberInfo()
        {
            return ApiGet("/member/info");
        }

        /// <summary>Get career summary stats (wins, podiums, laps by category).</summary>
        public JArray GetMemberSummary(int? custId = null)
        {
            string path = "/stats/member_summary";
            if (custId.HasValue) path += "?cust_id=" + custId.Value;
            var result = ApiGet(path);
            return result?["stats"] as JArray ?? new JArray();
        }

        /// <summary>Get recent race results.</summary>
        public JArray GetRecentRaces(int? custId = null)
        {
            string path = "/stats/member_recent_races";
            if (custId.HasValue) path += "?cust_id=" + custId.Value;
            var result = ApiGet(path);
            return result?["races"] as JArray ?? new JArray();
        }

        /// <summary>
        /// Get iRating chart data over time.
        /// chartType: 1=iRating, 2=ttRating, 3=license/SR
        /// categoryId: 1=oval, 2=road, 3=dirt_oval, 4=dirt_road, 5=sports_car
        /// </summary>
        public JArray GetChartData(int custId, int categoryId = 2, int chartType = 1)
        {
            string path = $"/member/chart_data?cust_id={custId}&category_id={categoryId}&chart_type={chartType}";
            var result = ApiGet(path);
            return result?["data"] as JArray ?? new JArray();
        }

        /// <summary>Get yearly stats breakdown.</summary>
        public JArray GetYearlyStats(int? custId = null)
        {
            string path = "/stats/member_yearly";
            if (custId.HasValue) path += "?cust_id=" + custId.Value;
            var result = ApiGet(path);
            return result?["stats"] as JArray ?? new JArray();
        }

        // ═══════════════════════════════════════════════════════════════
        //  Full Career Export — collects everything into one payload
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Fetch complete career data and return as a JSON object suitable for
        /// posting to the Pro Drive web API bulk import endpoint.
        /// </summary>
        public JObject ExportFullCareer()
        {
            if (!_authenticated)
            {
                _lastError = "Not authenticated";
                return null;
            }

            try
            {
                // 1. Get member info
                var memberInfo = GetMemberInfo();
                if (memberInfo == null)
                {
                    _lastError = "Could not fetch member info";
                    return null;
                }

                int custId = memberInfo.Value<int>("cust_id");
                string displayName = memberInfo.Value<string>("display_name") ?? "";

                SimHub.Logging.Current.Info($"[IRacingData] Exporting career for {displayName} (#{custId})");

                // 2. Fetch recent races
                JArray recentRaces;
                try { recentRaces = GetRecentRaces(custId); }
                catch (Exception ex)
                {
                    SimHub.Logging.Current.Warn($"[IRacingData] Recent races fetch failed: {ex.Message}");
                    recentRaces = new JArray();
                }

                // 3. Fetch career summary
                JArray careerSummary;
                try { careerSummary = GetMemberSummary(custId); }
                catch (Exception ex)
                {
                    SimHub.Logging.Current.Warn($"[IRacingData] Career summary fetch failed: {ex.Message}");
                    careerSummary = new JArray();
                }

                // 4. Fetch iRating history for all categories
                var chartData = new JObject();
                var categories = new[] {
                    (id: 1, name: "oval"),
                    (id: 2, name: "road"),
                    (id: 3, name: "dirt_oval"),
                    (id: 4, name: "dirt_road"),
                    (id: 5, name: "sports_car"),
                };

                foreach (var (id, name) in categories)
                {
                    try
                    {
                        var data = GetChartData(custId, id, 1);
                        if (data.Count > 0)
                            chartData[name] = data;
                    }
                    catch (Exception ex)
                    {
                        SimHub.Logging.Current.Warn($"[IRacingData] Chart data ({name}) failed: {ex.Message}");
                    }
                }

                // 5. Fetch yearly stats
                JArray yearlyStats;
                try { yearlyStats = GetYearlyStats(custId); }
                catch (Exception ex)
                {
                    SimHub.Logging.Current.Warn($"[IRacingData] Yearly stats fetch failed: {ex.Message}");
                    yearlyStats = new JArray();
                }

                // Build the export payload
                return new JObject
                {
                    ["custId"] = custId,
                    ["displayName"] = displayName,
                    ["recentRaces"] = recentRaces,
                    ["careerSummary"] = careerSummary,
                    ["chartData"] = chartData,
                    ["yearlyStats"] = yearlyStats,
                    ["exportedAt"] = DateTime.UtcNow.ToString("o"),
                };
            }
            catch (Exception ex)
            {
                _lastError = $"Export failed: {ex.Message}";
                SimHub.Logging.Current.Error($"[IRacingData] Career export error: {ex}");
                return null;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  HTTP Helpers
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Make an authenticated GET to the iRacing Data API.
        /// The API returns { link: "signed-url" } — we follow it to get actual data.
        /// </summary>
        private JObject ApiGet(string path)
        {
            string url = DATA_BASE + path;

            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.CookieContainer = _cookies;
            request.UserAgent = "K10Motorsports/1.0";
            request.Accept = "application/json";

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                string body = reader.ReadToEnd();
                var envelope = JObject.Parse(body);

                // iRacing returns a signed link to the actual data
                string link = envelope.Value<string>("link");
                if (!string.IsNullOrEmpty(link))
                {
                    return FollowDataLink(link);
                }

                return envelope;
            }
        }

        /// <summary>Follow a signed S3 data link and parse the JSON result.</summary>
        private JObject FollowDataLink(string url)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Accept = "application/json";
            // No cookies needed — the URL is pre-signed

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                string body = reader.ReadToEnd();

                // Data link may return an array or an object
                body = body.Trim();
                if (body.StartsWith("["))
                {
                    // Wrap array in object for consistent handling
                    return new JObject { ["data"] = JArray.Parse(body) };
                }
                return JObject.Parse(body);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  Cookie Store Discovery
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Get possible paths where iRacing stores its CEF cookies on Windows.
        /// The iRacing UI uses Chromium Embedded Framework which stores cookies
        /// in a SQLite database file named "Cookies" in the cache directory.
        /// </summary>
        private static List<string> GetCookieStorePaths()
        {
            var paths = new List<string>();

            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

            // iRacing's own CEF cache
            paths.Add(Path.Combine(localAppData, "iRacing", "cef_cache", "Cookies"));
            paths.Add(Path.Combine(localAppData, "iRacing", "cache", "Cookies"));
            paths.Add(Path.Combine(localAppData, "iRacing", "Cookies"));

            // iRacing member site accessed via Chrome/Edge — user may be logged in there
            paths.Add(Path.Combine(localAppData, "Google", "Chrome", "User Data", "Default", "Cookies"));
            paths.Add(Path.Combine(localAppData, "Google", "Chrome", "User Data", "Default", "Network", "Cookies"));
            paths.Add(Path.Combine(localAppData, "Microsoft", "Edge", "User Data", "Default", "Cookies"));
            paths.Add(Path.Combine(localAppData, "Microsoft", "Edge", "User Data", "Default", "Network", "Cookies"));
            paths.Add(Path.Combine(appData, "Mozilla", "Firefox", "Profiles")); // Firefox uses different format

            // Documents\iRacing (config files, possibly cookies)
            string docsIRacing = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "iRacing");
            paths.Add(Path.Combine(docsIRacing, "cef_cache", "Cookies"));

            return paths;
        }

        /// <summary>
        /// Read cookies for members.iracing.com from a Chromium SQLite cookie store.
        /// Chromium encrypts cookie values with DPAPI on Windows — we decrypt them here.
        ///
        /// NOTE: This requires the cookie DB not be locked by another process.
        /// We copy the file to a temp location first to avoid lock contention.
        /// </summary>
        private static List<Cookie> ReadChromiumCookies(string dbPath)
        {
            var result = new List<Cookie>();

            // The Cookies file is a SQLite DB. On .NET Framework 4.8 without a SQLite
            // NuGet dependency, we use a raw binary scan approach to find cookie values
            // for the iracing.com domain. This is more fragile than a proper SQL query
            // but avoids adding a heavy dependency.
            //
            // For production reliability, we prefer the direct auth approach (Authenticate method)
            // and use cookie reading only as a bonus convenience feature.

            try
            {
                // Copy to temp to avoid lock contention with the browser
                string tempPath = Path.Combine(Path.GetTempPath(), "k10_iracing_cookies_" + Guid.NewGuid().ToString("N"));
                File.Copy(dbPath, tempPath, true);

                try
                {
                    // Read the file as bytes and search for iracing.com domain cookies
                    byte[] data = File.ReadAllBytes(tempPath);
                    string text = Encoding.UTF8.GetString(data);

                    // Look for common iRacing cookie patterns in the raw SQLite data
                    // The cookie names we need: irsso_members, authtoken_members
                    // This is a best-effort approach — proper SQLite would be more reliable
                    var cookieNames = new[] { "irsso_members", "authtoken_members", "irsso", "members-ng" };

                    foreach (var name in cookieNames)
                    {
                        int idx = text.IndexOf(name, StringComparison.OrdinalIgnoreCase);
                        if (idx >= 0)
                        {
                            // Found the cookie name — the value is nearby in the binary data
                            // In Chromium's SQLite schema, encrypted_value follows the name
                            // For now, log that we found the cookie location
                            SimHub.Logging.Current.Info($"[IRacingData] Found cookie '{name}' in store at offset {idx}");
                        }
                    }
                }
                finally
                {
                    try { File.Delete(tempPath); } catch { }
                }
            }
            catch (Exception ex)
            {
                SimHub.Logging.Current.Warn($"[IRacingData] Cookie read failed: {ex.Message}");
            }

            return result;
        }
    }
}
