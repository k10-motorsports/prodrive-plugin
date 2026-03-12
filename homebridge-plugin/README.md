# Homebridge Media Coach Lights Plugin

A Homebridge plugin that maps SimHub Media Coach telemetry to HomeKit-connected smart lights. Control light colors based on race flags, driver proximity, and event severity in real-time.

## Features

- Polls SimHub HTTP API for Media Coach plugin state
- Maps race flags (green, yellow, red, black, blue, debris) to light colors
- Proximity-based warnings (car distance on track)
- Event severity coloring (info through critical)
- Configurable light modes: flags only, events only, or all colors
- Blinking effects for urgent situations
- Multiple light support via HomeKit accessory groups

## Installation

### Prerequisites

1. **SimHub** running with the Media Coach plugin active
2. **SimHub Web Server** enabled (SimHub Settings → Plugins → Web Server)
3. **Homebridge** installed (v1.6.0 or later)

### Setup

1. Install the plugin via Homebridge UI:
   - Go to Homebridge → Plugins → Install Plugin
   - Search for `homebridge-media-coach-lights`
   - Click Install

2. Configure the plugin:
   - Go to Homebridge → Settings
   - Find "Media Coach Lights" platform
   - Enter your SimHub HTTP API URL (default: `http://localhost:8888`)
   - Set poll interval (default: 500ms)
   - Choose light mode (flags_only, events_only, or all_colors)
   - Add HomeKit lights if desired

3. Add lights to Apple Home:
   - Open Apple Home app
   - Tap + in top left corner
   - Select "Add Accessory"
   - Choose "Media Coach" from Homebridge
   - Assign to a room

## Configuration

### Light Modes

**flags_only** - Displays only iRacing race flags:
- Green flag: Green light
- Yellow flag: Yellow (slow blink)
- Red flag: Red (fast blink)
- Black flag: Off
- White flag: White
- Blue flag: Blue
- Debris flag: Orange (pulse)

**events_only** - Displays proximity and track events:
- Close proximity (< 0.8% track): Red
- Medium proximity (< 2% track): Orange
- Clear: Ambient green
- Ignores all flags and severity data

**all_colors** (default) - Priority coloring:
1. Race flags take priority when active
2. Falls back to event severity (info through critical)
3. Falls back to proximity-based coloring
4. Defaults to ambient green when idle

### Blinking Effects

When enabled (default), lights blink for:
- Yellow flag: 1 Hz (slow)
- Red flag: 2 Hz (fast)
- Black flag: 0.5 Hz (slow pulse)
- Debris flag: 0.5 Hz (pulse)
- Close proximity: 2 Hz (urgent racing)

## Color Reference

### Flag Colors
- Green: Hue 120, Sat 100, Bright 80
- Yellow: Hue 60, Sat 100, Bright 100
- Red: Hue 0, Sat 100, Bright 100
- Black: Off (brightness 0)
- White: Hue 0, Sat 0, Bright 100
- Blue: Hue 240, Sat 100, Bright 80
- Debris: Hue 30, Sat 100, Bright 90

### Severity Colors (when no flag)
- Severity 0 (none): Ambient green (Hue 120, Sat 50, Bright 30)
- Severity 1 (info): Slate (Hue 200, Sat 20, Bright 40)
- Severity 2 (notable): Blue (Hue 220, Sat 80, Bright 60)
- Severity 3 (significant): Orange (Hue 30, Sat 100, Bright 80)
- Severity 4 (urgent): Amber (Hue 50, Sat 100, Bright 100)
- Severity 5 (critical): Red (Hue 0, Sat 100, Bright 100)

### Proximity Colors (events_only mode)
- Very close (< 0.8%): Red danger
- Medium (< 2%): Orange alert
- Clear: Ambient green

## Troubleshooting

### Lights not updating
- Check SimHub web server is enabled (Settings → Plugins → Web Server)
- Verify SimHub URL in plugin config (default: `http://localhost:8888`)
- Check Homebridge logs for connection errors
- Ensure Media Coach plugin is active in SimHub

### Colors not showing
- Verify HomeKit light supports color changes (RGB bulbs required)
- Check light is not already at the same color
- Try turning light on/off to force update

### Performance issues
- Reduce poll interval (increase ms value) to reduce CPU load
- Disable blinking effects if too many lights
- Check SimHub performance (ensure plugin is running smoothly)

## Development

### Build from source

```bash
cd homebridge-plugin
npm install
npm run build
```

### Watch mode

```bash
npm run watch
```

### Manual install on a Homebridge host (Raspberry Pi / hb-service)

When the plugin isn't published to npm yet, deploy directly from the repo:

```bash
# 1. Install dev dependencies and build
cd homebridge-plugin
npm install
npm run build

# 2. Copy the built plugin into Homebridge's plugin directory
sudo cp -r /path/to/media-coach-plugins/homebridge-plugin \
    /var/lib/homebridge/node_modules/homebridge-media-coach-lights

# 3. Fix ownership (Homebridge runs as the homebridge user)
sudo chown -R homebridge:homebridge \
    /var/lib/homebridge/node_modules/homebridge-media-coach-lights

# 4. Restart Homebridge
sudo systemctl restart homebridge
```

On subsequent deploys, only the `dist/` folder needs to be re-copied:

```bash
npm run build && \
sudo cp -r dist /var/lib/homebridge/node_modules/homebridge-media-coach-lights/ && \
sudo chown -R homebridge:homebridge /var/lib/homebridge/node_modules/homebridge-media-coach-lights && \
sudo systemctl restart homebridge
```

Watch the log to confirm the plugin loaded cleanly:

```bash
sudo tail -f /var/lib/homebridge/homebridge.log
```

Expected startup output:
```
Loaded plugin: homebridge-media-coach-lights@1.0.0
Registered accessory: Sim Rig Light
Starting SimHub polling (interval: 500ms)
Homebridge v1.x.x is running on port 51370
```

> **SimHub URL**: The config at `/var/lib/homebridge/config.json` uses `simhubUrl: "http://playbox.local:8888"` — change this to match wherever SimHub is running on your network.

### Known issues fixed at v1.0.0

- `platformAccessory.ts` originally used string literals (`'Lightbulb'`, `'On'`, etc.) for service and characteristic lookups. These must use `this.platform.Service.*` and `this.platform.Characteristic.*` references from the Homebridge HAP API.
- `platform.ts` constructor incorrectly accessed `config.platforms[0]`. Homebridge passes the platform config object directly as the `config` argument, not the full `config.json` structure.

## API Reference

The plugin expects SimHub Media Coach plugin to expose these properties via HTTP API:

- `MediaCoach.Plugin.CommentarySeverity` - Event severity (0-5)
- `MediaCoach.Plugin.CommentaryVisible` - Event visible flag (0/1)
- `MediaCoach.Plugin.CommentarySentimentColor` - Sentiment color (#AARRGGBB)
- `MediaCoach.Plugin.CurrentFlagState` - Race flag state (green/yellow/red/etc.)
- `MediaCoach.Plugin.NearestCarDistance` - Nearest opponent distance (0.0-1.0)

## License

MIT

## Author

Kevin Conboy

---

For more information on Media Coach, visit: http://www.alternate.org
