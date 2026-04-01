---
name: iracing-to-lmu
description: >
  Port iRacing-specific features to Le Mans Ultimate (LMU) in the K10 Motorsports SimHub plugin codebase.
  Use this skill whenever working on LMU support, rFactor 2 telemetry integration, cross-game compatibility,
  or porting any iRacing-only feature to work with LMU/rF2. Trigger on mentions of "LMU", "Le Mans Ultimate",
  "rFactor", "rF2", "cross-game", "port to LMU", "multi-sim support", "game-specific telemetry", or any
  task that involves making iRacing features work in other sims. Also trigger when someone asks about
  telemetry mapping, shared memory properties, or SimHub game-specific property paths — even if they don't
  mention LMU by name. If someone says "make this work for other games" or "why doesn't X work in LMU",
  this is your skill.
---

# iRacing → Le Mans Ultimate Porting Skill

You are porting iRacing-specific features in the K10 Motorsports plugin to work with Le Mans Ultimate
(LMU). LMU runs on the rFactor 2 engine (Studio 397 / Motorsport Games), so its telemetry comes from
the rF2 shared memory system. The goal is to make LMU a first-class citizen alongside iRacing — not a
degraded fallback experience.

## Architecture Context

The K10 Motorsports codebase has four major components:

1. **SimHub Plugin** (C# .NET 4.8) — Telemetry capture, trigger evaluation, commentary engine, strategy
2. **Electron Overlay** (Vanilla JS) — Dashboard HUD rendering
3. **Homebridge Plugin** (TypeScript) — HomeKit smart light integration
4. **Next.js Web Platform** — Marketing site

Porting work lives almost entirely in the **SimHub Plugin**, specifically in these files:

| File | Role | Porting Relevance |
|------|------|-------------------|
| `TelemetrySnapshot.Capture.cs` | Game-specific telemetry reads | **PRIMARY** — all property mapping lives here |
| `TelemetrySnapshot.cs` | Data model (fields + types) | Add new fields if LMU exposes data iRacing doesn't |
| `IRacingSdkBridge.cs` | Direct iRacing SDK access | **REFERENCE ONLY** — shows what iRacing provides natively |
| `TrackMapProvider.cs` | SVG track map from dead reckoning | Verify velocity/heading works for LMU |
| `CommentaryEngine.cs` | Trigger evaluation + prompt selection | Mostly game-agnostic, but check trigger thresholds |
| `Strategy/*.cs` | Fuel + tire strategy | Game-agnostic, but verify telemetry feeds are populated |
| `Plugin.cs` | Entry point, HTTP API, property registration | Demo mode forces GameId to "iRacing" |

## How Game Detection Works

```csharp
private enum GameId { Unknown, IRacing, ACC, AC, ACEvo, ACRally, LMU, RaceRoom, EAWRC, Forza }

private static GameId DetectGame(string gameName)
{
    // Matches "lemans", "lmu", or "rfactor" → GameId.LMU
    // iRacing matches "iracing" → GameId.IRacing
}
```

LMU and rFactor 2 are treated identically (both map to `GameId.LMU`). SimHub reports the game name
and the plugin normalizes it.

## How Telemetry Properties Are Read

Two access patterns exist side by side:

```csharp
// 1. SimHub normalized properties (cross-game, via GameData)
float speed = GetNorm<float>(d, "SpeedKmh");

// 2. Game-specific raw properties (via PluginManager)
float steer = GetRaw<float>(pm, "Telemetry.mUnfilteredSteering", "DataCorePlugin.GameRawData.");
```

**Rule of thumb:** Use SimHub normalized properties as the primary source. Fall back to raw rF2 shared
memory properties only when SimHub doesn't expose what you need (or exposes it incorrectly).

### Raw Property Path Convention for LMU / rF2

rFactor 2 shared memory data is accessed through SimHub at paths like:
```
DataCorePlugin.GameRawData.Telemetry.<fieldName>
DataCorePlugin.GameRawData.Scoring.mScoringInfo.<fieldName>
DataCorePlugin.GameRawData.Scoring.mVehicles[0].<fieldName>
```

The `GetRaw<T>(pm, path, prefix)` helper prepends the prefix automatically.

---

## The Porting Checklist

When porting an iRacing feature to LMU, work through this checklist for each telemetry field:

### Step 1: Identify the iRacing Source

Find the iRacing property being read. It's usually one of:
- **Direct SDK variable** via `GetRaw<T>(pm, "VariableName")` — e.g., `SteeringWheelAngle`, `dcBrakeBias`
- **IRacingSdkBridge field** — e.g., `_sdkBridge.PlayerIRating` (parsed from session YAML)
- **iRacing-specific SimHub property** — e.g., `IRacingExtraProperties.iRating`

### Step 2: Find the rF2 / LMU Equivalent

Consult the telemetry mapping reference (`references/telemetry-mapping.md`). The rF2 shared memory
exposes data through these buffer types:

| Buffer | Update Rate | Content |
|--------|-------------|---------|
| Telemetry | ~50 FPS | Vehicle dynamics, driver inputs, tire/suspension |
| Scoring | ~5 FPS | Lap times, positions, pit status, flag state |
| Rules | ~3 FPS | Session rule state |
| Extended | ~5 FPS | Additional vehicle/session data |
| ForceFeedback | ~400 FPS | FFB calculations |

Common LMU raw property paths:

```
Telemetry.mUnfilteredThrottle      — throttle (0-1)
Telemetry.mUnfilteredBrake         — brake (0-1)
Telemetry.mUnfilteredSteering      — steering (-1 to +1, normalized)
Telemetry.mUnfilteredClutch        — clutch (0-1, 1=disengaged in rF2)
Telemetry.mGear                    — gear (-1=R, 0=N, 1-8=forward)
Telemetry.mEngineRPM               — RPM
Telemetry.mSpeed                   — speed (m/s, NOT km/h!)
Telemetry.mFuel                    — fuel level (liters)
Telemetry.mBatteryChargeFraction   — ERS/hybrid battery (0-1)
Telemetry.mRearFlapLegalStatus     — DRS legality (0=none, 1=available, 2=active)
Telemetry.mSpeedLimiter            — pit limiter active (bool)
Telemetry.mTractionControl         — TC setting (float)
Telemetry.mAntiLockBraking         — ABS setting (float)
Telemetry.mRearBrakeBias           — rear brake bias (0-1)
Telemetry.mSteeringArmForce        — FFB force
Telemetry.mHighestFlagColor        — flag color enum
Telemetry.mLocalAccel              — local acceleration vector (m/s²)

Scoring.mScoringInfo.mGamePhase    — session state (enum)
Scoring.mScoringInfo.mNumVehicles  — number of cars in session
Scoring.mVehicles[N].mLapDist      — car N's distance around track
Scoring.mVehicles[N].mInPits       — car N in pit lane (bool)
Scoring.mVehicles[N].mTotalLaps    — car N's completed laps
Scoring.mVehicles[N].mIsPlayer     — is this the player? (bool)
```

### Step 3: Handle Unit Conversions

This is where most bugs hide. Key conversions:

| Field | iRacing | LMU/rF2 | Conversion |
|-------|---------|---------|------------|
| Speed | m/s | m/s | None (but verify SimHub isn't pre-converting) |
| Steering angle | radians | -1 to +1 ratio | Multiply by car's max steer angle (if available) or by π |
| Brake bias | front % (0-100) | rear ratio (0-1) | `frontPct = (1 - rearBias) * 100` |
| Acceleration | m/s² | m/s² | `G = value / 9.80665` |
| Clutch | 0=out, 1=in | 0=engaged, 1=disengaged | May need inversion depending on SimHub normalization |
| Fuel | liters | liters | None (but iRacing sometimes uses gallons in UI) |
| Tire wear | 1=new, 0=worn (iRacing raw) | varies | Plugin convention: 0=new, 1=worn. Check direction. |
| Tire temps | °C | °C | None, but verify inner/middle/outer mapping |

### Step 4: Add the LMU Case to the Game Switch

The existing pattern in `TelemetrySnapshot.Capture.cs` uses either:

```csharp
// Pattern A: if/else chain
if (detectedGame == GameId.IRacing)
    value = GetRaw<float>(pm, "iRacingProperty");
else if (detectedGame == GameId.LMU)
    value = GetRaw<float>(pm, "Telemetry.mLmuProperty", "DataCorePlugin.GameRawData.");
else
    value = GetNorm<float>(d, "SimHubNormalizedProperty");

// Pattern B: switch in a helper method
private float GetBrakeBias(GameId game, PluginManager pm, GameData d)
{
    switch (game)
    {
        case GameId.IRacing: return GetRaw<float>(pm, "dcBrakeBias");
        case GameId.ACC:     return GetRaw<float>(pm, "Physics.BrakeBias", prefix) * 100f;
        case GameId.LMU:     return (1f - GetRaw<float>(pm, "Telemetry.mRearBrakeBias", prefix)) * 100f;
        default:             return (float)d.NewData.BrakeBias;
    }
}
```

**Prefer Pattern B** for new code — it's cleaner and easier to extend. When modifying existing Pattern A
code, match the existing style for consistency.

### Step 5: Test with Null/Zero Guards

rF2 shared memory fields can be 0 or null before a session loads, or during transitions. Always guard:

```csharp
float raw = GetRaw<float>(pm, "Telemetry.mSomeField", prefix);
if (raw != 0 || sessionRunning)
    s.SomeField = ConvertUnits(raw);
// else: leave at default (0 or previous value)
```

### Step 6: Verify the Downstream Consumer

Trace how the field is used after capture:
- **CommentaryEngine** — Check trigger thresholds. A trigger set for iRacing's scale may not fire
  correctly for LMU values. Example: if yaw rate thresholds assume radians but LMU provides a
  different scale.
- **StrategyCoordinator** — Verify fuel/tire data flows correctly. The strategy engine is game-agnostic
  but depends on `TelemetrySnapshot` being populated.
- **Dashboard overlay** — The JSON API serves raw snapshot values. If LMU units differ from iRacing,
  the overlay may display garbage.
- **Homebridge** — Color mapping uses flags and severity. Verify LMU flags trigger the same codes.

---

## Known LMU Gaps (Current State of the Codebase)

These are the features that are currently broken or missing for LMU. Consult the reference doc
(`references/telemetry-mapping.md`) for the full mapping table.

### Critical Gaps (Features Return 0 or Empty for LMU)

1. **ABS Setting** — No `case GameId.LMU` in the ABS helper. Falls through to iRacing's `dcABS`
   which doesn't exist in LMU. Fix: map to `Telemetry.mAntiLockBraking`.

2. **Pit Speed Limit** — No LMU handling. iRacing uses `PitSpeedLimit` (m/s). LMU needs its own
   source or a hardcoded fallback (most LMU series use 60 km/h pit limit).

3. **Pit Menu Selections** — Fuel amount, tire pressures, compound choice. iRacing has `PitSv*`
   variables; LMU has no equivalent mapped. The pitbox panel shows empty for LMU.

4. **Multi-Car Arrays** — `CarIdxLapDistPct`, `CarIdxOnPitRoad`, `CarIdxLapCompleted` are iRacing-only
   per-car arrays. LMU returns empty arrays. This breaks:
   - Gap-to-car-ahead/behind calculations
   - Track map opponent dots
   - Proximity/spotter warnings
   - **Fix:** Build arrays from `Scoring.mVehicles[N]` data (iterate mNumVehicles).

5. **Sector Boundaries** — iRacing provides precise boundaries from session YAML. LMU falls back to
   equal thirds (33%/67%). rF2 scoring may have sector data in `mVehicles[N].mSector` — investigate
   whether `mCurSector1/2` provides boundaries.

### Partial Gaps (Features Work But Incorrectly)

6. **Steering Angle** — LMU reads `mUnfilteredSteering` (-1 to +1) but stores it without converting
   to radians. Dashboard and commentary engine expect radians. Fix: multiply by estimated max steer
   (or by π as approximation).

7. **Session Flags** — Green, yellow, blue, black, white are mapped. Missing: red flag, debris flag,
   checkered flag. The `mGamePhase` enum may have additional states for these.

8. **Steering Torque** — Uses `mSteeringArmForce` which is force (Newtons), not torque (Nm). The
   distinction matters for FFB analysis in commentary.

### iRacing-Only Features (No LMU Equivalent)

These genuinely don't exist in LMU and should degrade gracefully:

- **iRating / Safety Rating / License** — iRacing's competitive rating system. Commentary engine
  already falls back to generic "the driver" phrasing.
- **Incident Limits** — iRacing tracks incidents toward penalty/DQ thresholds. LMU has penalties
  but not the same escalation system.
- **In-Car Adjustments** — iRacing's `dc*` variables (ARB, engine power, fuel mixture, weight jacker,
  wing angles). LMU may expose some via rF2 telemetry but the property names differ completely.

---

## Coding Conventions in This Codebase

Follow these when writing LMU porting code:

### Property Access Helpers
```csharp
// Normalized (cross-game via SimHub)
T GetNorm<T>(GameData d, string propName)

// Raw game-specific (with optional prefix)
T GetRaw<T>(PluginManager pm, string propName, string prefix = "DataCorePlugin.GameRawData.")

// Raw array (iRacing per-car data)
T[] GetRawArray<T>(PluginManager pm, string propName)
```

### Constants
```csharp
private const float MsToG = 1f / 9.80665f;  // m/s² → G conversion
private const string Rf2Prefix = "DataCorePlugin.GameRawData.";  // rF2 raw property prefix
```

### Naming
- LMU fields use `mCamelCase` prefix from rF2 (e.g., `mUnfilteredSteering`, `mRearBrakeBias`)
- iRacing fields use PascalCase or dcCamelCase (e.g., `SteeringWheelAngle`, `dcBrakeBias`)
- SimHub normalized fields use PascalCase (e.g., `SpeedKmh`, `BrakeBias`)

### Testing
- Unit tests live in `racecor-plugin/simhub-plugin/tests/K10Motorsports.Tests/`
- Use NUnit framework
- Mock `PluginManager` and `GameData` for telemetry tests
- Dataset validation in `tests/validate_datasets.py`

### Documentation
- Add `// LMU: <explanation>` comments on every game-specific branch
- Reference rF2 shared memory field names in comments
- Note unit conversions with before/after units: `// rF2 rear bias (0-1) → front % (0-100)`

---

## Multi-Car Data Porting Strategy

This is the most complex porting task because iRacing exposes flat per-car arrays while rF2 uses
a structured vehicle list. Here's the recommended approach:

### iRacing Model (Current)
```csharp
s.PlayerCarIdx = GetRaw<int>(pm, "PlayerCarIdx");
s.CarIdxLapDistPct = GetRawArray<float>(pm, "CarIdxLapDistPct");  // [64] array
s.CarIdxOnPitRoad = GetRawArray<bool>(pm, "CarIdxOnPitRoad");
s.CarIdxLapCompleted = GetRawArray<int>(pm, "CarIdxLapCompleted");
```

### LMU Equivalent (To Build)
```csharp
case GameId.LMU:
    int numVehicles = GetRaw<int>(pm, "Scoring.mScoringInfo.mNumVehicles", Rf2Prefix);
    var lapDist = new float[numVehicles];
    var onPit = new bool[numVehicles];
    var lapsCompleted = new int[numVehicles];
    int playerIdx = 0;

    for (int i = 0; i < numVehicles; i++)
    {
        string veh = $"Scoring.mVehicles[{i}].";
        lapDist[i] = GetRaw<float>(pm, veh + "mLapDist", Rf2Prefix);
        onPit[i] = GetRaw<bool>(pm, veh + "mInPits", Rf2Prefix);
        lapsCompleted[i] = GetRaw<int>(pm, veh + "mTotalLaps", Rf2Prefix);
        if (GetRaw<bool>(pm, veh + "mIsPlayer", Rf2Prefix))
            playerIdx = i;
    }

    // Normalize lapDist to 0-1 range (rF2 uses meters, need track length)
    float trackLength = GetRaw<float>(pm, "Scoring.mScoringInfo.mLapDist", Rf2Prefix);
    if (trackLength > 0)
        for (int i = 0; i < numVehicles; i++)
            lapDist[i] /= trackLength;

    s.PlayerCarIdx = playerIdx;
    s.CarIdxLapDistPct = lapDist;
    s.CarIdxOnPitRoad = onPit;
    s.CarIdxLapCompleted = lapsCompleted;
    break;
```

**Important:** rF2's `mLapDist` is in meters (distance from start), not percentage. Divide by
`mScoringInfo.mLapDist` (total track length in meters) to get 0-1 percentage matching iRacing's
`CarIdxLapDistPct` convention.

**Performance note:** This loop runs every ~100ms (6th frame). With 60 cars max, 60 iterations
of `GetRaw` calls is acceptable but should be profiled. If slow, consider caching the scoring buffer
read.

---

## rF2 Shared Memory Enums

### mGamePhase (Session State)
```
0 = Before session has begun
1 = Reconaissance laps
2 = Grid walk-through
3 = Formation lap
4 = Starting light countdown
5 = Green flag (race running)
6 = Full course yellow / safety car
7 = Session stopped
8 = Session over
9 = Pause (if enabled)
```

### mHighestFlagColor (Per-Driver Flag)
```
0 = None
1 = Green
2 = Blue
3 = Yellow
4 = Red (not currently mapped!)
5 = Black
6 = White
7 = Checkered
```

### mFinishStatus
```
0 = None (still racing)
1 = Finished
2 = DNF
3 = DQ
```

---

## Verification Strategy

After porting a feature, verify it works by checking these layers:

1. **Telemetry Snapshot** — Is the field populated with sensible values during an LMU session?
2. **HTTP API output** — Does `GET /k10mediabroadcaster/` include the correct value?
3. **Dashboard overlay** — Does the relevant panel display correctly?
4. **Commentary triggers** — Do triggers fire at appropriate thresholds for LMU data scale?
5. **Strategy calculations** — Do fuel/tire estimates still make sense?
6. **Homebridge colors** — Do flags map to the correct light colors?

If you can't run a live LMU session, write unit tests with mock rF2 telemetry data that exercises
the new code paths. The existing test suite in `K10Motorsports.Tests` has patterns for this.

---

## Output Format

When completing a porting task, structure your output as:

### Porting Report: [Feature Name]

**Status:** [Complete / Partial / Blocked]
**Files Changed:**
- `path/to/file.cs` — [what changed]

**Telemetry Mapping:**
| Field | iRacing Source | LMU Source | Conversion |
|-------|---------------|------------|------------|

**Testing:**
- [ ] Unit test added/updated
- [ ] Null/zero guard in place
- [ ] Downstream consumers verified

**Known Limitations:**
- [anything that can't be fully ported]

**Code Changes:**
[The actual diffs or new code]
