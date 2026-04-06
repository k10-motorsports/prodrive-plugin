---
name: incident-coach
description: |
  Behavioral science foundation for the Incident Coach & Driver Behavior System. Use this skill
  when working on rage detection, driver aggression measurement, incident attribution, cool-down
  intervention, voice coaching, or post-session behavior analysis. Also use when the user mentions
  "anger," "rage," "composure," "incident coach," "cool-down," "threat tracking," "behavior score,"
  "aggressive driving detection," or any feature related to managing driver emotional state during
  sim racing sessions.
---

# Incident Coach — Behavioral Science Skill

This skill encodes research-backed principles for detecting, measuring, and intervening in
aggressive driving behavior within a sim racing context. It synthesizes findings from two
academic studies and applies them to the RaceCor Pro Drive platform.

## Research Sources

### Source 1: Abou-Zeid, Kaysi & Al-Naghi (2011)
**"Measuring Aggressive Driving Behavior Using a Driving Simulator: An Exploratory Study"**
3rd International Conference on Road Safety and Simulation, Indianapolis

### Source 2: Kerwin & Bushman (2022)
**"Aggressive Driving and Road Rage: A Series of Driving Simulation Experiments"**
Ohio State University, ClinicalTrials ID: NCT03430973

---

## Core Principles

### 1. State vs Trait Aggressiveness

The research distinguishes two types of aggression that both apply to sim racing:

- **State aggressiveness**: Provoked by events (being brake-checked, pushed off track, dive-bombed).
  This is reactive and temporary but can cascade.
- **Trait aggressiveness**: The driver's baseline tendency toward aggressive behavior.
  Some drivers are simply more prone to rage responses.

**Application**: Our system must handle both. State aggression is what we detect and intervene on
in real-time. Trait aggression can be inferred over multiple sessions (a driver who consistently
scores high on rage metrics may have trait-level tendencies that benefit from earlier, gentler
intervention thresholds).

### 2. The Frustration-Aggression Cascade

**Key finding (Abou-Zeid)**: Frustrating events instigate aggressive driving even in
non-aggressive individuals. The study showed that timid drivers who stopped at the first
intersection were significantly MORE likely to run the second one — the frustration cascaded.

**Key finding (Kerwin)**: Aggression is measured in "regions" between frustrating events, and
each successive event compounds the response. Five frustrating events were used:
car pulling out, traffic jam, construction zone, mimic car, short traffic light.

**Application**: After the FIRST incident in a session, the system should be MORE sensitive,
not less. Each subsequent incident should lower the intervention threshold. The cascade effect
means a driver who shrugs off incident #1 may explode at incident #2. Model this as:

```
effectiveThreshold = baseThreshold * (decayFactor ^ incidentCount)
```

Where `decayFactor` is ~0.85, so after 3 incidents the threshold is roughly 61% of baseline.

### 3. Hostile Attribution Bias

**Key finding (Kerwin)**: The tendency to perceive ambiguous actions as intentional aggression
("he did that on purpose") is a strong predictor of aggressive driving response. Attributing
causality to an offending driver predicts retaliation.

**Application**: Our system should NOT reinforce hostile attribution. Voice prompts must be
carefully worded to avoid implying intent. Instead of "He brake-checked you" (implies intent),
use "Contact with [Name]. Focus forward." The system should de-escalate the narrative, not
amplify it.

**Anti-patterns to avoid in voice prompts**:
- "He did that on purpose" / "That was intentional"
- "He's targeting you" / "He's after you"
- "Get him back" / "Show him"
- Any language that frames the other driver as a deliberate antagonist

**Preferred framing**:
- "That's racing. Stuff happens. Focus on your line."
- "Contact logged. Not worth your safety rating."
- "Incident with [Name]. Let's build a gap."

### 4. Mindfulness as a Protective Factor

**Key finding (Kerwin)**: Mindfulness — "receptive and non-evaluative awareness of present
experiences" — is a protective factor against aggressive driving. Mindful individuals are
less likely to react aggressively to provocation.

**Application**: The cool-down intervention should incorporate mindfulness principles:
- Present-moment focus: "Focus on this corner. Just this one."
- Non-judgmental awareness: "Notice the tension in your hands. Soften your grip."
- Breathing cues: Guide the driver through 4-7-8 breathing without being clinical about it.
  "Breathe in... hold... and out. Good. Now, where's your braking marker?"

### 5. Empathy as a De-escalation Tool

**Key finding (Kerwin)**: Empathy is negatively correlated with aggressive driving. Drivers
who can imagine what the other person is experiencing are less likely to retaliate.

**Application**: Some voice prompts can subtly invoke empathy:
- "Maybe they're having a rough race too."
- "Could've been a lag spike on their end."
- "Everyone makes mistakes. You've done it too."

Use sparingly — during active rage, empathy prompts may backfire. Best used during
cool-down recovery phase.

---

## Measurement Framework

### Aggression Indicators (Simulator-Validated)

These are the specific, statistically significant markers from the Abou-Zeid study.
All were measured in a driving simulator context, making them directly transferable:

| Indicator | What It Measures | Significance |
|:----------|:----------------|:-------------|
| **Maximum velocity** | Peak speed while following/approaching | Aggressive: 8.53 vs Timid: 7.23 (p < 0.10) |
| **Maximum acceleration** | Hardest throttle application | Aggressive: 3.69 vs Timid: 3.25 (p < 0.10) |
| **Minimum following distance** | Closest approach to car ahead | Aggressive: 1.94m vs Timid: 2.91m (p < 0.10) |
| **Average following distance** | Sustained tailgating behavior | Aggressive: 5.45m vs Timid: 6.62m (p < 0.10) |
| **Velocity variability (std dev)** | Erratic speed changes | Higher in aggressive (not significant alone) |
| **Maximum deceleration** | Hardest braking | Higher in aggressive (not significant alone) |
| **Lane deviation** | Weaving / attempting to pass | Higher in aggressive (not significant alone) |

### Following Distance Thresholds (Kerwin — Speed-Adjusted)

The OSU study defines following distance as the **primary measure of driving aggression**,
measured in headway time (seconds between cars):

| Threshold | Classification | Application in Sim Racing |
|:----------|:---------------|:--------------------------|
| > 4 seconds | Safe following | Normal operation — no alerts |
| 3-4 seconds | Adequate | Acceptable in racing context (tighter than road) |
| 2-3 seconds | Close | Elevated in racing — flag if post-incident |
| < 2 seconds | Tailgating | Always aggressive when sustained post-incident |
| < 1 second | Extreme | Likely retaliation or dive-bomb setup |

**Sim racing adjustment**: In competitive racing, close following is normal racecraft (drafting,
setting up passes). The key differentiator is CONTEXT: close following that begins or
intensifies AFTER an incident with that specific driver signals aggression, not racecraft.

### State Anger Scale (Adapted for Real-Time)

The Spielberger State Anger Scale (15 items, 4-point) can't be administered mid-race.
Instead, we infer state anger from behavioral proxies:

| Proxy | Maps To | Weight |
|:------|:--------|:-------|
| Throttle >95% within 3s of incident | "I feel angry" | High |
| Steering oscillation frequency increase | "I feel like banging on the table" | Medium |
| Brake >90% approaching incident partner | "I feel furious" | High |
| Closing gap to incident partner faster than baseline | "I feel like hitting someone" | Very High |
| Sustained full-throttle + weaving | "I am burned up" | Very High |
| Normal driving resumes within 10s | "I feel calm" (inverted) | Reduces score |

### Trait Aggression Inference (Multi-Session)

Over multiple sessions, the system can build a trait profile without a questionnaire:

- **Consistently high rage scores** (>50 average across sessions) → higher trait aggression
- **Frequent cool-down triggers** → elevated trait
- **Fast recovery times** → lower trait (state-reactive but self-correcting)
- **Retaliation attempts** → strong trait signal

This profile should adjust intervention sensitivity: drivers with inferred high trait
aggression get earlier, gentler interventions. The goal is prevention, not reaction.

---

## Intervention Design Principles

### From the Research

1. **Frustration cascades** — Don't wait for the second incident. After the first, lower
   all thresholds by 15%.

2. **Avoid reinforcing hostile attribution** — Never frame the other driver as an enemy.
   The system is the driver's ally, not their co-conspirator.

3. **Mindfulness > confrontation** — Redirect attention to the present driving task, not the
   past incident. "Focus on Turn 3" beats "Forget about that guy."

4. **Empathy in recovery** — Once rage subsides, gentle empathy prompts help prevent the
   next escalation.

5. **Positive reinforcement matters** — The Abou-Zeid study notes that non-aggressive
   behaviors are measurable too. Reward clean driving post-incident: "Three clean laps.
   That's composure."

6. **The 3-second rule isn't arbitrary** — Kerwin uses 3-second following distance as the
   key threshold for normal conditions. In sim racing post-incident, a 2.5-second gap target
   is the recommended intervention threshold.

### Voice Prompt Design Rules

1. **Never more than 2 sentences** — Driver is processing visual information at 30fps+
2. **No questions during active racing** — "Are you okay?" is dangerous mid-corner
3. **Calm, low pitch, slightly slow** — Research shows low-frequency sounds are calming
4. **3-second minimum gap between utterances** — Prevents audio clutter
5. **Priority system** — Urgent prompts can interrupt informational ones, never the reverse
6. **Positive prompts need no acknowledgment** — "Nice pass" should feel like background
7. **Critical prompts should be repeated once** — If rage score stays above 70 for 10s

### Cool-Down Mode Design Rules

1. **Minimum 20 seconds** — Research shows anger peaks need at least this long to subside
2. **Visual: peripheral only** — Never obscure racing line, mirrors, or speed indicators
3. **Audio: breathing rhythm** — 4-count in, 7-count hold, 8-count out (research-standard)
4. **Gap target: 2.5 seconds minimum** — From the following-distance research
5. **Exit criteria: rage < 30 AND gap > 2.5s** — Both conditions must be met
6. **Positive exit message** — "Good. Gap established. Back to racing."

---

## Architecture Reference

### Feature Spec
Full technical specification: `docs/FEATURE_SPEC_INCIDENT_COACH.md`

### Existing Modules to Extend
- `racecor-overlay/modules/js/spotter.js` — Stacking message system (threat approach alerts)
- `racecor-overlay/modules/js/incidents.js` — Incident counter (trigger for attribution)
- `racecor-overlay/modules/js/leaderboard.js` — Driver entries (threat highlighting)
- `racecor-overlay/modules/components/drive-hud.js` — Track map (danger zone rings)

### New Modules to Create
- `racecor-overlay/modules/js/voice-coach.js` — Web Speech API TTS system
- `racecor-overlay/modules/js/incident-coach.js` — Threat tracking, rage scoring, cool-down
- `racecor-plugin/.../IncidentCoachEngine.cs` — Attribution, behavior metrics, rage score
- `racecor-plugin/.../IIncidentDetector.cs` — Sim abstraction interface

### Plugin Properties (HTTP API)
```
RaceCorProDrive.Plugin.DS.IncidentCoach.Active
RaceCorProDrive.Plugin.DS.IncidentCoach.LastIncidentAt
RaceCorProDrive.Plugin.DS.IncidentCoach.ThreatDrivers      // JSON array
RaceCorProDrive.Plugin.DS.IncidentCoach.ActiveAlert         // JSON
RaceCorProDrive.Plugin.DS.IncidentCoach.RageScore           // 0-100
RaceCorProDrive.Plugin.DS.IncidentCoach.CooldownActive      // bool
RaceCorProDrive.Plugin.DS.IncidentCoach.SessionBehavior     // JSON
RaceCorProDrive.Plugin.DS.IncidentCoach.SessionReport       // JSON (post-session)
```

---

## Implementation Checklist

When implementing any part of the Incident Coach system, verify:

- [ ] Voice prompts never reinforce hostile attribution bias
- [ ] Frustration cascade multiplier is applied after each incident
- [ ] Following distance thresholds are context-aware (post-incident vs normal racing)
- [ ] Cool-down vignette does not obscure racing-critical UI elements
- [ ] Breathing animation uses 4-7-8 rhythm (4s in, 7s hold, 8s out)
- [ ] Positive reinforcement prompts fire after 3+ clean laps post-incident
- [ ] Master toggle default is OFF (opt-in feature)
- [ ] Rage score decay follows 30-second window from research
- [ ] Empathy prompts only fire during recovery phase, not active rage
- [ ] Multi-session trait inference persists to local storage
