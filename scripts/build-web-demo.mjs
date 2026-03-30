#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// build-web-demo.mjs — Generate a self-contained dashboard demo page
// for embedding in the marketing site via iframe + postMessage.
//
// Usage:  node scripts/build-web-demo.mjs
// Output: racecor-web/public/_demo/dashboard-embed.html
//
// The generated page:
//   • Contains the main HUD panels (tacho, pedals, fuel, tyres,
//     position/gaps, track maps) with all real CSS and JS inlined
//   • Receives telemetry snapshots via window.postMessage instead
//     of polling SimHub's HTTP API
//   • Runs the real poll-engine.js update loop — no reimplementation
//   • Supports an ambient-light mock controlled via postMessage
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OVERLAY = join(ROOT, 'racecor-overlay');
const OUT_DIR = join(ROOT, 'racecor-web', 'public', '_demo');

// ── Helpers ──────────────────────────────────────────────────────

function read(rel) {
  return readFileSync(join(OVERLAY, rel), 'utf-8');
}

// ── CSS files (order matches dashboard.html) ─────────────────────

const CSS_FILES = [
  'modules/styles/base.css',
  'modules/styles/dashboard.css',
  'modules/styles/leaderboard.css',
  'modules/styles/connections.css',
  'modules/styles/datastream.css',
  'modules/styles/pitbox.css',
  'modules/styles/settings.css',
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

  // ── Extract secondary panels and overlays ──
  // These are outside the main #dashboard div but needed for
  // the FeatureShowcase to isolate and display them.
  const extraComponents = [
    // Commentary overlay
    { start: '<!-- COMMENTARY', end: '</div>\n\n<!-- COMPONENT: Connection' },
    // Secondary panels container (leaderboard, datastream, pitbox)
    { start: '<!-- SECONDARY PANELS CONTAINER', end: '</div><!-- /sec-container -->' },
    // Incidents panel
    { start: '<!-- COMPONENT: Incidents Panel', end: /(<\/div>\s*\n\s*\n\s*<!-- COMPONENT: Race Control)/ },
    // Race Control banner
    { start: '<!-- COMPONENT: Race Control Banner', end: /(<\/div>\s*\n\s*\n\s*<!-- COMPONENT: Idle)/ },
    // Pit Limiter banner
    { start: '<!-- COMPONENT: Pit Limiter Banner', end: /(<\/div>\s*\n\s*\n\s*<!-- COMPONENT: Race End)/ },
    // Race End screen
    { start: '<!-- COMPONENT: Race End Screen', end: /(<\/div>\s*\n\s*\n\s*<!-- COMPONENT: Spotter)/ },
    // Spotter panel
    { start: '<!-- COMPONENT: Spotter Panel', end: /(<\/div>\s*\n\s*\n\s*<!-- COMPONENT: Grid)/ },
    // Grid / Formation module
    { start: '<!-- COMPONENT: Grid Module', end: /(<\/div>\s*\n\s*\n\s*<!-- COMPONENT: Driver)/ },
  ];

  // Simpler approach: extract each COMPONENT block by finding its comment marker
  // and the next COMPONENT marker (or end of body)
  const componentBlocks = [];
  const componentIds = [
    'commentaryCol', 'secContainer', 'incidentsPanel', 'rcBanner',
    'pitBanner', 'raceEndScreen', 'spotterPanel', 'gridModule',
  ];
  for (const id of componentIds) {
    // Find the element by its id attribute
    const idPattern = `id="${id}"`;
    const idx = full.indexOf(idPattern);
    if (idx === -1) {
      console.warn(`  Warning: Could not find #${id} in dashboard.html`);
      continue;
    }
    // Walk backward to find the opening <!-- COMPONENT or <div
    let blockStart = full.lastIndexOf('<!--', idx);
    const divStart = full.lastIndexOf('<div', idx);
    // Use whichever is closer (comment or div tag)
    if (divStart > blockStart) blockStart = divStart;

    // Walk forward to find the closing — we need to count div nesting
    let depth = 0;
    let pos = blockStart;
    let blockEnd = -1;
    while (pos < full.length) {
      const nextOpen = full.indexOf('<div', pos);
      const nextClose = full.indexOf('</div>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth <= 0) {
          blockEnd = nextClose + '</div>'.length;
          break;
        }
        pos = nextClose + 6;
      }
    }
    if (blockEnd === -1) {
      console.warn(`  Warning: Could not find closing tag for #${id}`);
      continue;
    }
    // Include any preceding comment
    const commentIdx = full.lastIndexOf('<!--', blockStart);
    if (commentIdx !== -1 && blockStart - commentIdx < 200) {
      const between = full.slice(commentIdx, blockStart).trim();
      if (between.startsWith('<!-- COMPONENT') || between.startsWith('<!-- COMMENTARY') || between.startsWith('<!-- SECONDARY')) {
        blockStart = commentIdx;
      }
    }
    componentBlocks.push(full.slice(blockStart, blockEnd));
  }

  const secondaryHTML = componentBlocks.join('\n\n');

  return { canvases, dashboardHTML, secondaryHTML };
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

  // Module isolation map — CSS class for each named module
  // 'type' distinguishes main-grid columns from secondary/overlay panels
  var _moduleMap = {
    'tacho':        { sel: '.tacho-block',           type: 'main' },
    'pedals':       { sel: '.controls-pedals-block',  type: 'main' },
    'fuel':         { sel: '.fuel-tyres-col',         type: 'main' },
    'maps':         { sel: '.maps-col',               type: 'main' },
    'position':     { sel: '.pos-gaps-col',           type: 'main' },
    'logo':         { sel: '.logo-col',               type: 'main' },
    'timer':        { sel: '.timer-row',              type: 'main' },
    'leaderboard':  { sel: '.leaderboard-panel',      type: 'secondary' },
    'datastream':   { sel: '.datastream-panel',       type: 'secondary' },
    'pitbox':       { sel: '.pitbox-panel',           type: 'secondary' },
    'incidents':    { sel: '.incidents-panel',         type: 'secondary' },
    'commentary':   { sel: '.commentary-col',         type: 'overlay' },
    'spotter':      { sel: '.spotter-panel',          type: 'overlay' },
    'pit-limiter':  { sel: '.pit-banner',             type: 'overlay' },
    'race-control': { sel: '.rc-banner',              type: 'overlay' },
    'formation':    { sel: '.grid-module',            type: 'overlay' },
    'race-end':     { sel: '.race-end-screen',        type: 'overlay' }
  };
  var _isolateStyle = null;

  // All main-grid selectors for bulk hide/show
  var _mainSels = Object.keys(_moduleMap).filter(function(k) { return _moduleMap[k].type === 'main'; }).map(function(k) { return _moduleMap[k].sel; });
  // All secondary + overlay selectors
  var _secSels = Object.keys(_moduleMap).filter(function(k) { return _moduleMap[k].type !== 'main'; }).map(function(k) { return _moduleMap[k].sel; });

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'k10-telemetry') {
      _pmData = e.data.snapshot;
    }
    if (e.data.type === 'k10-ambient') {
      _pmAmbient = e.data;
    }
    if (e.data.type === 'k10-isolate') {
      // Show only the specified module, hide everything else
      if (_isolateStyle) _isolateStyle.remove();
      var mod = e.data.module;
      if (!mod || mod === 'all') return; // 'all' = restore full dashboard
      var entry = _moduleMap[mod];
      if (!entry) return;

      var css = '';
      if (entry.type === 'main') {
        // Hide all main columns, show only target; hide all secondary/overlays
        css += _mainSels.join(',\\n') + ' { display: none !important; }\\n';
        css += _secSels.join(',\\n') + ' { display: none !important; }\\n';
        css += entry.sel + ' { display: flex !important; visibility: visible !important; opacity: 1 !important; }\\n';
        css += '.main-area { justify-content: center !important; }\\n';
        css += '.timer-row { display: ' + (mod === 'timer' ? 'flex' : 'none') + ' !important; }\\n';
      } else {
        // Hide main dashboard entirely; hide all secondary/overlays; show target
        css += '.dashboard { display: none !important; }\\n';
        css += _secSels.join(',\\n') + ' { display: none !important; }\\n';
        // Show the target panel — override position so it centers in the iframe
        css += entry.sel + ' {\\n';
        css += '  display: flex !important;\\n';
        css += '  visibility: visible !important;\\n';
        css += '  opacity: 1 !important;\\n';
        css += '  position: relative !important;\\n';
        css += '  inset: auto !important;\\n';
        css += '  margin: 20px auto !important;\\n';
        css += '  z-index: 100 !important;\\n';
        css += '}\\n';
        // For sec-container children, also show the container
        if (entry.type === 'secondary') {
          css += '.sec-container {\\n';
          css += '  display: flex !important;\\n';
          css += '  position: relative !important;\\n';
          css += '  inset: auto !important;\\n';
          css += '  justify-content: center !important;\\n';
          css += '  margin: 20px auto !important;\\n';
          css += '}\\n';
          // Hide sibling secondary panels
          css += '.sec-container > * { display: none !important; }\\n';
          css += '.sec-container > ' + entry.sel + ' { display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; inset: auto !important; }\\n';
        }
      }

      _isolateStyle = document.createElement('style');
      _isolateStyle.textContent = css;
      document.head.appendChild(_isolateStyle);
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
  background: #0a0a14 !important;
  overflow: hidden;
  /* Ensure dashboard fonts apply even if Google Fonts loads slowly */
  font-family: 'Barlow Condensed', 'Barlow Semi Condensed', system-ui, sans-serif;
}

/* Hide non-essential elements that may get created by JS */
.conn-status,
.conn-banner,
.settings-overlay,
.drive-hud,
#connBanner,
#connStatus,
#gameLogoOverlay {
  display: none !important;
}

/* Secondary panels & overlays — hidden by default, shown via isolation */
.sec-container,
.commentary-col,
.leaderboard-panel,
.datastream-panel,
.pitbox-panel,
.incidents-panel,
.spotter-panel,
.pit-banner,
.rc-banner,
.race-end-screen,
.grid-module {
  display: none !important;
  position: relative !important;
  inset: auto !important;
  margin: 0 auto !important;
}

/* Dashboard: relative position, shrink to content width */
.dashboard {
  position: relative !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  margin: 0 auto !important;
  padding: 0 !important;
  width: fit-content !important;
}
/* Kill the edge inset variable — we want zero margins in the embed */
:root { --edge: 0px !important; --edge-z: 0px !important; }

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

/* Timer row defaults to max-height:0 — force it open */
.timer-row {
  max-height: 80px !important;
  overflow: visible !important;
  padding: 0 !important;
}
.race-timer-block {
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

/* WebGL canvases — fill the iframe viewport, behind the dashboard */
.ambient-canvas,
#glareCanvas {
  position: fixed !important;
  inset: 0;
  width: 100vw !important;
  height: 100vh !important;
}

/* ── Responsive breakpoints ──
   Hide panels when viewport can no longer fit them.
   Cumulative widths (incl. 4px gaps):
     All 6:  904px
     −logo:  802px
     −maps:  702px
     −fuel:  538px
     −peds:  294px                                               */

/* ≤ 903px — drop logo (remaining ≈ 802px) */
@media (max-width: 903px) {
  .logo-col { display: none !important; }
}

/* ≤ 801px — drop maps (remaining ≈ 702px) */
@media (max-width: 801px) {
  .maps-col { display: none !important; }
}

/* ≤ 701px — drop fuel & tyres (remaining ≈ 538px) */
@media (max-width: 701px) {
  .fuel-tyres-col { display: none !important; }
}

/* ≤ 537px — drop pedals/controls (remaining ≈ 294px) */
@media (max-width: 537px) {
  .controls-pedals-block { display: none !important; }
}

/* ≤ 293px — drop position, tacho only */
@media (max-width: 293px) {
  .pos-gaps-col { display: none !important; }
}
`;

// ── Build ────────────────────────────────────────────────────────

function build() {
  const { canvases, dashboardHTML, secondaryHTML } = extractDashboardHTML();

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

${secondaryHTML}

<script>
${allJS}
</script>


</body>
</html>`;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'dashboard-embed.html'), html, 'utf-8');

  // Copy images directory so relative paths (images/branding/, images/logos/) resolve
  const imgSrc = join(OVERLAY, 'images');
  const imgDest = join(OUT_DIR, 'images');
  if (existsSync(imgSrc)) {
    execSync(`rm -rf "${imgDest}" && cp -r "${imgSrc}" "${imgDest}"`);
    console.log(`✓ Copied images/ to racecor-web/public/_demo/images/`);
  }

  const sizeKB = Math.round(html.length / 1024);
  console.log(`✓ Built racecor-web/public/_demo/dashboard-embed.html (${sizeKB} KB)`);
}

build();
