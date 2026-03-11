# Apple HomeKit Light Control for Media Coach

This guide walks through connecting your Apple HomeKit-compatible smart lights to the Media Coach SimHub plugin, so your lights react to what's happening on track.

## Prerequisites

Before starting, you need the following running on your network:

- **SimHub** with the Media Coach plugin installed and active
- **SimHub Web Dashboard Server** enabled (Settings > Web Server in SimHub, default port 8888)
- **Homebridge** (v1.6.0+) running on any machine that can reach your SimHub PC over the network
- **Node.js** 18 or later on the Homebridge host
- At least one **HomeKit-compatible color light** (Hue, LIFX, Nanoleaf, or any bulb exposed through Homebridge)
- A HomeKit automation app that supports value-passthrough triggers — **[Controller for HomeKit](https://controllerforhomekit.com/)** or **[Home+](https://hochgatterer.me/home+/)** recommended for full color mirroring (the stock Apple Home app can do on/off but not exact color copying)

## Installation

### 1. Install the Homebridge plugin

From the `homebridge-plugin/` directory in this repository:

```bash
cd homebridge-plugin
npm install
npm run build
npm link
```

This registers the plugin with your local Homebridge instance. Alternatively, copy the built package into your Homebridge plugin directory.

### 2. Enable the SimHub web server

Open SimHub, go to **Settings**, and enable **Web Dashboard Server**. The default URL is `http://localhost:8888`. If your Homebridge host is a different machine, note the SimHub PC's local IP address (e.g., `http://192.168.1.50:8888`).

Verify the API is working by visiting this URL in a browser:

```
http://localhost:8888/api/pluginproperty/MediaCoach.Plugin.CommentaryVisible
```

You should see a `0` or `1` response. If you get an error, confirm the Media Coach plugin is loaded and SimHub's web server is active.

### 3. Configure in Homebridge

Open the Homebridge UI and find **Media Coach Lights** in the plugin list. Add a platform entry to your Homebridge `config.json`:

```json
{
  "platform": "MediaCoachLights",
  "name": "Media Coach Lights",
  "simhubUrl": "http://localhost:8888",
  "pollIntervalMs": 500,
  "mode": "all_colors",
  "enableBlink": true,
  "lights": [
    {
      "name": "Sim Rig Light",
      "uniqueId": "media-coach-light-1"
    }
  ]
}
```

Replace `localhost` with your SimHub machine's IP if Homebridge runs on a different host.

### 4. Restart Homebridge and verify the virtual light

After restarting Homebridge, a new light accessory called "Sim Rig Light" (or whatever you named it) appears in your Apple Home app. Assign it to the room where your sim rig is.

This is a **virtual light** — it doesn't control any physical bulb directly. The plugin updates this virtual light's hue, saturation, and brightness based on SimHub telemetry. You'll see its color tile change in Apple Home during a race session, but your real lights won't react until you connect them via a HomeKit automation (step 5).

### 5. Connect the virtual light to your physical lights

The virtual light acts as a color signal source. You need an automation that tells your physical light to mirror the virtual light's color whenever it changes.

**How this works conceptually:** The plugin polls SimHub at ~500ms intervals and writes HSB values to the virtual Lightbulb accessory. HomeKit sees the characteristic update and fires any automation you've attached to that accessory. The automation then pushes the same HSB values to your real bulb.

#### Option A: Controller for HomeKit (recommended)

[Controller for HomeKit](https://controllerforhomekit.com/) (paid, iOS/Mac) supports value-passthrough automations, which is what makes full color mirroring possible.

1. Open Controller and create a new automation
2. Set the trigger to: **"Sim Rig Light" → Hue changes**
3. Set the action to: **your physical light** → Hue = *value of trigger*, Saturation = *value of "Sim Rig Light" Saturation*, Brightness = *value of "Sim Rig Light" Brightness*
4. Create a second automation triggered by **"Sim Rig Light" → On/Off changes**, with the action setting your physical light's On state to match
5. Repeat for each physical light you want to control

Controller lets you reference one accessory's characteristic value inside another accessory's action, so the physical light always copies the exact color.

#### Option B: Home+ (iOS/Mac)

[Home+](https://hochgatterer.me/home+/) (paid) similarly supports value-reference automations. The setup is comparable — trigger on the virtual light's characteristics changing, and pass the values through to your physical light.

#### Option C: Eve for HomeKit (iOS)

[Eve](https://www.evehome.com/en/eve-app) (free) offers condition-based automations with more flexibility than the stock Home app. You can create automations triggered by the virtual light's state changes, then configure your physical light to follow.

#### Option D: Stock Apple Home app

The built-in Home app can trigger automations when an accessory turns on/off, but it has limited support for "copy the exact color from one light to another." You can still get useful results with a simpler approach:

1. **Automation 1:** When "Sim Rig Light" turns **on** → turn on "Desk Lamp"
2. **Automation 2:** When "Sim Rig Light" turns **off** → turn off "Desk Lamp"

This gives you on/off mirroring. For color, you'd need to create separate automations for specific brightness thresholds (e.g., "when brightness is 100%, set Desk Lamp to red") — workable but tedious. For full color mirroring, Controller for HomeKit or Home+ is strongly recommended.

#### Option E: Homebridge automation plugin

If you'd rather skip the HomeKit automation layer entirely, you can install a Homebridge automation plugin like [homebridge-automation](https://www.npmjs.com/package/homebridge-automation) to define rules directly on the Homebridge server. This has the lowest latency since it runs locally without a round-trip through HomeKit.

### 6. Verify end-to-end

With the automation in place:

1. Start a race session in SimHub (or enable Demo mode in the Media Coach plugin settings)
2. Watch the virtual light's color tile change in Apple Home
3. Confirm your physical light follows those changes
4. If there's a noticeable delay, lower `pollIntervalMs` in the Homebridge config (see Troubleshooting)

## Light Modes

The plugin supports three modes that determine which telemetry data drives the lights. Set the mode globally, or override it per light (see Multi-Light Setup below).

### Flags Only

Lights reflect iRacing session flags and nothing else.

| Flag | Color | Behavior |
|------|-------|----------|
| Green | Green (H120) | Steady |
| Yellow / Caution | Yellow (H60) | Blinks at 1 Hz if blink enabled |
| Red | Red (H0) | Blinks at 2 Hz if blink enabled |
| Black | Off or pulsing red | Slow 0.5 Hz pulse if blink enabled |
| White | White (H0 S0) | Steady |
| Checkered | Black/white alternating | 2 Hz alternation if blink enabled |
| Blue | Blue (H240) | Steady |
| Debris | Orange (H30) | Slow 0.5 Hz pulse if blink enabled |
| No flag | Off | Light turns off |

### Events Only

Lights respond to proximity and track events, ignoring flags.

| Condition | Color | Notes |
|-----------|-------|-------|
| Car within 0.8% track distance | Red | Door-to-door racing. Blinks at 2 Hz if enabled. |
| Car within 2% track distance | Orange | Close but not alongside |
| No nearby cars | Ambient green | Low brightness |
| Off track | Red flash | 3 Hz flash for 3 seconds if blink enabled |
| Pit lane | Blue (low brightness) | Calm indicator |

### All Colors (recommended)

Combines flags, events, and commentary severity. Priority order:

1. **Active flag** takes priority when present
2. **Commentary severity** color when a prompt is active (brighter = more urgent)
3. **Proximity** color when cars are nearby
4. **Ambient** green at low brightness when nothing is happening

Severity levels map to increasing brightness on a cyan base:

| Severity | Level | Brightness |
|----------|-------|------------|
| 1 | Info | 40% |
| 2 | Notable | 55% |
| 3 | Significant | 70% |
| 4 | Urgent | 85% |
| 5 | Critical | 100% |

### Blinking

Blinking is an overlay toggle that works with any mode. When enabled, certain states cause the light to pulse or flash:

| State | Frequency | Duration |
|-------|-----------|----------|
| Yellow flag | 1 Hz | Continuous |
| Red flag | 2 Hz | Continuous |
| Black flag | 0.5 Hz pulse | Continuous |
| Close proximity (< 0.8%) | 2 Hz | While alongside |
| Off track / wall contact | 3 Hz flash | 3 seconds |
| Checkered flag | 2 Hz alternating | Continuous |
| Debris | 0.5 Hz pulse | Continuous |

Blinking is phase-based (calculated from clock time), not timer-based, so multiple lights stay synchronized.

## Multi-Light Setup

You can control multiple lights independently. Each light in the `lights` array becomes a separate HomeKit accessory and can optionally override the global mode and blink settings.

```json
{
  "platform": "MediaCoachLights",
  "name": "Media Coach Lights",
  "simhubUrl": "http://192.168.1.50:8888",
  "mode": "all_colors",
  "enableBlink": true,
  "lights": [
    {
      "name": "Overhead Light",
      "uniqueId": "mc-overhead",
      "mode": "all_colors",
      "enableBlink": true
    },
    {
      "name": "Flag Strip",
      "uniqueId": "mc-flag-strip",
      "mode": "flags_only",
      "enableBlink": true
    },
    {
      "name": "Ambient Backlight",
      "uniqueId": "mc-backlight",
      "mode": "events_only",
      "enableBlink": false
    }
  ]
}
```

In this example, the overhead light shows everything, the LED strip behind the monitor only shows flags, and a backlight responds to proximity without blinking.

When `mode` or `enableBlink` is omitted from a light entry, it inherits the global setting.

## Ambient Color

When no race event is active, lights return to an ambient color. The default is a dim green (H120, S50, B30). You can customize this:

```json
"ambientColor": {
  "hue": 240,
  "saturation": 30,
  "brightness": 15
}
```

This would set a very dim blue ambient instead.

## Configuration Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `simhubUrl` | string | `http://localhost:8888` | SimHub HTTP API base URL |
| `pollIntervalMs` | integer | `500` | Polling interval in ms (100-5000) |
| `mode` | string | `all_colors` | Global light mode: `flags_only`, `events_only`, or `all_colors` |
| `enableBlink` | boolean | `true` | Global blink toggle |
| `ambientColor` | object | H120/S50/B30 | Default color when no event is active |
| `lights` | array | 1 default light | Light accessories to expose to HomeKit |
| `lights[].name` | string | required | Display name in Apple Home |
| `lights[].uniqueId` | string | required | Internal identifier (do not change after pairing) |
| `lights[].mode` | string | (global) | Per-light mode override |
| `lights[].enableBlink` | boolean | (global) | Per-light blink override |

## Troubleshooting

**Lights don't respond at all**
- Confirm SimHub's web server is enabled and reachable from the Homebridge host. Try `curl http://<simhub-ip>:8888/api/pluginproperty/MediaCoach.Plugin.CommentaryVisible` from the Homebridge machine.
- Check Homebridge logs for connection errors from the Media Coach Lights plugin.
- Ensure the Media Coach plugin is active in SimHub (look for "MediaCoach.Plugin" in SimHub's plugin list).

**Lights respond but colors are wrong**
- Verify the light mode is set to `all_colors` for full color support.
- Some HomeKit lights have limited color gamut. Colors may appear slightly different depending on the bulb hardware.

**Blinking is too fast or distracting**
- Set `enableBlink` to `false` globally or per-light. Flag and severity colors still work without blinking.

**Latency feels high**
- Lower `pollIntervalMs` to 200 or 100. Below 200ms you may see increased CPU usage on the Homebridge host, and some lights have inherent latency in their HomeKit implementation.
- Run Homebridge on the same machine as SimHub to eliminate network latency.

**Virtual light changes color but physical light doesn't follow**
- Confirm you've created the HomeKit automation (step 5). The virtual light and your physical light are separate accessories — they don't link automatically.
- Check that your automation app (Controller, Home+, Eve) is running and the automation is enabled.
- In Controller for HomeKit, verify the automation trigger references the correct virtual light name and the action targets the correct physical light.
- If using the stock Home app, remember that on/off automations work but color-copying automations are limited. Upgrade to Controller or Home+ for full HSB mirroring.

**Automation fires but colors don't match exactly**
- Some light brands (especially older Hue bulbs) have a narrower color gamut than what HSB values can represent. Deep blues and saturated reds may appear washed out.
- Ensure the automation is passing all three values (Hue, Saturation, Brightness), not just Hue. Missing saturation will produce pastels instead of vivid colors.
- If your bulb is RGBW (has a separate white channel), it may blend white in at lower saturations. Set saturation to 100% in the ambient config to keep colors vivid.

**Multiple lights are out of sync during blinks**
- Blinking is calculated from the system clock, so all lights on the same Homebridge instance should be synchronized. If lights are on different Homebridge instances, they may drift slightly.

## How It Works

For a detailed technical walkthrough of the Homebridge plugin architecture, color mapping logic, SimHub API communication, and the per-light override system, see [HOMEBRIDGE_PLUGIN.md](HOMEBRIDGE_PLUGIN.md).
