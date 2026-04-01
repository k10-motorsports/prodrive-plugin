---
name: race-coach
description: |
  AI Race Coach system prompt and integration for the RaceCor overlay's post-race analysis feature.
  Use this skill whenever working on the AI-powered race commentary, modifying the system prompt sent
  to the Anthropic API, adjusting tone/depth configurations, changing the race data schema, or
  debugging the post-race AI analysis flow. Also use when the user mentions "race coach," "AI analysis,"
  "post-race commentary," "coaching prompt," or wants to tune how the AI interprets telemetry data.
---

# AI Race Coach Skill

This skill governs the system prompt, data packaging, and API integration that powers the
AI Race Coach feature in RaceCor's post-race results screen.

## Architecture

The race coach lives in two files:

1. **`racecor-overlay/modules/js/race-coach.js`** — The runtime module (IIFE pattern).
   Contains the system prompt builder, tone/depth configs, Anthropic API call, and response renderer.

2. **`racecor-overlay/modules/js/race-results.js`** — Calls `generateRaceAnalysis()` when
   the user clicks the "Generate AI Analysis" button in the results screen.

Supporting changes:
- `config.js` — `agentKey`, `coachTone`, `coachDepth` in `_defaultSettings`
- `connections.js` — `updateAgentKey()`, `updateCoachTone()`, `updateCoachDepth()`, `_populateCoachSettings()`
- `dashboard.html` — Agent key input + tone/depth selectors in the K10 connections panel
- `race-results.css` — `.rr-ai-*` classes for rendered analysis sections

## System Prompt Design

The prompt is assembled dynamically from three parts:

### Role (tone-dependent)
Three personas, selected by `_settings.coachTone`:

| Key | Persona | Style |
|---|---|---|
| `broadcast` | Broadcast Commentator | Dramatic, vivid, narrative-driven (Sky F1 debrief) |
| `coach` | Racing Engineer | Analytical, data-referencing, direct (engineer debrief) |
| `mentor` | Friendly Mentor | Encouraging, explains the "why," casual tone |

When modifying tones, the key principle is: each tone should produce noticeably different text
that a user could distinguish blindfolded. If two tones sound similar, push them further apart.

### Depth (cost-controlling)
Three profiles, selected by `_settings.coachDepth`:

| Key | Model | Max Tokens | Approx Cost | Output |
|---|---|---|---|---|
| `quick` | claude-haiku-4-5 | 350 | ~$0.01 | Summary paragraph only |
| `standard` | claude-sonnet-4-6 | 800 | ~$0.05 | Full structured sections |
| `deep` | claude-sonnet-4-6 | 1500 | ~$0.15 | Detailed analysis + strategy |

The depth setting primarily controls cost via model selection and token limits, but also
adjusts the prompt instructions to match — quick asks for brevity, deep asks for granularity.

### Data Schema
The race data JSON sent as the user message includes:

```
position, trackName, carModel, totalLaps, currentLap, bestLapTime,
lapTimes[], positions[], incidents, iRatingDelta,
fuelLevels[], tyreTempAvg[], commentaryLog[]
```

See `references/data-schema.md` for the full schema with types and descriptions.

### Output Format
The model returns a JSON object (no surrounding text):

**Quick:** `{ summary }`
**Standard:** `{ summary, paceAnalysis, keyMoments, improvements[], nextFocus }`
**Deep:** Standard + `{ strategyNote }`

## Prompt Engineering Guidelines

When iterating on the system prompt in `race-coach.js`:

- Always reference specific data points in examples — "Lap 7 was your fastest at 1:42.3"
  rather than "you had some fast laps." The prompt should encourage this behavior.
- The prompt asks for JSON output. If the model wraps it in markdown fences, the code
  strips them before parsing. This is intentional — don't add instructions to avoid fences,
  as it wastes tokens and the strip is reliable.
- Keep the schema description concise. The model doesn't need field-level documentation
  for obvious fields like `trackName`. Focus documentation on fields with non-obvious
  semantics (e.g., `iRatingDelta` can be negative, `position: 0` means DNF).
- Test with demo mode data (uniform lap times, predictable positions) — the prompt
  explicitly handles this case and should still produce useful-sounding analysis.

## API Integration Notes

- Uses `anthropic-dangerous-direct-browser-access: true` header because the overlay
  runs in SimHub's embedded Chromium (CEF), not a public website.
- API key is stored locally in `_settings.agentKey`, persisted via `saveSettings()`.
- Error handling renders inline in `#rrAIResult` with retry capability.
- The button text cycles: "Generate AI Analysis" → "Analyzing..." → "Regenerate Analysis" / "Retry Analysis".

## Testing

To test the race coach flow without running a full race:
1. Enable demo mode in the overlay
2. Trigger a checkered flag (or call `showRaceResults(p, true)` from console)
3. Click "Generate AI Analysis" — the demo data will be sent to the API

For prompt iteration without API costs, you can log the built prompt:
```js
// In race-coach.js, temporarily add to generateRaceAnalysis:
console.log('[RaceCoach] System prompt:', systemPrompt);
console.log('[RaceCoach] Race data:', raceDataJSON);
```
