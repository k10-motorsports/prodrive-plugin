#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// build-web-demo.mjs — Generate a self-contained dashboard demo page
// for embedding in the marketing site via iframe + postMessage.
//
// Usage:  node scripts/build-web-demo.mjs
// Output: web/public/_demo/dashboard-embed.html
//
// The generated page:
//   • Contains the main HUD panels (tacho, pedals, fuel, tyres,
//     position/gaps, track maps) with all real CSS and JS inlined
//   • Receives telemetry snapshots via window.postMessage instead
//     of polling SimHub's HTTP API
//   • Runs the real poll-engine.js update loop — no reimplementation
//   • Supports an ambient-light mock controlled via postMessage
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OVERLAY = join(ROOT, 'dashboard-overlay');
const OUT_DIR = join(ROOT, 'web', 'public', '_demo');

// ── Helpers ──────────────────────────────────────────────────────

function read(rel) {
  return readFileSync(join(OVERLAY, rel), 'utf-8');
}

// ── CSS files (order matches dashboard.html) ─────────────────────

const CSS_FILES = [
  'modules/styles/base.css',
  'modules/styles/dashboard.css',
  'modules/styles/effects.css',
  'modules/styles/ambient.css',
];

// ── JS files (order matches dashboard.html <script> tags) ────────
// We include ALL of them — modules that can't find their DOM elements
// gracefully skip via `if (el)` guards. This is safer than trying to
// figure out every cross-module dependency.

const JS_FILES = [
  'modules/js/config.js',
  'modules/js/keyboard.js',
  'modules/js/car-logos.js',
  'modules/js/game-detect.js',
  // ── postMessage shim injected here (see SHIM below) ──
  'modules/js/webgl-helpers.js',
  'modules/js/pedal-curves.js',
  'modules/js/settings.js',
  'modules/js/qr-code.js',
  'modules/js/connections.js',
  'modules/js/leaderboard.js',
  'modules/js/datastream.js',
  'modules/js/pitbox.js',
  'modules/js/race-control.js',
  'modules/js/race-timeline.js',
  'modules/js/incidents.js',
  'modules/js/pit-limiter.js',
  'modules/js/race-end.js',
  'modules/js/formation.js',
  'modules/js/spotter.js',
  'modules/js/fps.js',
  'modules/js/webgl.js',
  'modules/js/ambient-light.js',
  'modules/js/ambient-capture.js',
  'modules/js/commentary-viz.js',
  'modules/js/game-logo.js',
  'modules/js/rating-editor.js',
  'modules/js/driver-profile.js',
  'modules/js/drive-hud.js',
  'modules/js/poll-engine.js',
];

// ── Extract main dashboard HTML from dashboard.html ──────────────
// We want: the main <div class="dashboard"> (id="dashboard") which
// contains tacho, pedals, fuel/tyres, position/gaps, maps, logo, timer.
// Lines 128–388 in the source.

function extractDashboardHTML() {
  const full = read('dashboard.html');

  // Extract the main dashboard div and its children
  const startMarker = '<!-- COMPONENT: Main Dashboard -->';
  const endMarker = '</div><!-- /dashboard -->';

  let startIdx = full.indexOf(startMarker);
  let endIdx = full.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    // Fallback: find by id
    startIdx = full.indexOf('<div class="dashboard');
    endIdx = full.indexOf('</div><!-- /dashboard');
  }

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not find main dashboard HTML markers in dashboard.html');
  }

  const dashboardHTML = full.slice(startIdx, endIdx + endMarker.length);

  // Also grab the ambient/glare canvases (needed for WebGL effects)
  const canvases = [
    '<canvas class="ambient-canvas" id="ambientGlCanvas"></canvas>',
    '<canvas id="glareCanvas" style="position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60;"></canvas>',
  ].join('\n');

  return { canvases, dashboardHTML };
}

// ── The postMessage shim ─────────────────────────────────────────
// Injected AFTER game-detect.js. Overrides fetchProps() so that the
// real poll-engine.js receives data from the parent page's postMessage
// instead of making XHR requests to SimHub.

const SHIM = `
// ─── K10 Web Demo: postMessage data bridge ───────────────────
// Replaces the real fetchProps() (defined in game-detect.js) with
// one that returns data sent by the parent React page.
(function() {
  var _pmData = null;
  var _pmAmbient = null;

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'k10-telemetry') {
      _pmData = e.data.snapshot;
    }
    if (e.data.type === 'k10-ambient') {
      _pmAmbient = e.data;
    }
  });

  // Override fetchProps — poll-engine.js calls this every 33ms
  fetchProps = async function() {
    return _pmData;
  };

  // Override connection status — suppress the connection banner
  _updateConnStatus = function() {};
  _hasEverConnected = true;

  // Ambient light mock — update globals each frame
  var _ambientRAF = null;
  function tickAmbient() {
    if (_pmAmbient) {
      window._ambientGL = {
        r: _pmAmbient.r || 0,
        g: _pmAmbient.g || 0,
        b: _pmAmbient.b || 0,
        lum: _pmAmbient.lum || 0
      };
      window._ambientModeInt = _pmAmbient.mode != null ? _pmAmbient.mode : 0;
    }
    _ambientRAF = requestAnimationFrame(tickAmbient);
  }
  tickAmbient();
})();
// ─── End postMessage shim ────────────────────────────────────
`;

// ── Demo-specific CSS overrides ──────────────────────────────────

const DEMO_CSS = `
/* ── Web demo overrides ── */
html, body {
  margin: 0; padding: 0;
  background: transparent !important;
  overflow: hidden;
  width: 100vw; height: 100vh;
}

/* Hide non-essential elements that may get created by JS */
.conn-status,
.conn-banner,
.sec-container,
.commentary-col,
.settings-overlay,
.drive-hud,
#connBanner,
#connStatus,
#secContainer {
  display: none !important;
}

/* Center the main dashboard in the iframe viewport */
.dashboard {
  position: absolute;
  /* Let the parent iframe control scaling via CSS transforms */
  transform-origin: top left;
}

/* Ensure panels are visible (some toggled via settings) */
.tacho-block,
.fuel-tyres-col,
.controls-pedals-block,
.maps-col,
.pos-gaps-col,
.logo-col,
.timer-row {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Suppress Electron-specific hover states and click targets */
.settings-toggle,
.settings-overlay {
  pointer-events: none !important;
}

/* Kill any startup/splash animations that expect Electron IPC */
.startup-overlay,
.logo-splash {
  display: none !important;
}
`;

// ── Build ────────────────────────────────────────────────────────

function build() {
  const { canvases, dashboardHTML } = extractDashboardHTML();

  // Inline all CSS
  const allCSS = CSS_FILES.map(f => {
    try { return `/* ── ${f} ── */\n${read(f)}`; }
    catch { console.warn(`  Warning: ${f} not found, skipping`); return ''; }
  }).join('\n\n');

  // Inline all JS (with shim after game-detect.js)
  const allJS = JS_FILES.map(f => {
    const src = (() => {
      try { return read(f); }
      catch { console.warn(`  Warning: ${f} not found, skipping`); return ''; }
    })();

    let block = `// ── ${f} ──\n${src}`;

    // Inject shim right after game-detect.js
    if (f === 'modules/js/game-detect.js') {
      block += '\n' + SHIM;
    }

    return block;
  }).join('\n\n');

  // Assemble the output HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>K10 Motorsports — Dashboard Demo</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&family=Barlow+Semi+Condensed:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap">
<style>
${allCSS}
</style>
<style>
${DEMO_CSS}
</style>
</head>
<body class="game-iracing">

${canvases}

${dashboardHTML}

<script>
// ── Pre-init: stub globals that scripts expect ──
var _discordUser = null;
var _currentGameId = 'iracing';
var _isIRacing = true;
var _isRally = false;
var _rallyModeEnabled = false;
</script>

<script>
${allJS}
</script>

</body>
</html>`;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'dashboard-embed.html'), html, 'utf-8');

  const sizeKB = Math.round(html.length / 1024);
  console.log(`✓ Built web/public/_demo/dashboard-embed.html (${sizeKB} KB)`);
}

build();
