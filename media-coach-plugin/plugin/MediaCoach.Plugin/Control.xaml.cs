using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;

namespace MediaCoach.Plugin
{
    public partial class Control : UserControl
    {
        private readonly Plugin _plugin;
        private bool _loading = true;

        public Control(Plugin plugin)
        {
            _plugin = plugin;
            InitializeComponent();
            LoadSettings();
            _loading = false;
        }

        private void LoadSettings()
        {
            var s = _plugin.Settings;

            IntervalSlider.Value = s.MinSuggestionIntervalMinutes;
            IntervalLabel.Text   = $"{s.MinSuggestionIntervalMinutes:0.0} min";

            DisplaySlider.Value = s.PromptDisplaySeconds;
            DisplayLabel.Text   = $"{s.PromptDisplaySeconds:0} s";

            ShowTitleCheck.IsChecked = s.ShowTopicTitle;

            bool allEnabled = s.EnabledCategories == null || s.EnabledCategories.Count == 0;
            CatHardware.IsChecked    = allEnabled || s.EnabledCategories.Contains("hardware");
            CatGameFeel.IsChecked    = allEnabled || s.EnabledCategories.Contains("game_feel");
            CatCarResponse.IsChecked = allEnabled || s.EnabledCategories.Contains("car_response");
            CatRacingExp.IsChecked   = allEnabled || s.EnabledCategories.Contains("racing_experience");

            TopicsPathBox.Text = s.TopicsFilePath ?? "";
        }

        private void IntervalSlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_loading) return;
            _plugin.Settings.MinSuggestionIntervalMinutes = IntervalSlider.Value;
            IntervalLabel.Text = $"{IntervalSlider.Value:0.0} min";
            SaveAndApply();
        }

        private void DisplaySlider_ValueChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
        {
            if (_loading) return;
            _plugin.Settings.PromptDisplaySeconds = DisplaySlider.Value;
            DisplayLabel.Text = $"{DisplaySlider.Value:0} s";
            SaveAndApply();
        }

        private void ShowTitleCheck_Changed(object sender, RoutedEventArgs e)
        {
            if (_loading) return;
            _plugin.Settings.ShowTopicTitle = ShowTitleCheck.IsChecked == true;
            SaveAndApply();
        }

        private void Category_Changed(object sender, RoutedEventArgs e)
        {
            if (_loading) return;
            var cats = new List<string>();
            if (CatHardware.IsChecked    == true) cats.Add("hardware");
            if (CatGameFeel.IsChecked    == true) cats.Add("game_feel");
            if (CatCarResponse.IsChecked == true) cats.Add("car_response");
            if (CatRacingExp.IsChecked   == true) cats.Add("racing_experience");

            // If all 4 are checked, clear the list (= all enabled)
            _plugin.Settings.EnabledCategories = cats.Count == 4 ? new List<string>() : cats;
            SaveAndApply();
        }

        private void TopicsPathBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (_loading) return;
            _plugin.Settings.TopicsFilePath = TopicsPathBox.Text.Trim();
            SaveAndApply();
        }

        private void BrowseTopics_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new OpenFileDialog
            {
                Filter = "JSON Files (*.json)|*.json|All Files (*.*)|*.*",
                Title  = "Select commentary_topics.json"
            };
            if (dlg.ShowDialog() == true)
            {
                TopicsPathBox.Text = dlg.FileName;
                _plugin.Settings.TopicsFilePath = dlg.FileName;
                SaveAndApply();
            }
        }

        private void SaveAndApply()
        {
            _plugin.PluginManager?.SetPropertyValue(
                "MediaCoach.Plugin.SettingIntervalMinutes",
                typeof(Plugin),
                _plugin.Settings.MinSuggestionIntervalMinutes);
        }
    }
}
