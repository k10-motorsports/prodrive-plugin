/**
 * Test helpers for K10 Media Broadcaster dashboard tests.
 *
 * Provides mock telemetry data and a page-setup utility that loads
 * dashboard.html with fetch() intercepted so no real HTTP server is needed.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');

export const DASHBOARD_PATHS = {
  original: `file://${path.resolve(APP_DIR, 'dashboard.html')}`,
  build: `file://${path.resolve(APP_DIR, 'dashboard-build.html')}`,
  react: `file://${path.resolve(APP_DIR, 'dashboard-react.html')}`,
};

/** @deprecated Use DASHBOARD_PATHS.original */
export const DASHBOARD_PATH = DASHBOARD_PATHS.original;

/** Realistic mid-race telemetry snapshot */
export const MOCK_TELEMETRY = {
  'DataCorePlugin.GameRunning': 1,
  'K10MediaBroadcaster.Plugin.DemoMode': 0,
  'DataCorePlugin.GameData.Gear': '4',
  'DataCorePlugin.GameData.Rpms': 6842,
  'DataCorePlugin.GameData.CarSettings_MaxRPM': 8500,
  'DataCorePlugin.GameData.SpeedMph': 127,
  'DataCorePlugin.GameData.Throttle': 0.82,
  'DataCorePlugin.GameData.Brake': 0.0,
  'DataCorePlugin.GameData.Clutch': 0.0,
  'DataCorePlugin.GameData.Fuel': 28.4,
  'DataCorePlugin.GameData.MaxFuel': 60.0,
  'DataCorePlugin.Computed.Fuel_LitersPerLap': 3.12,
  'DataCorePlugin.GameData.RemainingLaps': 14,
  'DataCorePlugin.GameData.TyreTempFrontLeft': 196,
  'DataCorePlugin.GameData.TyreTempFrontRight': 203,
  'DataCorePlugin.GameData.TyreTempRearLeft': 188,
  'DataCorePlugin.GameData.TyreTempRearRight': 191,
  'DataCorePlugin.GameData.TyreWearFrontLeft': 0.91,
  'DataCorePlugin.GameData.TyreWearFrontRight': 0.88,
  'DataCorePlugin.GameData.TyreWearRearLeft': 0.94,
  'DataCorePlugin.GameData.TyreWearRearRight': 0.93,
  'DataCorePlugin.GameRawData.Telemetry.dcBrakeBias': 56.2,
  'DataCorePlugin.GameRawData.Telemetry.dcTractionControl': 4,
  'DataCorePlugin.GameRawData.Telemetry.dcABS': 3,
  'DataCorePlugin.GameData.Position': 5,
  'DataCorePlugin.GameData.CurrentLap': 8,
  'DataCorePlugin.GameData.BestLapTime': 92.347,
  'DataCorePlugin.GameData.CarModel': 'Porsche 911 GT3 R',
  'IRacingExtraProperties.iRacing_DriverInfo_IRating': 2847,
  'IRacingExtraProperties.iRacing_DriverInfo_SafetyRating': 3.41,
  'IRacingExtraProperties.iRacing_Opponent_Ahead_Gap': 1.3,
  'IRacingExtraProperties.iRacing_Opponent_Behind_Gap': 2.1,
  'IRacingExtraProperties.iRacing_Opponent_Ahead_Name': 'M. Broadbent',
  'IRacingExtraProperties.iRacing_Opponent_Behind_Name': 'S. Leclerc',
  'IRacingExtraProperties.iRacing_Opponent_Ahead_IRating': 3210,
  'IRacingExtraProperties.iRacing_Opponent_Behind_IRating': 2530,
  'K10MediaBroadcaster.Plugin.CommentaryVisible': 0,
  'K10MediaBroadcaster.Plugin.CommentaryText': '',
  'K10MediaBroadcaster.Plugin.CommentaryTopicTitle': '',
  'K10MediaBroadcaster.Plugin.CommentaryTopicId': '',
  'K10MediaBroadcaster.Plugin.CommentaryCategory': '',
  'K10MediaBroadcaster.Plugin.CommentarySentimentColor': '',
  'K10MediaBroadcaster.Plugin.CommentarySeverity': 0,
  'K10MediaBroadcaster.Plugin.TrackMap.Ready': 0,
  'K10MediaBroadcaster.Plugin.Grid.SessionState': 4,
  'K10MediaBroadcaster.Plugin.GameId': 'iracing',
  'K10MediaBroadcaster.Plugin.SessionTypeName': 'Race',
  'K10MediaBroadcaster.Plugin.DS.FuelPct': 47.3,
  'K10MediaBroadcaster.Plugin.DS.FuelLapsRemaining': 9.1,
};

/** Demo mode telemetry — uses Demo.* keys instead */
export const MOCK_DEMO = {
  ...MOCK_TELEMETRY,
  'K10MediaBroadcaster.Plugin.DemoMode': 1,
  'K10MediaBroadcaster.Plugin.Demo.Gear': '3',
  'K10MediaBroadcaster.Plugin.Demo.Rpm': 5400,
  'K10MediaBroadcaster.Plugin.Demo.MaxRpm': 7500,
  'K10MediaBroadcaster.Plugin.Demo.SpeedMph': 98,
  'K10MediaBroadcaster.Plugin.Demo.Throttle': 0.65,
  'K10MediaBroadcaster.Plugin.Demo.Brake': 0.12,
  'K10MediaBroadcaster.Plugin.Demo.Clutch': 0.0,
  'K10MediaBroadcaster.Plugin.Demo.Fuel': 18.0,
  'K10MediaBroadcaster.Plugin.Demo.MaxFuel': 60.0,
  'K10MediaBroadcaster.Plugin.Demo.FuelPerLap': 3.5,
  'K10MediaBroadcaster.Plugin.Demo.RemainingLaps': 10,
  'K10MediaBroadcaster.Plugin.Demo.TyreTempFL': 210,
  'K10MediaBroadcaster.Plugin.Demo.TyreTempFR': 215,
  'K10MediaBroadcaster.Plugin.Demo.TyreTempRL': 195,
  'K10MediaBroadcaster.Plugin.Demo.TyreTempRR': 198,
  'K10MediaBroadcaster.Plugin.Demo.TyreWearFL': 0.80,
  'K10MediaBroadcaster.Plugin.Demo.TyreWearFR': 0.75,
  'K10MediaBroadcaster.Plugin.Demo.TyreWearRL': 0.85,
  'K10MediaBroadcaster.Plugin.Demo.TyreWearRR': 0.83,
  'K10MediaBroadcaster.Plugin.Demo.BrakeBias': 54.0,
  'K10MediaBroadcaster.Plugin.Demo.TC': 6,
  'K10MediaBroadcaster.Plugin.Demo.ABS': 2,
  'K10MediaBroadcaster.Plugin.Demo.Position': 3,
  'K10MediaBroadcaster.Plugin.Demo.CurrentLap': 12,
  'K10MediaBroadcaster.Plugin.Demo.BestLapTime': 88.921,
  'K10MediaBroadcaster.Plugin.Demo.CarModel': 'BMW M4 GT3',
  'K10MediaBroadcaster.Plugin.Demo.IRating': 3150,
  'K10MediaBroadcaster.Plugin.Demo.SafetyRating': 3.88,
  'K10MediaBroadcaster.Plugin.Demo.GapAhead': 0.8,
  'K10MediaBroadcaster.Plugin.Demo.GapBehind': 3.5,
  'K10MediaBroadcaster.Plugin.Demo.DriverAhead': 'J. Smith',
  'K10MediaBroadcaster.Plugin.Demo.DriverBehind': 'A. Johnson',
  'K10MediaBroadcaster.Plugin.Demo.IRAhead': 3500,
  'K10MediaBroadcaster.Plugin.Demo.IRBehind': 2100,
  'K10MediaBroadcaster.Plugin.Demo.Grid.SessionState': 4,
};

/**
 * Load the dashboard in a Playwright page with mock fetch.
 * The mock data is served for every fetch() call so the polling loop
 * populates the dashboard without a real HTTP server.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [data] - Override mock telemetry data (merged with MOCK_TELEMETRY)
 * @param {object} [opts] - Options
 * @param {string} [opts.dashboardPath] - Override the dashboard path (default: DASHBOARD_PATH)
 * @returns {Promise<void>}
 */
export async function loadDashboard(page, data, opts = {}) {
  const mockData = data ? { ...MOCK_TELEMETRY, ...data } : MOCK_TELEMETRY;
  const dashPath = opts.dashboardPath || DASHBOARD_PATH;

  // Intercept all fetch requests to the plugin server and serve mock data
  await page.route(/k10mediabroadcaster/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockData),
    });
  });

  await page.goto(dashPath, { waitUntil: 'load' });

  // Inject car logo SVGs — Chromium blocks fetch() on file:// protocol,
  // so loadCarLogos() silently fails. Load them from disk and inject directly.
  // Must happen before polls so setCarLogo() finds the SVG content.
  const logosDir = path.resolve(APP_DIR, 'images', 'logos');
  try {
    const logoFiles = fs.readdirSync(logosDir).filter(f => f.endsWith('.svg'));
    const logoMap = {};
    for (const f of logoFiles) {
      logoMap[f.replace('.svg', '')] = fs.readFileSync(path.resolve(logosDir, f), 'utf-8');
    }
    await page.evaluate((logos) => {
      if (typeof carLogos !== 'undefined') {
        Object.assign(carLogos, logos);
        // Reset last-car tracking so the next poll cycle re-applies the logo
        if (typeof _lastCarModel !== 'undefined') _lastCarModel = null;
        if (typeof _currentCarLogo !== 'undefined') _currentCarLogo = '';
      }
    }, logoMap);
  } catch {
    // logos dir may not exist for all dashboard variants — that's fine
  }

  // Wait for at least 2 poll cycles to populate data
  await page.waitForTimeout(200);
}

/**
 * Update mock data mid-test by re-routing fetch.
 */
export async function updateMockData(page, data) {
  await page.unroute(/k10mediabroadcaster/);
  await page.route(/k10mediabroadcaster/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...MOCK_TELEMETRY, ...data }),
    });
  });
  // Wait for a poll cycle
  await page.waitForTimeout(100);
}
