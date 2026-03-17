# K10 Media Broadcaster — Dashboard Architecture MCP

## Quick Reference

**Production dashboard**: `K10 Media Broadcaster/dashboard.html` (assembly file, ~530 lines)
**CSS modules**: `modules/styles/*.css` (8 files)
**JS modules**: `modules/js/*.js` (20 files, ~6600 lines total)
**Tests**: `tests/*.spec.mjs` (Playwright)
**Test helpers**: `tests/helpers.mjs`
**Electron main**: `main.js` (IPC handlers, window management, Discord OAuth)
**Electron preload**: `preload.js` (IPC bridge -> `window.k10`)

No bundler. All modules load via `<link>` and `<script src>` tags in dashboard.html. Everything runs in Electron's `file://` protocol with **global scope** (duplicate `let`/`const` declarations crash modules).

---

## Architecture

### File Layout

```
K10 Media Broadcaster/
+-- dashboard.html          <- Assembly file: HTML structure + module includes
+-- main.js                 <- Electron main process
+-- preload.js              <- IPC bridge (window.k10)
+-- modules/
|   +-- styles/
|   |   +-- base.css        <- CSS variables, reset, fonts, shared utilities
|   |   +-- dashboard.css   <- Main HUD layout (grid, panels, tachometer, pedals)
|   |   +-- leaderboard.css <- Leaderboard panel positioning & styling
|   |   +-- datastream.css  <- Telemetry datastream panel
|   |   +-- effects.css     <- Animations, flag effects, flash transitions, grid module, spotter, pit limiter
|   |   +-- settings.css    <- Settings overlay, toggles, layout controls
|   |   +-- connections.css <- Discord/SimHub connection cards
|   |   +-- rally.css       <- Rally mode overrides (.game-rally, .rally-only, .circuit-only)
|   +-- js/
|       +-- config.js       <- (330 lines) Constants, globals, SIMHUB_URL, PROP_KEYS, _settings, _mfrMap, utility functions
|       +-- keyboard.js     <- (10 lines) Keyboard shortcuts (Ctrl+Shift+S, etc.)
|       +-- car-logos.js    <- (69 lines) SVG logo paths by manufacturer key
|       +-- game-detect.js  <- (220 lines) Game ID detection, features map, conn status, fetchProps()
|       +-- webgl-helpers.js<- (634 lines) Shader compilation, buffer setup utilities
|       +-- settings.js     <- (114 lines) Settings UI, toggles, layout, zoom, persistence
|       +-- connections.js  <- (555 lines) Discord OAuth, SimHub cards, rally toggle sync, loadSettings/saveSettings
|       +-- leaderboard.js  <- (149 lines) Leaderboard rendering & update logic
|       +-- datastream.js   <- (287 lines) Telemetry stream panel rendering
|       +-- race-control.js <- (58 lines) Race control messages, flag display
|       +-- race-timeline.js<- (173 lines) Race progress timeline bar
|       +-- incidents.js    <- (73 lines) Incident counter & alerts
|       +-- pit-limiter.js  <- (131 lines) Pit limiter overlay with bonkers spark effects
|       +-- race-end.js     <- (120 lines) Race end screen
|       +-- formation.js    <- (206 lines) Grid/formation lap overlay controller
|       +-- spotter.js      <- (195 lines) Proximity spotter + in-car adjustment announcements
|       +-- commentary-viz.js <- (844 lines) Commentary visualization engine (line, gauge, bar, delta, quad, counter, grid, incident renderers)
|       +-- fps.js          <- (19 lines) Frame rate counter
|       +-- webgl.js        <- (1739 lines) WebGL2 shader programs (pedal glow, flag anim, tacho FX, lb effects, spotter glow, bonkers fire, commentary trail, grid border)
|       +-- poll-engine.js  <- (632 lines) Main orchestrator: polling loop, game detection, applyGameMode(), session-aware gaps
+-- tests/
    +-- helpers.mjs         <- MOCK_TELEMETRY, MOCK_DEMO, loadDashboard(), updateMockData()
    +-- discord-oauth.spec.mjs <- PKCE OAuth unit + integration tests
    +-- dashboard.spec.mjs  <- Dashboard rendering tests (if exists)
```

### Load Order (Critical)

JS modules must load in this exact order (dependency chain):

1. `config.js` -- defines all globals, constants, `_settings`, `_mfrMap`, `_isNonRaceSession()`, `_fmtLapTime()`
2. `keyboard.js` -- keyboard event listeners
3. `car-logos.js` -- populates `_logoSVGs` map
4. `game-detect.js` -- `detectGameId()`, `isGameAllowed()`, `isRallyGame()`, `fetchProps()`, `_updateConnStatus()`
5. `webgl-helpers.js` -- shader utils (used by webgl.js)
6. `settings.js` -- `applySettings()`, `_defaultSettings`, layout functions, zoom
7. `connections.js` -- Discord/SimHub, `toggleRallyMode()`, `toggleLayoutRally()`, `loadSettings()`, `saveSettings()`, `initDiscordState()`
8. `leaderboard.js` through `spotter.js` -- panel renderers (independent)
9. `commentary-viz.js` -- commentary visualization engine
10. `fps.js` -- performance counter
11. `webgl.js` -- shader programs (IIFE, registers `window.*` public APIs)
12. `poll-engine.js` -- starts polling loop, calls `applyGameMode()`, main `pollUpdate()`

### Global State Variables (defined in config.js)

```javascript
// Game state
let _currentGameId = '';       // 'iracing', 'acc', 'acevo', 'acrally', 'lmu', 'raceroom', 'eawrc', 'forza'
let _isIRacing = true;         // shorthand for _currentGameId === 'iracing'
let _isRally = false;          // isRallyGame() || _rallyModeEnabled
let _rallyModeEnabled = false; // user toggle
let _discordUser = null;       // Discord user object or null
let _settings = {};            // merged from _defaultSettings + saved
let _connFails = 0;            // connection failure counter for backoff
let _backoffUntil = 0;         // timestamp for exponential backoff
let _pollFrame = 0;            // frame counter

// Driver & car state
let _driverDisplayName = 'YOU';
let _lastCarModel = null;
let _lastDriverAhead = '';
let _lastDriverBehind = '';
let _lastPosition = 0;
let _startPosition = 0;
let _prevBB = -1, _prevTC = -1, _prevABS = -1;
let _clutchSeenActive = false;
let _clutchHidden = false;

// Gaps module (non-race session lap timing)
let _gapsBestLap = 0;
let _gapsLastLap = 0;
let _gapsWorstLap = 0;
let _gapsLapNum = 0;
let _gapsNonRaceMode = false;

// Telemetry history (pedal histograms)
let _thrHist = new Array(20).fill(0);  // throttle 0-1
let _brkHist = new Array(20).fill(0);  // brake 0-1
let _cltHist = new Array(20).fill(0);  // clutch 0-1

// Flag & race control
let _lastFlagState = 'none';
let _flagHoldState = '';
let _flagHoldUntil = 0;
```

### Utility Functions (defined in config.js)

```javascript
// Check if session is practice/qualifying/test/warmup
function _isNonRaceSession(sessionType) { ... }

// Format seconds to m:ss.xxx
function _fmtLapTime(secs) { ... }
```

---

## Module Details

### poll-engine.js (Main Orchestrator, ~632 lines)

The polling loop that drives the entire HUD. Calls `fetchProps()` every `POLL_MS` (33ms) and updates all DOM elements.

**Key sections** (in order within `pollUpdate()`):
1. Game detection & idle state check
2. Position, laps, fuel, tire data
3. Pedal inputs (throttle/brake/clutch) with normalization: `while (val > 1.01) val /= 100`
4. BB/TC/ABS in-car adjustments -- calls `window.announceAdjustment(type, value, direction)`
5. iRating / Safety Rating display
6. **Gaps section** -- session-aware:
   - Non-race: shows Best Lap / Last Lap with delta
   - Race: shows Ahead / Behind gaps with driver names
7. Flag status -- applies flag classes to gaps block
8. Race control messages
9. Spotter update -- `updateSpotter(p, _demo)`
10. Commentary visualization
11. Pit limiter -- `updatePitLimiter(p, _demo)`

**Pedal normalization pattern:**
```javascript
while (thr > 1.01) thr /= 100;  // handles iRacing 10000% range
thr = Math.min(1, Math.max(0, thr));
```

### spotter.js (~195 lines)

Proximity spotter panel + in-car adjustment announcements.

**Race sessions:** Gap-based messages (car ahead, car behind, closing, alongside, position gained/lost)
**All sessions:** Adjustment announcements via `window.announceAdjustment(type, value, direction)`

**Key functions:**
- `updateSpotter(p, isDemo)` -- called from poll-engine, race gap logic only
- `window.announceAdjustment(type, value, direction)` -- BB/TC/ABS changes, shows "Adjustment" header
- `_showSpotterMsg(msg, severity, headerOverride)` -- display helper, auto-fades after 5s
- `_setSpotterHeader(text)` -- updates the `.sp-header` label text
- `_setSpotterIcon(severity)` -- swaps SVG icon in `.sp-icon`

**SVG icons:** `default`, `sp-warn`, `sp-danger`, `sp-clear`, `sp-bb`, `sp-tc`, `sp-abs`, `sp-lap`

**Proximity thresholds (race only):**
- <= 0.8s: "alongside" (danger)
- <= 2.0s: "closing/behind" (warn) or "ahead" (clear)
- <= 4.0s: "reeling in" / "gaining" (only if closing at > 0.03s/tick)

### pit-limiter.js (~131 lines)

Pit lane speed limiter overlay with three states:
1. **NORMAL** -- limiter on, under limit (green "Pit Limiter" label)
2. **WARNING** -- limiter off but under limit ("PIT LIMITER OFF")
3. **BONKERS** -- speed > pit limit regardless of limiter state ("SPEEDING" + spark particles)

**Key condition:** `const isSpeeding = pitLimitKmh > 0 && speedKmh > pitLimitKmh;`

**Spark particle system:** `_startBonkersSparks(container)` / `_stopBonkersSparks(container)` -- spawns 3-5 sparks every 40ms with randomized direction, hue (red-yellow), and lifetime.

### formation.js (~206 lines)

Grid/formation lap overlay controller. Shows pre-race info (grid position, cars gridded, start type, country flag, countdown) and F1-style start lights.

**Key elements:**
- `#gridModule` -- main container (fixed center, z-index 200)
- `#gridFlag` -- country flag banner (fixed at top of screen, separate from info card)
- `#gridCountdown` -- countdown badge (READY/GRID/PACE/FORM) above info card
- `#gridInfo` -- pre-race info card
- `#startLights` -- F1-style start light housing

**WebGL integration:** `window.setGridGL(true/false)` -- activates blue-cyan border glow shader

### webgl.js (~1739 lines)

All WebGL2 shader programs in a single IIFE. Each shader section follows the pattern:
1. `initGL('canvasId')` -- create context
2. Vertex + fragment shader source
3. Compile, link, get uniform locations
4. `window._*FXFrame(dt)` -- per-frame update function
5. `window.set*` -- public API for activation

**Shader programs (10 total):**
1. **tachoFX** -- tachometer rev glow (canvas: `tachoGlCanvas`)
2. **pedalsFX** -- pedal histogram edge glow (canvas: `pedalsGlCanvas`)
   - Throttle: right edge, neon green `vec3(0.20, 1.0, 0.05)`, multipliers 0.9/0.4
   - Brake: left edge, red `vec3(0.92, 0.22, 0.20)`, multipliers 0.35/0.12
   - Clutch: right edge (shared), blue `vec3(0.25, 0.50, 0.92)`, multipliers 0.14/0.04
3. **flagFX** -- flag overlay animation (canvas: `flagGlCanvas`)
4. **lbFX** -- leaderboard effects (canvas: `lbGlCanvas`)
5. **lbEvtFX** -- leaderboard event effects
6. **k10LogoFX** -- K10 logo glow
7. **spotterFX** -- spotter panel edge glow (canvas: `spotterGlCanvas`)
   - Colors: warn=amber, danger=red, clear=green
8. **bonkersFX** -- pit limiter fire effect (canvas: `bonkersGlCanvas`)
9. **commTrailFX** -- commentary trailing glow
10. **gridFlagFX** -- grid module flag-colored energy tendrils (canvas: `gridFlagGlCanvas`)
    - Aurora wisps with fbm noise, flag-colored, escape card bounds
    - Activated during formation lap / pre-race grid

**Master FX loop** (requestAnimationFrame):
```javascript
tachoFX -> pedalsFX -> flagFX -> lbFX -> lbEvtFX -> k10LogoFX -> spotterFX -> bonkersFX -> commTrailFX -> gridFlagFX
```

### incidents.js (~73 lines)

Incident counter module showing count, penalty threshold, and DQ threshold.

**Key elements:** `#incCount`, `#incPen`, `#incDQ`
**Values shown without 'x' suffix:** count as number, penalty/DQ as threshold remaining or "PENALTY"/"DQ"

### commentary-viz.js (~844 lines)

Commentary data visualization engine with multiple renderer types.

**Renderer types:** `line`, `gauge`, `gforce`, `bar`, `delta`, `quad`, `counter`, `grid`, `incident`

**Topic config mapping:** Maps commentary topic strings to visualization configs. Each entry specifies `{ type, label, src }` or just `{ type, label }`.

### config.js (~330+ lines)

Central configuration file. Defines:
- `SIMHUB_URL` -- plugin HTTP endpoint (`http://localhost:8889/k10mediabroadcaster/`)
- `POLL_MS` -- polling interval (33ms ~ 30fps)
- `PROP_KEYS` -- array of telemetry property keys to request
- `DEMO_PROP_KEYS` -- array of demo mode property keys
- `_defaultSettings` -- default settings object
- `_mfrMap` -- manufacturer name mapping for car logos
- All global state variables
- `_isNonRaceSession()` and `_fmtLapTime()` utility functions

**Property key patterns:**
- `DataCorePlugin.GameData.*` -- standard SimHub properties
- `DataCorePlugin.GameRawData.Telemetry.*` -- raw game telemetry
- `IRacingExtraProperties.iRacing_*` -- iRacing-specific
- `K10MediaBroadcaster.Plugin.*` -- custom plugin properties
- `K10MediaBroadcaster.Plugin.Demo.*` -- demo mode equivalents
- `K10MediaBroadcaster.Plugin.DS.*` -- derived/computed values (speed, pit limiter, physics, etc.)
- `K10MediaBroadcaster.Plugin.Demo.DS.*` -- demo derived values
- `K10MediaBroadcaster.Plugin.SessionTypeName` -- session type (Race/Practice/Qualifying/Test)

### Server-Computed DS.* Properties (added to reduce client-side JS overhead)
- `DS.ThrottleNorm` / `DS.BrakeNorm` / `DS.ClutchNorm` -- pedals normalized 0–1
- `DS.RpmRatio` -- RPM/MaxRPM clamped 0–1
- `DS.FuelPct` -- fuel percentage 0–100
- `DS.FuelLapsRemaining` -- estimated laps of fuel left
- `DS.SpeedMph` / `DS.PitSpeedLimitMph` -- km/h to mph conversions
- `DS.IsPitSpeeding` -- bool: in pit lane and over speed limit
- `DS.IsNonRaceSession` -- bool: practice/qualify/test/warmup
- `DS.IsTimedRace` -- bool: session has time remaining counting down
- `DS.IsEndOfRace` -- bool: checkered flag is out
- `DS.PositionDelta` -- positions gained since start (positive = gained)
- `DS.StartPosition` -- grid position captured at race start
- `DS.RemainingTimeFormatted` -- "H:MM:SS" or "M:SS" string
- `DS.SpeedDisplay` -- speed rounded to int string (e.g. "142")
- `DS.RpmDisplay` -- RPM rounded to int string (e.g. "7200")
- `DS.FuelFormatted` -- fuel level to 1dp (e.g. "23.4") or "—"
- `DS.FuelPerLapFormatted` -- fuel/lap to 2dp (e.g. "2.85") or "—"
- `DS.PitSuggestion` -- "PIT in ~5 laps" or empty string
- `DS.BBNorm` -- brake bias 0–1 (maps 30–70% to 0–1)
- `DS.TCNorm` -- traction control 0–1 (0–12 scale)
- `DS.ABSNorm` -- ABS setting 0–1 (0–12 scale)
- `DS.PositionDeltaDisplay` -- "▲ 2" / "▼ 1" / "" display string
- `DS.LapDeltaDisplay` -- "+0.123" / "-0.456" or empty
- `DS.SafetyRatingDisplay` -- "3.24" or "—"
- `DS.GapAheadFormatted` -- "-1.23" or "—"
- `DS.GapBehindFormatted` -- "+1.23" or "—"

---

## Dashboard HTML Structure (key components)

```html
<body>
  <!-- Main HUD grid: position | gaps+flags | tacho | pedals | fuel+tire -->

  <!-- Gaps Block (ahead/behind OR best/last lap) -->
  <div class="panel gaps-block" id="gapsBlock">
    <div class="gap-item">
      <div class="panel-label">Ahead</div>     <!-- or "Best Lap" in non-race -->
      <div class="gap-time ahead">-</div>
      <div class="gap-driver">-</div>
      <div class="gap-ir"></div>
    </div>
    <div class="gap-item">
      <div class="panel-label">Behind</div>    <!-- or "Last Lap" in non-race -->
      <div class="gap-time behind">-</div>
      <div class="gap-driver">-</div>
      <div class="gap-ir"></div>
    </div>
    <canvas class="flag-gl gl-overlay" id="flagGlCanvas"></canvas>
    <div class="flag-overlay" id="flagOverlay">...</div>
  </div>

  <!-- Spotter Panel (stacking messages — new msgs push old ones up/down) -->
  <div class="spotter-panel sp-bottom sp-left" id="spotterPanel">
    <canvas class="sp-gl-canvas" id="spotterGlCanvas"></canvas>
    <div class="sp-stack" id="spotterStack">
      <!-- Cards created dynamically by spotter.js _pushSpotterMsg() -->
      <!-- Each card: .sp-inner > .sp-icon + .sp-content > .sp-header + .sp-message -->
      <!-- Max 3 stacked; oldest fades out when 4th arrives -->
    </div>
  </div>

  <!-- Pit Limiter Banner -->
  <div class="pit-banner" id="pitBanner">
    <div class="pit-inner">
      <span class="pit-label">Pit Limiter</span>
      <span class="pit-speed" id="pitSpeed"></span>
      <span class="pit-limit" id="pitLimit"></span>
    </div>
  </div>

  <!-- Grid Module (formation lap / pre-race) -->
  <div class="grid-module" id="gridModule">
    <div class="grid-flag" id="gridFlag">...</div>   <!-- Country flag at top of screen -->
    <div class="grid-countdown" id="gridCountdown">-</div>
    <div class="grid-info" id="gridInfo">
      <div class="grid-title">Formation Lap</div>
      <div class="grid-cars">...</div>
      <div class="grid-strip" id="gridStrip"></div>
      <div class="grid-start-type" id="gridStartType">Rolling Start</div>
    </div>
    <div class="start-lights" id="startLights">...</div>
  </div>

  <!-- Settings Overlay -->
  <div class="settings-overlay" id="settingsOverlay">...</div>
</body>
```

---

## Patterns & Conventions

### Session-Aware Behavior

The dashboard adapts based on `SessionTypeName`:
- **Race sessions:** Gaps block shows Ahead/Behind with driver names and iRating. Spotter shows proximity warnings.
- **Non-race sessions** (practice/qualifying/test/warmup): Gaps block shows Best Lap / Last Lap with delta from best. Spotter only shows adjustment callouts.

Detection: `_isNonRaceSession(sessionType)` in config.js checks for practice/qualify/test/warmup keywords.

### In-Car Adjustment Flow

```
poll-engine.js detects BB/TC/ABS change
  -> flashCtrlBar('ctrlBB')  (visual flash on control bar)
  -> window.announceAdjustment('bb', value, direction)
    -> spotter.js _showSpotterMsg(label, 'sp-clear', 'Adjustment')
    -> _setSpotterIcon('sp-bb')
    -> header changes to "Adjustment", auto-reverts to "Spotter" after 5s
```

### Pedal Normalization

iRacing can send values up to 10000%. All pedal inputs are normalized:
```javascript
while (thr > 1.01) thr /= 100;
thr = Math.min(1, Math.max(0, thr));
```

### WebGL Public APIs

```javascript
window.setTachoGL(rpm, maxRpm)     // tachometer glow
window.setPedalsGL(thr, brk, clt)  // pedal edge glow
window.setFlagGLColors(colors)     // flag animation colors
window.setSpotterGlow(type)        // 'warn'|'danger'|'clear'|'off'
window.setBonkersGL(active)        // pit limiter fire effect
window.setGridGL(active)           // grid border glow
```

### Demo Mode

When `K10MediaBroadcaster.Plugin.DemoMode` is 1, the dashboard reads from `K10MediaBroadcaster.Plugin.Demo.*` keys. The demo prefix pattern:
- Live: `K10MediaBroadcaster.Plugin.DS.SpeedKmh`
- Demo: `K10MediaBroadcaster.Plugin.Demo.DS.SpeedKmh`

### SimHub Telemetry Flow

```
SimHub -> Plugin.cs (C#) -> TelemetrySnapshot -> HTTP JSON at :8889/k10mediabroadcaster/
  -> fetchProps() (JS) -> pollUpdate() -> update DOM elements
```

### Adding a New Settings Toggle

1. Add default value to `_defaultSettings` in `settings.js`
2. Add HTML toggle with `data-key` and `data-section` attributes
3. `applySettings()` auto-syncs toggles

### CSS Game Mode Classes

Applied to `<body>` by `applyGameMode()`:
- `game-iracing`, `game-rally`, `game-acc`, `game-lmu`
- `.ir-only`, `.incident-only`, `.rally-only`, `.circuit-only`

---

## C# Plugin Architecture

### Key Files

```
simhub-plugin/plugin/K10MediaBroadcaster.Plugin/
+-- Plugin.cs                    <- Main plugin, HTTP server, JSON output
+-- Engine/
|   +-- TelemetrySnapshot.cs     <- Data model for all telemetry values
|   +-- DemoTelemetryProvider.cs  <- Demo mode data generator
|   +-- DemoSequence.cs           <- Demo sequence definitions
```

### Plugin.cs JSON Output

The plugin serves a flat JSON map. Key output sections:
- Standard telemetry (position, laps, fuel, tires, etc.)
- `K10MediaBroadcaster.Plugin.SessionTypeName` -- session type string
- `K10MediaBroadcaster.Plugin.DS.*` -- derived values (speed, pit limiter, etc.)
- `K10MediaBroadcaster.Plugin.Demo.*` -- demo mode equivalents
- `K10MediaBroadcaster.Plugin.Grid.*` -- grid/formation data

### DemoTelemetryProvider.cs

Generates demo telemetry data. Properties include:
- `SessionTypeName` (default: "Race")
- Standard telemetry fields (position, gaps, laps, fuel, etc.)
- `BestLapTime`, `LastLapTime`, `CurrentLap`

---

## Common Modifications

### Changing layout position options
Edit `_layoutPositionMap` in `settings.js` and the `<select id="layoutPosition">` in `dashboard.html`.

### Adjusting polling rate
Change `POLL_MS` in `config.js` (default: 33ms = 30fps).

### Adding a new secondary panel
1. Add HTML in dashboard.html
2. Add toggle in settings section with `data-key` and `data-section`
3. Create renderer module in `modules/js/`
4. Add `<script src>` tag before `poll-engine.js`

### Adding a new WebGL shader
1. Add shader section in `webgl.js` (before master FX loop)
2. Follow pattern: `initGL('canvasId')` -> shader source -> compile -> `window._*FXFrame(dt)` -> `window.set*`
3. Add to master FX loop: `if (window._*FXFrame) window._*FXFrame(dt);`

---

## React Dashboard (`dashboard-react.html`)

The React dashboard is a **parallel implementation** of the vanilla `dashboard.html` HUD, built with React 19 + TypeScript + Vite and compiled to a single self-contained HTML file. It must remain in **functional parity** with `dashboard.html` — every visual, data, and behavioral feature present in the vanilla version should be reproduced in the React version, and vice versa.

### File Layout

```
src/                                    <- React source root (build with `npm run build`)
+-- index.html                          <- Vite entry point
+-- vite.config.ts                      <- vite-plugin-singlefile, electron-compat post-process
+-- src/
    +-- main.tsx                        <- App entry, mounts <Dashboard />
    +-- App.tsx                         <- Root component
    +-- types/
    |   +-- telemetry.ts                <- TelemetryProps (raw API) + ParsedTelemetry (normalized)
    +-- hooks/
    |   +-- useTelemetry.tsx            <- Polling hook, parses raw props -> ParsedTelemetry
    +-- lib/
    |   +-- demo-sequence.ts            <- Demo mode timeline (mirrors DemoTelemetryProvider.cs)
    |   +-- bathurst-map.ts             <- Bathurst SVG path + getTrackPosition() for demo
    +-- styles/
    |   +-- global.css                  <- CSS variables, base styles (mirrors base.css + effects.css)
    |   +-- components.module.css       <- Component-scoped styles
    +-- components/
        +-- Dashboard.tsx               <- Root HUD layout
        +-- hud/
        |   +-- Tachometer.tsx          <- RPM bar segments (mirrors webgl-helpers.js tachometer section)
        |   +-- PedalsPanel.tsx         <- Pedal histograms (mirrors webgl-helpers.js pedal section)
        |   +-- TrackMaps.tsx           <- Full + zoom SVG maps (mirrors poll-engine.js map section)
        |   +-- GapsPanel.tsx           <- Ahead/Behind gaps (mirrors poll-engine.js gaps section)
        |   +-- PositionPanel.tsx       <- Position, delta, iRating cycle (mirrors poll-engine.js position)
        |   +-- CommentaryPanel.tsx     <- Commentary card + icons (mirrors commentary-viz.js)
        +-- panels/
        |   +-- LeaderboardPanel.tsx    <- Leaderboard + sparklines (mirrors leaderboard.js)
        |   +-- DatastreamPanel.tsx     <- G-force diamond + yaw trail (mirrors datastream.js)
        +-- overlays/
            +-- GridModule.tsx          <- Formation lap / start lights (mirrors formation.js)
            +-- RaceEndScreen.tsx       <- Race finish screen (mirrors race-end.js)
```

**Build command:** `cd src && npm run build`
**Output:** `K10 Media Broadcaster/dashboard-react.html` (~420KB, single inlined file)

---

### Functional Parity Rules

When making **any** change to the vanilla dashboard or the React dashboard, the equivalent change **must** be applied to the other implementation. The following table maps vanilla modules to their React counterparts:

| Vanilla (`modules/js/`)      | React component                          | What must stay in sync                                      |
|------------------------------|------------------------------------------|-------------------------------------------------------------|
| `webgl-helpers.js` (tachometer) | `hud/Tachometer.tsx`                 | Segment count (11), color thresholds (0.55 / 0.73 / 0.91), pulse classes |
| `webgl-helpers.js` (pedals)  | `hud/PedalsPanel.tsx`                    | 20-bar histogram, CSS classes `pedal-hist-bar throttle/brake/clutch`, `live` class on last bar |
| `webgl-helpers.js` (track map) | `hud/TrackMaps.tsx`                    | Low-pass smoothing (α=0.45 / α=0.08 on jump >20), viewBox clamp, SF marker, opponent proximity `close` class |
| `leaderboard.js`             | `panels/LeaderboardPanel.tsx`            | Step sparklines, gap format (`-1.2s` / `+3.4s`), iRating `2.8k` format, lap time color classes |
| `datastream.js`              | `panels/DatastreamPanel.tsx`             | G-force diamond (maxG=3, r=28, DPR-aware), yaw ring buffer (80 samples), gradient fill waveform, centered yaw bar |
| `race-end.js`                | `overlays/RaceEndScreen.tsx`             | Tint classes (`re-tint-gold/silver/bronze/green/neutral/purple`), clean race threshold (≤4 incidents), title text |
| `formation.js`               | `overlays/GridModule.tsx`                | Grid dot count, `gridded` class, countdown text (PIT/WARM/FORM/GRID/PACE/READY), start lights phases 1-6 |
| `commentary-viz.js` / `webgl-helpers.js` (icons) | `hud/CommentaryPanel.tsx` | Stroke-based SVG icons (35+), hue overrides for heat/wear/best topics, scroll overflow animation |
| `poll-engine.js` (position)  | `hud/PositionPanel.tsx`                  | Position delta from first valid position, ▲/▼ indicators, iR/SR page cycle |
| `poll-engine.js` (gaps)      | `hud/GapsPanel.tsx`                      | Session-aware mode (race: ahead/behind, non-race: best/last lap), `iR` suffix format |
| `demo-sequence.ts` (React)   | `DemoTelemetryProvider.cs` (C#)          | Timeline phases, lap counts, session states — keep in rough sync when adding new demo features |

---

### Key Architectural Differences

**Layout:** The vanilla dashboard uses a fixed CSS grid defined in `dashboard.css`. The React version externalizes layout as user-configurable settings (panel position classes injected via props). **Do not hard-code layout** in the React components — accept `posClasses` / `panelStyle` props.

**WebGL shaders:** The vanilla version uses 10 WebGL2 shader programs (`webgl.js`) for glow effects. The React version does **not** replicate WebGL shaders — visual effects are achieved with CSS animations and canvas 2D APIs. If a glow effect is added to the vanilla version, add an equivalent CSS animation in the React version.

**Polling:** Both versions poll `http://localhost:8889/k10mediabroadcaster/` at ~30fps. The React version uses `useTelemetry.tsx` (a custom hook with `setInterval`) instead of `poll-engine.js`'s `requestAnimationFrame`-based loop.

**Demo mode:** The vanilla version's demo data comes from the C# `DemoTelemetryProvider.cs`. The React version has its own `demo-sequence.ts` that runs entirely client-side. When adding a new demo feature, update **both** files.

---

### Adding a New Feature — Parity Checklist

When adding or modifying a feature, work through both implementations:

1. **Vanilla first:** Implement in the appropriate `modules/js/*.js` file and update `dashboard.html` markup if needed.
2. **Identify the React counterpart** from the table above.
3. **Mirror the logic:** Copy the algorithm (thresholds, formulas, CSS class names, element IDs) exactly. The React version's goal is visual and behavioral identity with the vanilla version, not a clean-room reimplementation.
4. **Update `telemetry.ts`** if a new data field is needed (`TelemetryProps` for the raw key, `ParsedTelemetry` for the normalized field).
5. **Update `useTelemetry.tsx`** to parse and map the new field.
6. **Update `demo-sequence.ts`** to include realistic demo values for the new field.
7. **Update `DemoTelemetryProvider.cs`** (C# side) if the same field needs to appear in the SimHub plugin's demo mode.
8. **Build and verify:** `cd src && npm run build` — must produce `dashboard-react.html` with no TypeScript errors.

---

### Element ID Correspondence

React components preserve the same `id` attributes as the vanilla DOM to ease cross-referencing. When the vanilla version uses `document.getElementById('dsYawFill')`, the React component renders `<div id="dsYawFill">`. This is intentional — do not rename element IDs in the React version unless the vanilla version also changes them.

---

### CSS Class Name Correspondence

All CSS class names that encode state or behavior are kept identical between implementations:

| Class | Used in | Meaning |
|-------|---------|---------|
| `pedal-hist-bar throttle/brake/clutch` | PedalsPanel | Histogram bar identity |
| `live` | PedalsPanel | Rightmost (newest) bar |
| `lb-player`, `lb-p1`, `lb-ahead`, `lb-behind` | LeaderboardPanel | Leaderboard row roles |
| `lap-pb`, `lap-fast`, `lap-slow` | LeaderboardPanel | Lap time color coding |
| `gap-ahead`, `gap-behind`, `gap-player` | LeaderboardPanel | Gap text color |
| `re-tint-gold/silver/bronze/green/neutral/purple` | RaceEndScreen | Finish result tint |
| `re-confetti-dot` | RaceEndScreen | Confetti particle |
| `grid-dot`, `player`, `gridded` | GridModule | Grid strip dot state |
| `lights-active` | GridModule | Start lights container active state |
| `go-visible` | GridModule | GO! text reveal |
| `map-track`, `map-player`, `map-opponent`, `close` | TrackMaps | SVG map element roles |
| `ds-positive`, `ds-negative`, `ds-neutral` | DatastreamPanel | Lap delta color |
| `ctrl-active` | ControlsPanel | ABS/TC active flash |

---

### Known Divergences (Acceptable)

These features exist in the vanilla dashboard but are **not** implemented in the React version, and that is intentional:

- **WebGL2 shaders** — tachoFX, pedalsFX, flagFX, lbFX, spotterFX, bonkersFX, commTrailFX, gridFlagFX
- **Spotter panel** — the proximity spotter (`spotter.js`) has no React counterpart yet
- **Race timeline bar** — `race-timeline.js` has no React counterpart yet
- **Pit limiter overlay** — `pit-limiter.js` bonkers spark particles not yet ported
- **Settings overlay** — React uses external layout config, not the in-HUD settings panel
- **Connection cards** — Discord OAuth and SimHub connection UI live in the Electron shell, not the React HUD
