# Homebridge Plugin Architecture

The Homebridge plugin (`homebridge-media-coach-lights`) is a TypeScript Dynamic Platform Plugin that drives Apple HomeKit lights based on SimHub telemetry. It polls the SimHub HTTP API and sets Lightbulb characteristics (hue, saturation, brightness) based on race flags, event severity, and driver proximity.

## Source Structure

```
homebridge-plugin/
├── src/
│   ├── index.ts              Plugin registration with Homebridge
│   ├── platform.ts           Platform class: polling loop, accessory management
│   ├── platformAccessory.ts  Lightbulb accessory: HSB characteristic control
│   ├── colorMapper.ts        State → HSB color resolution, blink config
│   ├── simhubClient.ts       HTTP client for SimHub API polling
│   ├── settings.ts           Plugin name and platform alias constants
│   └── types.ts              Shared interfaces
├── src/__tests__/
│   ├── colorMapper.test.ts   84 tests: flag colors, severity, proximity, blink
│   ├── simhubClient.test.ts  24 tests: HTTP parsing, error handling
│   └── perLightMode.test.ts  25 tests: per-light mode override logic
├── config.schema.json        Homebridge UI configuration schema
├── package.json              Node 18+, Homebridge 1.6+
└── tsconfig.json             TypeScript build configuration
```

## Communication Flow

```
SimHub (Media Coach properties)
  → SimHub HTTP API (port 8888)
  → Homebridge Plugin (polling at configurable interval)
  → HomeKit Lightbulb characteristics
  → Apple Home / smart lights
```

The plugin reads six properties from SimHub's HTTP API on each poll:

| SimHub Property | Purpose |
|----------------|---------|
| `MediaCoach.Plugin.CommentarySeverity` | Event severity (0-5) |
| `MediaCoach.Plugin.CommentaryVisible` | Whether a prompt is active (0/1) |
| `MediaCoach.Plugin.CommentarySentimentColor` | AARRGGBB color string |
| `MediaCoach.Plugin.CommentaryCategory` | Event category name |
| `MediaCoach.Plugin.CurrentFlagState` | Human-readable flag string |
| `MediaCoach.Plugin.NearestCarDistance` | Closest opponent distance fraction |

All six properties are fetched in parallel (`Promise.all`) with a 1.5-second per-property timeout. If any request fails, the plugin returns a default state (lights off) and logs the error. On the next successful poll, it clears the error state and resumes normal operation.

## Polling Loop

`Platform.ts` runs a `setInterval` at the configured poll rate (default 500ms). Each tick:

1. Fetch SimHub state via `SimHubClient.getState()`
2. For each light accessory:
   - Resolve the effective mode (per-light override or global)
   - Resolve the effective blink setting (per-light override or global)
   - Compute target color via `ColorMapper.resolveColor(state, mode)`
   - If blink is enabled, compute blink config via `ColorMapper.getBlinkConfig(state, mode)`
   - Apply blink phase: calculate `phase = (Date.now() % cycleMs) / cycleMs`. When phase >= 0.5, reduce brightness by 50
   - Update the light's HomeKit characteristics (Hue, Saturation, Brightness, On)

## Color Mapping

`ColorMapper` is a pure-function class. Given a `SimHubState` and a `LightMode`, it returns an HSB color.

### Flag Colors

Matched to standard racing flag meanings. These take priority in `flags_only` and `all_colors` modes:

| Flag | H | S | B | Notes |
|------|---|---|---|-------|
| green | 120 | 100 | 80 | |
| yellow | 60 | 100 | 100 | Blinks at 1 Hz |
| red | 0 | 100 | 100 | Blinks at 2 Hz |
| black | 0 | 0 | 100 | White, pulses at 0.5 Hz |
| white | 0 | 0 | 100 | |
| checkered | 0 | 0 | 100 | Alternates black/white at 2 Hz |
| blue | 240 | 100 | 80 | |
| debris | 30 | 100 | 90 | Pulses at 0.5 Hz |

### Severity Colors

Used in `events_only` and `all_colors` modes when a commentary event is active. Brightness increases with severity on a cyan base:

| Severity | H | S | B |
|----------|---|---|---|
| 0 (none) | 120 | 50 | 30 |
| 1 | 187 | 30 | 40 |
| 2 | 187 | 50 | 55 |
| 3 | 187 | 70 | 70 |
| 4 | 187 | 85 | 85 |
| 5 | 187 | 100 | 100 |

### Proximity Colors

Used in `events_only` and `all_colors` modes. Track distance fraction determines the color:

| Distance | Color | H | S | B |
|----------|-------|---|---|---|
| < 0.008 (0.8%) | Red | 0 | 100 | 100 |
| < 0.02 (2%) | Orange | 30 | 100 | 80 |
| >= 0.02 | Ambient green | 120 | 50 | 30 |

### Priority Resolution

In `all_colors` mode, the priority order is: active flag > active commentary event (severity color) > proximity > ambient.

## Per-Light Mode Overrides

Each light in the `lights` configuration array can specify its own `mode` and `enableBlink` values. The polling loop resolves these per-accessory:

```typescript
const lightMode = lightConfig.mode || this.config.mode;
const lightBlink = lightConfig.enableBlink !== undefined
  ? lightConfig.enableBlink
  : this.config.enableBlink;
```

This lets you run one light in `flags_only` mode (clean flag display on a monitor-mounted strip) while another runs `all_colors` with blink enabled (overhead room light for full immersion).

`PlatformAccessory.getLightConfig()` returns the light's stored config from the accessory context, which Homebridge persists across restarts.

## HomeKit Accessory

Each light exposes a single `Lightbulb` service with four characteristics:

| Characteristic | Range | Usage |
|---------------|-------|-------|
| On | boolean | Light on/off |
| Hue | 0-360 | Color hue |
| Saturation | 0-100 | Color saturation |
| Brightness | 0-100 | Light intensity |

Accessories are discovered at platform startup. Homebridge persists them across restarts via its caching system. The `uniqueId` in the config is used as the UUID seed — changing it creates a new accessory (the old one becomes an orphan in HomeKit).

## Error Handling

The plugin is designed to fail silently and recover automatically:

- Network errors return a default state (severity 0, no flag, no proximity). Lights go to ambient or off.
- Individual property fetch failures don't block other properties (parallel fetch with individual timeouts).
- The first successful poll after an error clears the error state and resumes normal color updates.
- All errors are logged to the Homebridge console with the SimHub URL for debugging.

## Building and Testing

```bash
cd homebridge-plugin
npm install
npm run build          # Compile TypeScript → dist/
npm test              # Run Jest test suite (133 tests)
npm run test:coverage # Coverage report
```

The test suite covers color mapping (84 tests), SimHub client HTTP handling (24 tests), and per-light mode override logic (25 tests). Tests use mock HTTP responses and don't require a running SimHub instance.
