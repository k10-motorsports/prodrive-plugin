<p align="center">
  <img src="src/images/logomark.png" alt="K10 Motorsports" width="200">
</p>

# K10 Motorsports

![Dashboard](racecor-plugin/simhub-plugin/docs/dashboard-screenshot.png)

A broadcast-grade sim racing HUD and telemetry platform. K10 Motorsports replaces your in-sim dashboard with a transparent overlay that displays real-time telemetry, race strategy, AI-generated commentary, and ambient smart lighting — all from a single SimHub plugin.

Built for iRacing. Cross-game support via SimHub's telemetry abstraction.

## Overview

K10 Motorsports is four things in one repository:

**A SimHub plugin** that processes raw telemetry at ~100ms intervals — evaluating 33+ trigger conditions, tracking tire wear and fuel consumption, computing sector splits, estimating iRating, normalizing cross-game data, and serving everything over HTTP as a flat JSON API.

**An Electron overlay** that renders that telemetry as a transparent, always-on-top HUD with WebGL post-processing effects, ambient light sampling, drive mode, leaderboard, and a modular panel system — 28+ JavaScript modules, no build step, running at ~30fps.

**A Homebridge plugin** that maps the same telemetry to Apple HomeKit smart lights, so your room reacts to race flags, proximity warnings, and event severity in real-time.

**A marketing site** at [k10motorsports.racing](https://k10motorsports.racing) with a Discord-authenticated Pro Drive members area at [prodrive.racecor.io](https://prodrive.racecor.io).

## Feature Highlights

### Telemetry Engine (C# / .NET 4.8)

The SimHub plugin captures telemetry snapshots every ~100ms and runs them through a multi-stage processing pipeline: commentary evaluation, sector timing, strategy computation, and state diffing. All processed data is served as 100+ JSON properties over an HTTP API on port 8889.

Key systems include a **commentary engine** with composable sentence fragments (opener + body + closer), severity-based interruption, and cooldown management across 33 topics and 240+ prompt combinations; a **strategy engine** with real-time tire lifecycle tracking (grip degradation scoring, wear estimation, temperature state), fuel computation (burn variance, pit window calculation, fuel saving detection), and stint-aware evaluation with severity-graded coaching calls; a **sector tracker** that auto-detects native track boundaries from iRacing telemetry and falls back to equidistant sectors; an **iRating estimator** for pre-qualifying rating display; and **country flag normalization** mapping iRacing's full country names to ISO 2-letter codes for the flag sprite system.

The plugin exposes 10 configurable actions (prefixed `K10Motorsports.*`) for wheel button and Stream Deck mapping — dismiss prompts, cycle pitbox tabs, navigate pit strategy options, and provide commentary feedback.

### Dashboard Overlay (Electron / Vanilla JS)

The overlay renders as a frameless, click-through, always-on-top window with native transparency on x64 Windows and chroma key fallback on ARM. The modular panel system includes:

**Main HUD** — Tachometer with color-coded RPM segments and redline flash, large gear indicator, speed readout, pedal input traces (throttle/brake/clutch histograms), fuel gauge with per-lap consumption and pit window estimates, four-corner tyre temperatures with heat-map coloring, brake bias / TC / ABS controls, race position with live gap times, iRating and Safety Rating displays, and a live lap timer with color-coded delta-to-best.

**Track Map** — SVG minimap centered on the player with heading-up rotation, opponent dots, and per-sector timing with brightness-coded performance indicators.

**Secondary Panels** — Full-field leaderboard with interval and gap-to-leader columns, real-time telemetry datastream, incident tracker, spotter proximity overlay, and a pitbox panel for pit strategy management.

**Race Overlays** — Full-width race control banner, pit limiter speed overlay, and end-of-race results screen.

**Commentary Panel** — Slides in from the edge when the commentary engine fires, tinted to match event sentiment (amber for strategy calls, orange for warnings, red for critical). Auto-dismisses on expiry.

**Visual Effects** — A WebGL2 fragment shader system provides glare, bloom pulse, light sweep, panel glow, dome specular highlights, g-force vignette, and RPM redline effects. An ambient light engine samples a configurable screen region at ~4fps and uses LERP interpolation to drive CSS variable updates across all panels for reactive glass refraction effects.

**Drive HUD Mode** — A fullscreen driving-focused mode (Ctrl+Shift+F) showing only track map, sectors, lap delta, position, spotter, and incident count — designed for direct racing without stream production elements.

### Homebridge HomeKit Lights (TypeScript)

Maps telemetry to HomeKit light colors in real-time. Three modes: flags only (green/yellow/red/blue/white/debris), events only (proximity-based coloring), or combined (flags → severity → proximity priority chain). Supports blinking effects for urgent situations, per-light mode overrides, and multiple independent lights.

### Web (Next.js 16)

Marketing site at [k10motorsports.racing](https://k10motorsports.racing) built with Next.js 16, React 19, and Tailwind CSS 4. Includes a Discord-authenticated Pro Drive members area at [prodrive.racecor.io](https://prodrive.racecor.io) with Strapi CMS backing the content layer.

## Install

### Windows Installer (Recommended)

Download **K10-Motorsports-Setup.exe** from the [latest release](https://github.com/alternatekev/media-coach-simhub-plugin/releases/latest). The installer bundles both the SimHub plugin and the Electron overlay. Choose to install either or both during setup — the installer auto-detects your SimHub installation and handles all file placement.

The plugin includes a built-in **Check for updates** button in its SimHub settings panel that downloads and launches the latest installer automatically.

### macOS (Overlay Only)

The SimHub plugin is Windows-only, but the Electron overlay can run standalone on macOS for reviewing replays, remote dashboard access, or development. Double-click `scripts/mac/K10 Media Broadcaster.command` — it auto-installs Node dependencies, fixes Electron code signing on Apple Silicon, and launches the overlay detached from the terminal. A separate `scripts/mac/install.command` handles a clean dependency install if needed.

The overlay connects to a SimHub instance on the network (configure the API URL in settings, e.g. `http://your-pc:8889/k10mediabroadcaster`).

### Manual Install (SimHub Plugin Only)

Prerequisites: [SimHub](https://www.simhubdash.com/) installed on Windows.

**iRacing users:** Install the [iRacing Extra Properties](https://drive.google.com/drive/folders/1AiIWHviD4j-_D-zgRrjJU1AFhJ_xmass) plugin by RomainRob for iRating and Safety Rating display. Copy `RSC.iRacingExtraProperties.dll` into your SimHub folder while SimHub is closed.

**Double-click `install.bat`** (in `scripts/windows/`). After installation, launch SimHub, enable "K10 Motorsports" in the plugin list, and configure display timing and category filters in the plugin settings panel.

The plugin exposes all data as SimHub properties (prefixed `K10Motorsports.Plugin.*`), so you can build your own dashboard layout or integrate the properties into an existing one.

Build from source: **[racecor-plugin/simhub-plugin/docs/DEVELOPMENT.md](racecor-plugin/simhub-plugin/docs/DEVELOPMENT.md)**

### Homebridge HomeKit Lights

Prerequisites: [Homebridge](https://homebridge.io/) (v1.6+), Node.js 18+, SimHub web server enabled, at least one color-capable smart light.

```bash
cd racecor-plugin/homebridge-plugin && npm install && npm run build && npm link
```

Add the `K10MotorsportsLights` platform to your Homebridge `config.json`:

```json
{
  "platform": "K10MotorsportsLights",
  "name": "K10 Motorsports Lights",
  "simhubUrl": "http://localhost:8888",
  "mode": "all_colors",
  "enableBlink": true,
  "lights": [{ "name": "Sim Rig Light", "uniqueId": "k10-motorsports-light-1" }]
}
```

Full setup walkthrough with multi-light configuration and automation scripts: **[racecor-plugin/homebridge-plugin/docs/HOMEKIT.md](racecor-plugin/homebridge-plugin/docs/HOMEKIT.md)**

## Repository Structure

```
├── racecor-overlay/                      Electron overlay app + dashboard HUD
│   ├── main.js                           Electron main process (transparency, hotkeys, IPC, screen capture)
│   ├── preload.js                        IPC bridge
│   ├── remote-server.js                  LAN HTTP server for remote access
│   ├── dashboard.html                    Main overlay UI (vanilla JS, no build step)
│   ├── modules/js/                       28+ JavaScript modules
│   │   ├── poll-engine.js                Telemetry polling + data routing (~30fps)
│   │   ├── config.js                     Property subscriptions + state management
│   │   ├── webgl.js                      WebGL2 glare/bloom/vignette fragment shader
│   │   ├── ambient-light.js              Screen color sampling + LERP engine
│   │   ├── drive-hud.js                  Fullscreen driving-focused HUD mode
│   │   ├── leaderboard.js                Full-field position/gap table
│   │   ├── datastream.js                 Live telemetry data stream
│   │   ├── spotter.js                    Proximity overlay
│   │   ├── pitbox.js                     Pit strategy management
│   │   ├── sector-hud.js                 Sector timing display
│   │   ├── track-map.js                  SVG minimap with heading-up rotation
│   │   └── ...                           Commentary, settings, connections, game detection, etc.
│   ├── modules/styles/                   10 CSS modules (base, dashboard, effects, ambient, pitbox, etc.)
│   ├── data/                             Track + car research data
│   ├── streamdeck/                       Elgato Stream Deck profile + icons
│   └── images/                           Branding, car logos, country flags
├── racecor-plugin/                       SimHub C# plugin + homebridge plugin
│   ├── simhub-plugin/                    SimHub plugin + data
│   │   ├── plugin/K10Motorsports.Plugin/ C# source (.NET Framework 4.8, WPF)
│   │   │   ├── Plugin.cs                 Entry point, HTTP server, action registration
│   │   │   └── Engine/                   Core systems
│   │   │       ├── CommentaryEngine.cs   Trigger evaluation + prompt assembly
│   │   │       ├── TelemetrySnapshot.cs  Cross-game telemetry normalization
│   │   │       ├── SectorTracker.cs      Native + fallback sector boundary detection
│   │   │       ├── IRacingSdkBridge.cs   Direct iRacing SDK integration
│   │   │       ├── IRatingEstimator.cs   Pre-qualifying iRating estimation
│   │   │       ├── TrackMapProvider.cs   SVG track map generation
│   │   │       ├── PluginUpdater.cs      GitHub Release auto-updater
│   │   │       └── Strategy/             Real-time race strategy engine
│   │   │           ├── StrategyCoordinator.cs  Stint lifecycle + call orchestration
│   │   │           ├── TireTracker.cs          Grip scoring, wear estimation, temp monitoring
│   │   │           ├── FuelComputer.cs         Burn stats, pit window, fuel saving detection
│   │   │           └── StintData.cs            Per-stint telemetry history
│   │   ├── k10-motorsports-data/         Commentary topics, fragments, sentiments (JSON)
│   │   ├── tests/                        C# unit tests + Python dataset validation
│   │   ├── tools/                        Telemetry replay, fragment generation
│   │   └── DashTemplates/                SimHub dashboard templates
│   └── homebridge-plugin/                Homebridge platform plugin (TypeScript)
│       ├── src/__tests__/                Jest test suite (133 tests)
│       └── docs/                         Homebridge-specific documentation
├── web/                                  Next.js 16 marketing site + Pro Drive members area
│   └── src/                              React 19, Tailwind CSS 4, NextAuth 5, Strapi CMS
├── src/agents/                           MCP servers (Model Context Protocol)
│   ├── simhub-telemetry/                 Live telemetry data reader
│   ├── k10-plugin/                       Plugin source + dataset inspector
│   └── k10-broadcaster/                  Dashboard component inspector
├── installer/                            Inno Setup combined Windows installer
├── scripts/                              Platform install + launch scripts
│   ├── mac/                              macOS install, launch, rebuild
│   └── windows/                          Windows install, start, export, build-installer
└── .github/workflows/                    CI pipelines + release workflow
```

## Documentation

| Document | Covers |
| --- | --- |
| **SimHub Plugin** | |
| [SIMHUB_PLUGIN.md](racecor-plugin/simhub-plugin/docs/SIMHUB_PLUGIN.md) | Plugin architecture, cross-game support, settings, dashboard properties |
| [COMMENTARY_ENGINE.md](racecor-plugin/simhub-plugin/docs/COMMENTARY_ENGINE.md) | Trigger evaluation pipeline, severity interruption, fragment assembly, cooldowns |
| [AI_STRATEGIST_DESIGN.md](AI_STRATEGIST_DESIGN.md) | Strategy engine design — tire lifecycle, fuel strategy, pit optimizer, opponent intelligence |
| **Dashboard Overlay** | |
| [racecor-overlay/README.md](racecor-overlay/README.md) | Electron overlay setup, panel reference, architecture, drive mode, OBS, Stream Deck |
| **Homebridge Plugin** | |
| [HOMEBRIDGE_PLUGIN.md](racecor-plugin/homebridge-plugin/docs/HOMEBRIDGE_PLUGIN.md) | Platform architecture, color mapping, polling loop, per-light overrides |
| [HOMEKIT.md](racecor-plugin/homebridge-plugin/docs/HOMEKIT.md) | Apple HomeKit setup, light modes, multi-light configuration, troubleshooting |
| **Shared** | |
| [DATASETS.md](racecor-plugin/simhub-plugin/docs/DATASETS.md) | Topic schema, trigger conditions, fragment format, how to add new topics |
| [TESTING.md](racecor-plugin/simhub-plugin/docs/TESTING.md) | Test suites, CI integration |
| [DEVELOPMENT.md](racecor-plugin/simhub-plugin/docs/DEVELOPMENT.md) | Building from source, project setup, contributor workflow |

## Testing

Three test suites run without SimHub, iRacing, or any external service:

```bash
# C# unit tests (200+ tests, NUnit)
cd racecor-plugin/simhub-plugin/tests/K10Motorsports.Tests && dotnet test

# Python dataset validation (28 tests)
python3 racecor-plugin/simhub-plugin/tests/validate_datasets.py

# Homebridge Jest tests (133 tests)
cd racecor-plugin/homebridge-plugin && npm test
```

The C# test project uses standalone reimplementations of the plugin's engine logic (no SimHub dependencies), so it runs on any platform with the .NET 6.0 SDK.

Full testing documentation: **[racecor-plugin/simhub-plugin/docs/TESTING.md](racecor-plugin/simhub-plugin/docs/TESTING.md)**

## Data Sources and Attribution

The commentary voice, phrase patterns, and fragment vocabulary are informed by the following sources. All transcripts were obtained through publicly available YouTube auto-captions or published APIs.

### Sim Racing YouTube Creators

| Channel | Style | License |
| --- | --- | --- |
| [Jimmy Broadbent](https://www.youtube.com/@JimmyBroadbent) | High-energy, humorous race commentary | YouTube Standard License (auto-captions) |
| [Matt Malone / MG Charoudin](https://www.youtube.com/@MGCharoudin) | Nürburgring-focused, technical | YouTube Standard License |
| [Jaaames](https://www.youtube.com/@jaaames) | Competitive iRacing, analytical | YouTube Standard License |
| [Traxion.GG](https://www.youtube.com/@Traxion) | Sim racing news and reviews | YouTube Standard License |
| [JustHun Gaming](https://www.youtube.com/@JustHunGaming) | ACC competitive, setup-focused | YouTube Standard License |
| [Project Sim Racing](https://www.youtube.com/@ProjectSimRacing) | Community broadcasts | YouTube Standard License |
| [Just Sim Racing](https://www.youtube.com/@JustSimRacing) | Multi-sim, wheel-to-wheel focus | YouTube Standard License |
| [Redd500 Gaming](https://www.youtube.com/@Redd500) | iRacing oval/road, narrative style | YouTube Standard License |

### Professional Broadcast Commentary

| Source | Style | License |
| --- | --- | --- |
| [Global SimRacing Channel](https://www.youtube.com/@GlobalSimRacingChannel) | Professional sim racing broadcasts since 2013 | YouTube Standard License |
| [RaceSpot TV](https://www.youtube.com/@RaceSpotTV) | eNASCAR official broadcast partner | YouTube Standard License |
| [Apex Racing TV](https://www.youtube.com/@ApexRacingTV) | iRacing league broadcasts | YouTube Standard License |

### Coaching and Instructional

| Source | Style | License |
| --- | --- | --- |
| [Driver61](https://www.youtube.com/@Driver61) | Professional racing coach, technique breakdowns | YouTube Standard License |
| [Suellio Almeida / Virtual Racing School](https://www.youtube.com/@VirtualRacingSchool) | Data-driven coaching, telemetry analysis | YouTube Standard License |

### Structured Phrase Databases

| Source | Usage | License |
| --- | --- | --- |
| [Crew Chief V4](https://gitlab.com/mr_belern/CrewChiefV4) | Spotter phrase patterns and audio composition architecture | [GPL-3.0](https://gitlab.com/mr_belern/CrewChiefV4/-/blob/master/LICENSE) |

The composable fragment system (opener + body + closer) is directly inspired by Crew Chief V4's audio clip composition architecture.

### AI-Assisted Content

Commentary fragments in `racecor-plugin/simhub-plugin/k10-motorsports-data/commentary_fragments.json` were generated using [Claude](https://claude.ai) (Anthropic's `claude-haiku-4-5` model) with the commentary topics, sentiment vocabulary, and channel style profiles as input. The generation is a one-time offline process — no AI API calls occur at runtime in the current version.

Plugin codebase, test suites, dataset structures, documentation, dashboard overlay, strategy engine, and Homebridge companion plugin built with [Claude Code](https://claude.ai/claude-code) (Anthropic's `claude-opus-4-6`).

## Roadmap

### Current (v0.1.x)

Composable sentence fragments assembled at runtime from pre-generated pools. 33 topics with refined thresholds, 240+ unique prompt combinations per topic, severity-based interruption, category+alpha color system, Homebridge integration with per-light mode overrides. Phase 1 strategy engine with tire lifecycle tracking and fuel computation. WebGL post-processing with ambient light sampling. Drive HUD mode. Full leaderboard and datastream panels. Pitbox pit strategy management. Built-in auto-updater.

### Next (v1.0)

Live AI commentary via the Anthropic Messages API (`claude-haiku-4-5`). Instead of selecting from pre-generated fragments, the engine calls Haiku at event fire time (~200-400ms latency) with a context-aware prompt built from the current telemetry snapshot, fired topic, and channel style profile. Falls back to the fragment system if the API key is empty, the network is down, or the response exceeds 1.5 seconds. Strategy Phase 2: opponent intelligence and pit strategy optimization. Corner-by-corner telemetry analysis.

## License

MIT

## Author

Kevin Conboy — [alternate.org](http://www.alternate.org)
