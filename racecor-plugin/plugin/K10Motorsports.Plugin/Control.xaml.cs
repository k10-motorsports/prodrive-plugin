using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using SimHub.Plugins;
using K10Motorsports.Plugin.Engine;

namespace K10Motorsports.Plugin
{
    public partial class SettingsControl : UserControl
    {
        private readonly Plugin _plugin;
        private readonly PluginUpdater _updater = new PluginUpdater();

        public SettingsControl(Plugin plugin)
        {
            _plugin = plugin;
            InitializeComponent();
            RefreshTrackLists();

            // Load logo
            try
            {
                var asmDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location) ?? "";
                var iconPath = Path.Combine(asmDir, "icon.png");
                if (File.Exists(iconPath))
                {
                    BrandLogo.Source = new BitmapImage(new Uri(iconPath));
                }
            }
            catch { /* non-critical */ }

            UpdateStatusLabel.Text = $"Current version: v{_updater.CurrentVersion}";

            // Wire up state change notifications (may fire from background thread)
            _updater.StateChanged += () =>
            {
                Dispatcher.BeginInvoke(new Action(RefreshUpdateUI));
            };
        }

        private void RefreshTrackLists()
        {
            try
            {
                var searchPaths = _plugin.GetTrackMapSearchPaths();
                string activePath = "(not resolved)";
                foreach (var p in searchPaths)
                {
                    if (Directory.Exists(p)) { activePath = p; break; }
                }
                TrackMapsDirLabel.Text = $"Folder: {activePath}";
            }
            catch (Exception ex)
            {
                TrackMapsDirLabel.Text = $"Error: {ex.Message}";
            }
        }

        private void RefreshTracks_Click(object sender, RoutedEventArgs e)
        {
            RefreshTrackLists();
            ExportStatusLabel.Text = "";
        }

        private void ExportTracks_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var searchPaths = _plugin.GetTrackMapSearchPaths();
                string destDir = null;
                foreach (var p in searchPaths)
                {
                    if (p.Contains("PluginsData")) continue;
                    if (Directory.Exists(p)) { destDir = p; break; }
                }
                if (destDir == null && searchPaths.Count > 0) destDir = searchPaths[0];

                if (string.IsNullOrEmpty(destDir))
                {
                    ExportStatusLabel.Text = "Could not determine trackmaps folder.";
                    return;
                }

                int count = _plugin.ExportLocalMapsTo(destDir);
                ExportStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0x6f, 0xcf, 0x6f));
                ExportStatusLabel.Text = count > 0
                    ? $"Copied {count} track map{(count == 1 ? "" : "s")} to {destDir}"
                    : "No new tracks to copy.";
                RefreshTrackLists();
            }
            catch (Exception ex)
            {
                ExportStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0xcf, 0x6f, 0x6f));
                ExportStatusLabel.Text = $"Export failed: {ex.Message}";
            }
        }

        private void OpenTrackmapsFolder_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                var searchPaths = _plugin.GetTrackMapSearchPaths();
                string openPath = null;
                foreach (var p in searchPaths)
                {
                    if (p.Contains("PluginsData")) continue;
                    if (Directory.Exists(p)) { openPath = p; break; }
                }
                if (openPath == null && searchPaths.Count > 0)
                {
                    openPath = searchPaths[0];
                    Directory.CreateDirectory(openPath);
                }
                if (!string.IsNullOrEmpty(openPath))
                    Process.Start("explorer.exe", openPath);
            }
            catch (Exception ex)
            {
                ExportStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0xcf, 0x6f, 0x6f));
                ExportStatusLabel.Text = $"Failed to open folder: {ex.Message}";
            }
        }

        // ── Update UI ────────────────────────────────────────────

        private async void CheckUpdate_Click(object sender, RoutedEventArgs e)
        {
            CheckUpdateBtn.IsEnabled = false;
            CheckUpdateBtn.Content = "Checking…";
            await _updater.CheckForUpdateAsync();
            CheckUpdateBtn.IsEnabled = true;
            CheckUpdateBtn.Content = "Check for updates";
        }

        private async void InstallUpdate_Click(object sender, RoutedEventArgs e)
        {
            InstallUpdateBtn.IsEnabled = false;
            InstallUpdateBtn.Content = "Downloading…";
            UpdateProgress.Visibility = Visibility.Visible;
            await _updater.DownloadAndInstallAsync();
        }

        private void RefreshUpdateUI()
        {
            if (_updater.IsChecking)
            {
                UpdateStatusLabel.Text = "Checking for updates…";
                UpdateStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0x99, 0x99, 0x99));
                return;
            }

            if (_updater.IsDownloading)
            {
                UpdateStatusLabel.Text = $"Downloading… {_updater.DownloadPercent}%";
                UpdateProgress.Value = _updater.DownloadPercent;
                return;
            }

            if (!string.IsNullOrEmpty(_updater.ErrorMessage))
            {
                UpdateStatusLabel.Text = _updater.ErrorMessage;
                UpdateStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0xcf, 0x6f, 0x6f));
                UpdateProgress.Visibility = Visibility.Collapsed;
                InstallUpdateBtn.Visibility = Visibility.Collapsed;
                return;
            }

            if (_updater.UpdateAvailable)
            {
                UpdateStatusLabel.Text = $"v{_updater.LatestVersion} available!";
                UpdateStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0x6f, 0xcf, 0x6f));
                InstallUpdateBtn.Visibility = Visibility.Visible;
                UpdateVersionLabel.Text = !string.IsNullOrEmpty(_updater.ReleaseNotes)
                    ? _updater.ReleaseNotes
                    : "";
            }
            else
            {
                UpdateStatusLabel.Text = $"v{_updater.CurrentVersion} — up to date";
                UpdateStatusLabel.Foreground = new System.Windows.Media.SolidColorBrush(
                    System.Windows.Media.Color.FromRgb(0x99, 0x99, 0x99));
                InstallUpdateBtn.Visibility = Visibility.Collapsed;
                UpdateProgress.Visibility = Visibility.Collapsed;
                UpdateVersionLabel.Text = "";
            }
        }
    }
}
