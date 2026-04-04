# Apple HomeKit Light Control for K10 Motorsports

This guide walks through connecting your Apple HomeKit-compatible smart lights to the K10 Motorsports SimHub plugin, so your lights react to what's happening on track.

## Prerequisites

Before starting, you need the following running on your network:

- **SimHub** with the K10 Motorsports plugin installed and active
- **SimHub Web Dashboard Server** enabled (Settings > Web Server in SimHub, default port 8888)
- **Homebridge** (v1.6.0+) running on any machine that can reach your SimHub PC over the network
- **Node.js** 18 or later on the Homebridge host
- At least one **color-capable smart light** — either paired directly to HomeKit (Hue, LIFX, Nanoleaf) or exposed through a Homebridge plugin (homebridge-hue, homebridge-shelly, homebridge-zigbee2mqtt, etc.)
- **For native HomeKit lights:** a HomeKit automation app — **[Controller for HomeKit](https://controllerforhomekit.com/)** or **[Home+](https://hochgatterer.me/home+/)** recommended for full color mirroring, or **[Eve](https://www.evehome.com/en/eve-app)** (free) for basic automation
- **For Homebridge-managed lights:** **[homebridge-plugin-automation](https://github.com/grrowl/homebridge-plugin-automation)** (free, lowest latency, runs server-side)

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
http://localhost:8888/api/pluginproperty/RaceCorProDrive.Plugin.CommentaryVisible
```

You should see a `0` or `1` response. If you get an error, confirm the K10 Motorsports plugin is loaded and SimHub's web server is active.

### 3. Configure in Homebridge

Open the Homebridge UI and find **K10 Motorsports Lights** in the plugin list. Add a platform entry to your Homebridge `config.json`:

```json
{
  "platform": "RaceCorProDriveLights",
  "name": "K10 Motorsports Lights",
  "simhubUrl": "http://localhost:8888",
  "pollIntervalMs": 500,
  "mode": "all_colors",
  "enableBlink": true,
  "lights": [
    {
      "name": "Sim Rig Light",
      "uniqueId": "k10-motorsports-light-1"
    }
  ]
}
```

Replace `localhost` with your SimHub machine's IP if Homebridge runs on a different host.

### 4. Restart Homebridge and verify the virtual light

After restarting Homebridge, a new light accessory called "Sim Rig Light" (or whatever you named it) appears in your Apple Home app. Assign it to the room where your sim rig is.

This is a **virtual light** — it doesn't control any physical bulb directly. The plugin updates this virtual light's hue, saturation, and brightness based on SimHub telemetry. You'll see its color tile change in Apple Home during a race session, but your real lights won't react until you connect them via a HomeKit automation (step 5).

### 5. Connect the virtual light to your physical lights

The virtual light acts as a color signal source. You need an automation layer that mirrors the virtual light's HSB values onto your real bulbs whenever they change. Which approach to use depends on **how your physical lights are connected**.

#### Which path should I use?

**If your lights are paired directly to HomeKit** (Hue Bridge → HomeKit, Nanoleaf → HomeKit, LIFX → HomeKit, or any bulb that shows up in Apple Home without Homebridge) → use **Path A: HomeKit Automation**. Homebridge can't directly control accessories it didn't create, so you need a HomeKit automation to bridge the gap.

**If your lights are exposed through a Homebridge plugin** (homebridge-hue, homebridge-shelly, homebridge-zigbee2mqtt, homebridge-lifx, or any light that only exists because a Homebridge plugin created it) → you can use either path, but **Path B: homebridge-plugin-automation** is recommended. It runs entirely on the Homebridge server with no round-trip through HomeKit, giving you the lowest possible latency.

---

#### Path A: HomeKit automation (for native HomeKit lights)

The plugin polls SimHub at ~500ms intervals and writes HSB values to the virtual Lightbulb accessory. HomeKit sees the characteristic update and fires any automation you've attached to that accessory. The automation then pushes the same HSB values to your real bulb.

**Controller for HomeKit (recommended)**

[Controller for HomeKit](https://controllerforhomekit.com/) (paid, iOS/Mac) supports value-passthrough automations, which is what makes full color mirroring possible.

1. Open Controller and create a new automation
2. Set the trigger to: **"Sim Rig Light" → Hue changes**
3. Set the action to: **your physical light** → Hue = *value of trigger*, Saturation = *value of "Sim Rig Light" Saturation*, Brightness = *value of "Sim Rig Light" Brightness*
4. Create a second automation triggered by **"Sim Rig Light" → On/Off changes**, with the action setting your physical light's On state to match
5. Repeat for each physical light you want to control

Controller lets you reference one accessory's characteristic value inside another accessory's action, so the physical light always copies the exact color.

**Home+ (iOS/Mac)**

[Home+](https://hochgatterer.me/home+/) (paid) similarly supports value-reference automations. The setup is comparable — trigger on the virtual light's characteristics changing, and pass the values through to your physical light.

**Eve for HomeKit (iOS)**

[Eve](https://www.evehome.com/en/eve-app) (free) offers condition-based automations with more flexibility than the stock Home app. You can create automations triggered by the virtual light's state changes, then configure your physical light to follow.

**Stock Apple Home app (limited)**

The built-in Home app can trigger automations when an accessory turns on/off, but it cannot copy exact color values from one light to another. You can still get basic results:

1. **Automation 1:** When "Sim Rig Light" turns **on** → turn on "Desk Lamp"
2. **Automation 2:** When "Sim Rig Light" turns **off** → turn off "Desk Lamp"

This gives you on/off mirroring only. For full color mirroring, Controller for HomeKit or Home+ is strongly recommended.

---

#### Path B: homebridge-plugin-automation (for Homebridge-managed lights)

[homebridge-plugin-automation](https://github.com/grrowl/homebridge-plugin-automation) lets you write JavaScript rules that run directly on the Homebridge server. When the K10 Motorsports virtual light's characteristics change, your script reads the new values and writes them to your physical light — all within the same Homebridge process, no HomeKit round-trip required. This is the lowest-latency option available.

**Important:** This only works for lights that are registered as accessories within the same Homebridge instance (via plugins like homebridge-hue, homebridge-shelly, homebridge-zigbee2mqtt, etc.). It cannot control native HomeKit accessories that weren't created by Homebridge. If your lights are paired directly to HomeKit, use Path A instead.

**Step 1: Install the plugin**

```bash
npm install -g homebridge-plugin-automation
```

Or install it through the Homebridge UI under Plugins.

**Step 2: Enable insecure mode**

homebridge-plugin-automation requires Homebridge to run in insecure mode (`-I` flag) to access other plugins' accessories. In the Homebridge UI, go to **Settings → Homebridge Settings** and add `-I` to the startup flags. If you run Homebridge from the command line, start it with `homebridge -I`.

**Step 3: Create your automation script**

Create a file called `k10-motorsports-lights.js` somewhere accessible to Homebridge (e.g., alongside your `config.json`):

```javascript
// k10-motorsports-lights.js
// Mirrors K10 Motorsports virtual light colors to physical Homebridge lights

// Configuration — change these to match your accessory names
const VIRTUAL_LIGHT = 'Sim Rig Light';       // Name of the K10 Motorsports virtual light
const PHYSICAL_LIGHTS = ['Desk Lamp', 'LED Strip'];  // Names of your real lights

automation.listen(({ serviceName, characteristic, value }) => {
  // Only react to changes on the K10 Motorsports virtual light
  if (serviceName !== VIRTUAL_LIGHT) return;

  // Mirror the characteristic to all physical lights
  for (const target of PHYSICAL_LIGHTS) {
    if (characteristic === 'Hue' ||
        characteristic === 'Saturation' ||
        characteristic === 'Brightness' ||
        characteristic === 'On') {
      automation.set(target, characteristic, value);
    }
  }
});
```

**Step 4: Add the platform to your Homebridge config**

Add this to the `platforms` array in your Homebridge `config.json`:

```json
{
  "platform": "Automation",
  "automationCode": "/path/to/k10-motorsports-lights.js"
}
```

Replace `/path/to/` with the actual path to the script file.

**Step 5: Restart Homebridge**

After restarting, the automation script will load and begin mirroring. Check the Homebridge log for any errors. You should see the physical lights respond within one poll interval (~500ms) of any telemetry change.

**Advanced: per-light mode overrides in the automation script**

If you're using multiple virtual lights with different modes (see Multi-Light Setup below), you can map each virtual light to a different physical light:

```javascript
const LIGHT_MAP = {
  'Overhead MC':  ['Overhead Hue Bulb'],
  'Flag Strip MC': ['Monitor LED Strip'],
  'Ambient MC':   ['Desk Lamp', 'Floor Lamp'],
};

automation.listen(({ serviceName, characteristic, value }) => {
  const targets = LIGHT_MAP[serviceName];
  if (!targets) return;

  if (['Hue', 'Saturation', 'Brightness', 'On'].includes(characteristic)) {
    for (const target of targets) {
      automation.set(target, characteristic, value);
    }
  }
});
```

### 6. Verify end-to-end

With the automation in place:

1. Start a race session in SimHub (or enable Demo mode in the K10 Motorsports plugin settings)
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
  "platform": "RaceCorProDriveLights",
  "name": "K10 Motorsports Lights",
  "simhubUrl": "http://192.168.1.50:8888",
  "mode": "all_colors",
  "enableBlink": true,
  "lights": [
    {
      "name": "Overhead Light",
      "uniqueId": "k10-mc-overhead",
      "mode": "all_colors",
      "enableBlink": true
    },
    {
      "name": "Flag Strip",
      "uniqueId": "k10-mc-flag-strip",
      "mode": "flags_only",
      "enableBlink": true
    },
    {
      "name": "Ambient Backlight",
      "uniqueId": "k10-mc-backlight",
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
- Confirm SimHub's web server is enabled and reachable from the Homebridge host. Try `curl http://<simhub-ip>:8888/api/pluginproperty/RaceCorProDrive.Plugin.CommentaryVisible` from the Homebridge machine.
- Check Homebridge logs for connection errors from the K10 Motorsports Lights plugin.
- Ensure the K10 Motorsports plugin is active in SimHub (look for "RaceCorProDrive.Plugin" in SimHub's plugin list).

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
