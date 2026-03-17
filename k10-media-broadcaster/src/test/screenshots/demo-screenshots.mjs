/**
 * Demo Screenshot Capture — captures the React dashboard at key moments
 * throughout the 195-second demo sequence for visual validation.
 *
 * Usage:
 *   1. Start the dev server:  npm run dev -- --port 8765
 *   2. Run this script:       node test/screenshots/demo-screenshots.mjs
 *
 * Screenshots are saved to test/screenshots/output/
 *
 * Demo sequence timeline (seconds):
 *   0–30    Idle         gameRunning=false — K10 logo at 50%
 *  30–35    Get In Car   gameRunning=true, sessionState=1
 *  35–42    Warmup       sessionState=2, car on track, pit limiter
 *  42–55    Parade Laps  sessionState=3, pace car, Yellow flag
 *  55–58    Lights       lightsPhase 1→5 (red lights)
 *  58       Green!       lightsPhase=6, flagState=Green
 *  58–160   Racing       sessionState=4, dynamic telemetry
 * 160–165   White flag   flagState=White (last lap)
 * 165       Checkered    flagState=Checkered, sessionState=5
 * 165–195   Cooldown     Race end screen visible
 * 195       Loop         Restart from idle
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, 'output');

const DEV_SERVER_URL = process.env.DEV_URL || 'http://localhost:8765/';
const VIEWPORT = { width: 1920, height: 1080 };

// Time after page load for demo to start (connection timeout + buffer)
const DEMO_START_DELAY_MS = 7000;

/**
 * Phases to capture. Each has:
 *   name     - Filename-safe identifier
 *   targetMs - Target time in the demo sequence (seconds from demo start)
 *   desc     - Human-readable description
 */
const PHASES = [
  { name: '01-idle',          targetMs: 3000,   desc: 'Idle state (no game running)' },
  { name: '02-get-in-car',    targetMs: 32000,  desc: 'Get in car (gameRunning, sessionState=1)' },
  { name: '03-warmup',        targetMs: 38000,  desc: 'Warmup lap (pit limiter on)' },
  { name: '04-parade-yellow',  targetMs: 48000,  desc: 'Parade laps (Yellow flag, pace car)' },
  { name: '05-start-lights',  targetMs: 56500,  desc: 'Start lights (red lights sequence)' },
  { name: '06-green-flag',    targetMs: 59000,  desc: 'Green flag (race start)' },
  { name: '07-racing-early',  targetMs: 75000,  desc: 'Racing (early, ~17s in, commentary)' },
  { name: '08-racing-mid',    targetMs: 105000, desc: 'Racing (mid-race, position changes)' },
  { name: '09-racing-late',   targetMs: 145000, desc: 'Racing (late, worn tyres, low fuel)' },
  { name: '10-white-flag',    targetMs: 162000, desc: 'White flag (last lap)' },
  { name: '11-checkered',     targetMs: 168000, desc: 'Checkered flag (race finish)' },
  { name: '12-race-end',      targetMs: 180000, desc: 'Race end screen (cooldown)' },
];

/**
 * Quick mode: capture only a few key states for fast validation.
 * Full mode: capture all phases (takes ~3 minutes).
 */
const QUICK_MODE = process.argv.includes('--quick');
const QUICK_PHASES = ['01-idle', '04-parade-yellow', '07-racing-early', '12-race-end'];

async function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const phases = QUICK_MODE
    ? PHASES.filter(p => QUICK_PHASES.includes(p.name))
    : PHASES;

  console.log(`Capturing ${phases.length} phases (${QUICK_MODE ? 'quick' : 'full'} mode)`);
  console.log(`Dev server: ${DEV_SERVER_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Navigate and wait for initial render
  await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle' });

  // Hide settings overlay if open
  await page.evaluate(() => {
    const overlay = document.querySelector('[role="dialog"]');
    if (overlay) overlay.style.display = 'none';
  });

  // Wait for demo mode to kick in (5s connection timeout + buffer)
  console.log('Waiting for demo mode to start...');
  await page.waitForTimeout(DEMO_START_DELAY_MS);

  const demoStartTime = Date.now();

  for (const phase of phases) {
    const elapsed = Date.now() - demoStartTime;
    const toWait = Math.max(0, phase.targetMs - elapsed);

    if (toWait > 0) {
      const secs = (toWait / 1000).toFixed(1);
      process.stdout.write(`  Waiting ${secs}s for ${phase.name}...`);
      await page.waitForTimeout(toWait);
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
    }

    const path = `${OUTPUT_DIR}/react-${phase.name}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`  ✓ ${phase.name.padEnd(20)} ${phase.desc}`);
  }

  // Capture settings panel tabs
  console.log('\nCapturing settings panel...');
  await page.evaluate(() => {
    const overlay = document.querySelector('[role="dialog"]');
    if (overlay) overlay.style.display = '';
  });
  await page.keyboard.press('Control+Shift+KeyS');
  await page.waitForTimeout(500);

  const settingsTabs = ['Sections', 'Layout', 'Connections', 'Keys', 'System'];
  for (const tab of settingsTabs) {
    await page.click(`button:has-text("${tab}")`);
    await page.waitForTimeout(200);
    const path = `${OUTPUT_DIR}/react-settings-${tab.toLowerCase()}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`  ✓ settings-${tab.toLowerCase().padEnd(15)} Settings > ${tab}`);
  }

  await browser.close();
  console.log(`\nDone! ${phases.length + settingsTabs.length} screenshots saved to ${OUTPUT_DIR}`);
}

run().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
