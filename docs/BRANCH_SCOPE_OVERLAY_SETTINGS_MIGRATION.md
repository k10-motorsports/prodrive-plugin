#  Branch: `feat/overlay-settings-migration`

Working scope tracker for the overlay ↔ web-app architectural inversion.

## Goal

Invert the parent/child relationship between the Electron overlay and the web app.

**Before:** The overlay is the primary Electron window. The web dashboard opens as a secondary BrowserWindow on demand.

**After:**
- The web app (Pro Drive) is the **default** Electron window — opens at app start.
- The overlay window is **session-only** — hidden at startup, revealed only when `isInRace` becomes true.
- All configuration UI lives in the web app at `/drive/admin/overlay-settings`, hidden from nav when running outside the Electron shell.
- The overlay becomes **read-only, race-only**. Only Connections, Moza, and Recording controls remain in the overlay (they either require Electron APIs or are live-device-coupled).

## Decisions (captured from conversation)

| Question | Answer |
|----------|--------|
| Scope | Full inversion + settings migration in one branch |
| Branch name | `feat/overlay-settings-migration` |
| Old settings UI | Remove in this branch (keep only Connections / Moza / Recording) |
| Session signal | New `isInRace` signal (derived from `GameRunning` + `Grid.SessionState > 0`, with demo-mode treated as in-race so the overlay previews) |

## Repositories touched

Both repos get a matching `feat/overlay-settings-migration` branch.

| Repo | Role |
|------|------|
| `alternatekev/k10-motorsports` (`racecor.io/racecorio-prodrive`) | Overlay sources + monorepo `racecor-overlay/` |
| `alternatekev/racecor-prodrive-server` (`racecor.io/racecor-prodrive-server`) | Next.js web app at `apps/web` |

## Implementation plan — checklist

### Phase A — Architecture + scaffolding ✅

- [x] Document scope (this file)
- [x] **isInRace signal** — compute in `poll-engine.js`, emit via preload, consume in main
- [x] **preload.js** — `notifyInRaceState` / `onInRaceState` / `getInRaceState`
- [x] **main.js** — web-app window is the default; overlay created hidden; `notify-in-race-state` toggles visibility; green-screen mode bypasses inversion
- [x] **Web types** — `src/types/overlay-settings.ts` (all ~45 keys + literal-union types)
- [x] **Web hooks** — `useElectronBridge.ts` checks `window.k10`; `useOverlaySettings.ts` loads + saves with optimistic apply and rollback
- [x] **Web route skeleton** — `/drive/admin/overlay-settings/page.tsx` + `OverlaySettingsForm` container
- [x] **AdminNav** — conditional "Overlay" tab when `hasBridge`

### Phase B — Section components ✅

All nine sections wired against the shared form primitives
(`fields/Toggle`, `NumberField`, `TextField`, `SelectField`, `RadioGroup`,
`SliderField`, `FieldRow`):

- [x] DashboardModules (13 toggles)
- [x] VisualEffects (preset + theme + ambient + 8 effect toggles)
- [x] LayoutPosition (zoom, corner, Y-offset)
- [x] Branding (3 logo toggles, subtitle)
- [x] Leaderboard (focus, max rows, expand)
- [x] Datastream (6 field toggles)
- [x] AICoach (key, tone, depth)
- [x] RaceRules (incident thresholds, flag override)
- [x] Modes (rally, drive)

### Phase C — Overlay cleanup (follow-up)

- [ ] Remove settings sections from `dashboard.html` (keep Connections / Moza / Recording)
- [ ] Gut `settings.js` (keep quick-settings strip only)
- [ ] Build quick-settings strip (visualPreset, zoom, webGL, leaderboard/commentary quick toggles)
- [ ] Update overlay "Settings" button to `k10.openDashboard('/drive/admin/overlay-settings')`

### Phase D — Verification

- [ ] Run full Playwright suite; all 95 passing
- [ ] New Playwright test: overlay hidden until isInRace
- [ ] New Playwright test: web settings write → overlay live-update via onSettingsSync
- [ ] Manual smoke: start app → web window opens → start iRacing → overlay appears → leave session → overlay hides
- [ ] Screenshot new settings UI for the user

## Architecture notes

### isInRace signal

Derived from existing idle-detection logic in `poll-engine.js` (lines ~215–298):

```javascript
// Existing:
const gameRunning = +v('DataCorePlugin.GameRunning') || 0;
const realSessNum = parseInt(vs('RaceCorProDrive.Plugin.Grid.SessionState')) || 0;
const nowIdle = !_demo && (!gameRunning || realSessNum === 0);

// New (semantically the inverse, with explicit demo-mode handling):
const nowInRace = !!_demo || (gameRunning && realSessNum > 0);
```

Demo mode forces `isInRace = true` so the overlay is visible during demo previews.

Emitted via new IPC channel `notify-in-race-state` on every flip (not every frame).

### Electron shell architecture

```
App start
  ├─ createWebAppWindow()     ← default/visible — loads prodrive.racecor.io or http://localhost:3000
  └─ createOverlayWindow()    ← created but hidden (show:false)

poll-engine runs in the overlay renderer (even while hidden)
  → polls http://localhost:8889 every 33ms
  → emits isInRace flip via notifyInRaceState(true/false)

Main process:
  on('in-race-state', true)  → overlayWindow.showInactive() + always-on-top + click-through
  on('in-race-state', false) → overlayWindow.hide()
```

The overlay window's polling drives state even while hidden — cheap work, keeps the signal fresh. The main process is the only owner of window visibility.

### Why keep Connections / Moza / Recording in the overlay

- **Connections**: OAuth flow token lifecycle + live SimHub/Discord/remote-server status. Action buttons, not config.
- **Moza hardware**: Real-time wheelbase state — reads via SimHub HTTP action endpoints, debounced writes to the hardware. No settings file coupling.
- **Recording**: Tightly coupled to the ffmpeg encoder state machine. `navigator.mediaDevices.enumerateDevices()` returns different results in the web BrowserWindow context — blocker for moving device config. Revisit in Phase 4 of the original plan.

## Non-goals for this branch

- Rewriting Moza settings UI (stays vanilla, stays in overlay).
- Rewriting Recording UI (stays vanilla, stays in overlay).
- Changing the underlying settings-file format or location.
- Changing the SimHub HTTP polling contract.

## Risks

| Risk | Mitigation |
|------|------------|
| Users boot the app, don't know where settings went | Overlay still opens its own click-through window for the race view, but the very first thing users see is the web window. A clear "Settings" link in its nav replaces the old overlay gear icon. |
| Web window closing while in a race | Decouple overlay visibility from web window lifecycle. Overlay owns its own window handle. |
| `isInRace` flapping (e.g. brief SessionState=0 during session transitions) | Add short debounce — only hide the overlay after `isInRace === false` for ≥2 seconds. Show immediately on flip to true. |
| OBS/broadcaster users depend on overlay-only workflow | Add an "always show overlay" setting for broadcast setups (default off). Phase B. |

## Commit strategy

Small commits, one per bullet in the Phase A checklist above. Prefix with `refactor(overlay):` or `feat(web):` so `git log` is scannable.
