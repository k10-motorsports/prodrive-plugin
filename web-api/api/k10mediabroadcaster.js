// K10 Motorsports — Vercel Mock Telemetry Server
// Serves the same flat JSON blob the SimHub plugin produces,
// driven by wall-clock time so every request gets a coherent snapshot.

// ═══════════════════════════════════════════════════════════════
// TRACK DATA — Sebring International
// ═══════════════════════════════════════════════════════════════

const SEBRING_SVG = 'M 58.9,71.8 C 64.2,72.1 62.3,72.0 64.0,72.1 C 65.7,72.1 67.3,72.3 69.0,72.2 C 70.6,72.0 72.5,72.0 73.7,71.2 C 75.0,70.3 75.8,68.6 76.3,67.1 C 76.9,65.6 76.9,63.8 77.0,62.1 C 77.0,60.4 76.7,58.7 76.5,56.9 C 76.2,55.2 75.8,53.6 75.5,51.8 C 75.2,50.1 74.9,48.3 74.8,46.5 C 74.7,44.8 75.0,43.0 74.9,41.3 C 74.7,39.7 74.8,37.6 74.0,36.4 C 73.1,35.3 71.2,35.2 69.7,34.5 C 68.2,33.9 66.6,32.9 65.0,32.4 C 63.5,32.0 61.6,31.2 60.3,31.8 C 59.0,32.3 58.2,34.2 57.3,35.6 C 56.5,37.0 56.0,38.7 55.0,40.1 C 54.0,41.5 52.6,42.9 51.3,44.0 C 50.0,45.1 48.7,45.9 47.3,46.8 C 45.8,47.6 44.1,48.4 42.4,49.0 C 40.6,49.5 38.7,49.9 36.8,50.2 C 34.9,50.4 32.9,50.4 30.9,50.4 C 28.9,50.4 26.8,50.3 24.8,50.3 C 22.7,50.3 20.5,50.4 18.5,50.4 C 16.6,50.4 14.7,50.4 12.9,50.4 C 11.2,50.4 9.3,50.9 8.0,50.4 C 6.7,49.8 5.2,48.6 5.1,47.3 C 5.0,46.1 6.6,44.5 7.4,43.0 C 8.2,41.6 8.8,40.0 9.9,38.7 C 11.0,37.4 12.4,36.0 13.9,35.1 C 15.4,34.1 17.1,33.5 18.8,32.8 C 20.4,32.1 22.3,31.5 23.9,30.9 C 25.6,30.2 27.3,29.7 28.7,28.9 C 30.2,28.1 31.3,27.2 32.5,26.2 C 33.8,25.2 34.9,24.0 36.0,22.9 C 37.2,21.8 38.2,20.7 39.4,19.5 C 40.6,18.3 41.9,16.8 43.1,15.7 C 44.4,14.5 45.7,12.9 47.0,12.7 C 48.3,12.6 49.7,13.9 50.9,14.8 C 52.2,15.7 53.2,17.3 54.6,18.0 C 56.0,18.8 57.7,19.2 59.3,19.2 C 61.0,19.1 62.9,18.4 64.5,17.8 C 66.1,17.3 67.4,16.4 69.0,16.0 C 70.5,15.6 72.2,15.6 73.9,15.5 C 75.6,15.4 77.7,15.0 79.1,15.5 C 80.4,16.1 81.7,17.6 82.2,19.0 C 82.7,20.4 82.1,22.2 82.1,24.0 C 82.0,25.8 82.0,27.8 81.9,29.6 C 81.9,31.3 81.8,32.8 81.8,34.5 C 81.7,36.1 81.7,37.9 81.6,39.5 C 81.6,41.1 81.3,42.6 81.3,44.2 C 81.3,45.8 81.3,47.4 81.6,49.0 C 82.0,50.5 82.7,52.1 83.4,53.7 C 84.2,55.2 85.1,56.9 86.2,58.4 C 87.3,59.8 89.0,61.1 90.2,62.4 C 91.5,63.8 93.0,65.0 93.8,66.5 C 94.6,67.9 95.1,69.6 94.9,71.1 C 94.6,72.6 93.0,73.9 92.4,75.4 C 91.8,77.0 91.7,78.7 91.2,80.4 C 90.8,82.0 90.6,84.3 89.6,85.4 C 88.7,86.6 86.8,87.1 85.3,87.4 C 83.7,87.6 82.1,87.1 80.4,87.0 C 78.7,86.9 76.8,86.8 75.1,86.7 C 73.4,86.7 71.9,86.9 70.2,86.9 C 68.5,86.9 66.7,86.9 64.8,86.9 C 63.0,86.9 61.0,86.9 59.1,86.8 C 57.1,86.8 55.1,86.8 53.1,86.8 C 51.1,86.7 48.9,86.7 46.9,86.7 C 44.8,86.7 42.7,86.8 40.8,86.8 C 38.9,86.8 37.3,86.8 35.6,86.8 C 33.8,86.8 32.1,86.8 30.4,86.7 C 28.7,86.7 27.3,86.8 25.6,86.7 C 23.9,86.7 21.8,86.8 20.1,86.5 C 18.3,86.2 16.8,85.7 15.3,84.8 C 13.9,84.0 12.3,82.9 11.4,81.5 C 10.5,80.2 10.0,78.2 10.1,76.7 C 10.3,75.2 11.1,73.5 12.3,72.5 C 13.4,71.5 15.3,71.2 17.0,70.8 C 18.6,70.4 20.4,70.2 22.1,70.1 C 23.8,70.0 25.3,70.0 27.0,70.0 C 28.7,70.0 27.0,69.9 32.3,70.2 C 37.7,70.5 53.7,71.5 58.9,71.8 Z';

// Approximate XY positions around Sebring at 20 evenly-spaced trackPct points
// (extracted from the SVG path — used to interpolate player position on the map)
const TRACK_POINTS = [
  [58.9,71.8],[69.0,72.2],[76.3,67.1],[77.0,62.1],[76.5,56.9],
  [75.5,51.8],[74.8,46.5],[74.0,36.4],[65.0,32.4],[57.3,35.6],
  [51.3,44.0],[42.4,49.0],[30.9,50.4],[18.5,50.4],[8.0,50.4],
  [9.9,38.7],[18.8,32.8],[28.7,28.9],[36.0,22.9],[43.1,15.7],
  [50.9,14.8],[59.3,19.2],[69.0,16.0],[79.1,15.5],[82.1,24.0],
  [81.8,34.5],[81.6,39.5],[81.6,49.0],[86.2,58.4],[93.8,66.5],
  [94.9,71.1],[91.2,80.4],[85.3,87.4],[75.1,86.7],[64.8,86.9],
  [53.1,86.8],[40.8,86.8],[30.4,86.7],[20.1,86.5],[11.4,81.5],
  [12.3,72.5],[22.1,70.1],[32.3,70.2],[58.9,71.8]
];

// ═══════════════════════════════════════════════════════════════
// RACE SIMULATION PARAMETERS
// ═══════════════════════════════════════════════════════════════

const LAP_TIME_BASE   = 118.5;   // Sebring 12hr GT3 ~1:58.5
const LAP_TIME_JITTER = 1.8;     // ± random per-lap variation
const TOTAL_LAPS      = 30;
const RACE_DURATION   = LAP_TIME_BASE * TOTAL_LAPS; // seconds of simulated race
const FUEL_CAPACITY   = 120;     // liters
const FUEL_PER_LAP    = 3.42;    // liters
const STARTING_FUEL   = 80;      // liters (partial fill)
const SECTOR_BOUNDARIES = [0.33, 0.67]; // S1 ends at 33%, S2 at 67%

// Leaderboard field — positions shift slightly over the race
const DRIVERS = [
  { name: 'M. Verstappen', ir: 5200, car: 'Ferrari 296 GT3',  baseGap: -8.2,  jitter: 1.5 },
  { name: 'L. Hamilton',   ir: 4800, car: 'Mercedes-AMG GT3',  baseGap: -4.1,  jitter: 1.2 },
  { name: 'C. Leclerc',    ir: 4500, car: 'Porsche 911 GT3 R', baseGap: -1.8,  jitter: 0.8 },
  { name: 'K. Alternate',  ir: 2850, car: 'BMW M4 GT3',        baseGap:  0,    jitter: 0,   isPlayer: true },
  { name: 'L. Norris',     ir: 3900, car: 'McLaren 720S GT3',  baseGap:  2.3,  jitter: 1.0 },
  { name: 'O. Piastri',    ir: 3200, car: 'Audi R8 LMS GT3',   baseGap:  5.6,  jitter: 1.8 },
  { name: 'G. Russell',    ir: 2900, car: 'Lamborghini GT3',   baseGap:  9.4,  jitter: 2.2 },
  { name: 'A. Albon',      ir: 2600, car: 'Aston Martin GT3',  baseGap: 14.1,  jitter: 3.0 },
  { name: 'P. Gasly',      ir: 2400, car: 'Ferrari 296 GT3',  baseGap: 19.5,  jitter: 3.5 },
  { name: 'Y. Tsunoda',    ir: 2100, car: 'Porsche 911 GT3 R', baseGap: 25.8,  jitter: 4.0 },
  { name: 'D. Ricciardo',  ir: 1900, car: 'Mercedes-AMG GT3',  baseGap: 33.2,  jitter: 4.5 },
  { name: 'V. Bottas',     ir: 1800, car: 'McLaren 720S GT3',  baseGap: 41.7,  jitter: 5.0 },
];

// Seeded random so the sim is reproducible per-second
function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

// ═══════════════════════════════════════════════════════════════
// SPEED / RPM / PEDAL PROFILE (varies by track position)
// ═══════════════════════════════════════════════════════════════

// Sebring speed profile: 0.0–1.0 trackPct → speed factor (0–1)
// Dips at braking zones, peaks on straights
const SPEED_PROFILE = [
  { pct: 0.00, spd: 0.90 }, // Start/finish straight (fast)
  { pct: 0.06, spd: 0.45 }, // T1 braking
  { pct: 0.10, spd: 0.55 }, // T2 exit
  { pct: 0.15, spd: 0.80 }, // Short straight
  { pct: 0.20, spd: 0.40 }, // Hairpin braking
  { pct: 0.25, spd: 0.50 }, // Hairpin exit
  { pct: 0.30, spd: 0.85 }, // Back straight build
  { pct: 0.37, spd: 0.95 }, // Back straight peak
  { pct: 0.42, spd: 0.38 }, // Big braking zone
  { pct: 0.48, spd: 0.60 }, // Esses entry
  { pct: 0.55, spd: 0.55 }, // Esses mid
  { pct: 0.60, spd: 0.65 }, // Esses exit
  { pct: 0.67, spd: 0.88 }, // Straight
  { pct: 0.73, spd: 0.42 }, // T13 braking
  { pct: 0.78, spd: 0.55 }, // T14 exit
  { pct: 0.83, spd: 0.75 }, // Approach to T17
  { pct: 0.88, spd: 0.35 }, // T17 braking (slowest)
  { pct: 0.92, spd: 0.50 }, // T17 exit
  { pct: 0.96, spd: 0.80 }, // Onto main straight
  { pct: 1.00, spd: 0.90 }, // Wrap to start
];

function sampleProfile(pct) {
  const p = SPEED_PROFILE;
  for (let i = 0; i < p.length - 1; i++) {
    if (pct >= p[i].pct && pct <= p[i + 1].pct) {
      const t = (pct - p[i].pct) / (p[i + 1].pct - p[i].pct);
      return p[i].spd + (p[i + 1].spd - p[i].spd) * t;
    }
  }
  return p[p.length - 1].spd;
}

function interpolateTrackXY(pct) {
  const n = TRACK_POINTS.length - 1; // last point = first (closed loop)
  const idx = pct * n;
  const i = Math.floor(idx);
  const t = idx - i;
  const a = TRACK_POINTS[Math.min(i, n)];
  const b = TRACK_POINTS[Math.min(i + 1, n)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function computeHeading(pct) {
  const delta = 0.005;
  const [x1, y1] = interpolateTrackXY(pct);
  const [x2, y2] = interpolateTrackXY((pct + delta) % 1.0);
  return ((Math.atan2(x2 - x1, -(y2 - y1)) * 180 / Math.PI) + 360) % 360;
}

// ═══════════════════════════════════════════════════════════════
// COMMENTARY ENGINE — cycles contextual prompts during the demo
// ═══════════════════════════════════════════════════════════════

const SEBRING_IMAGES = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/2021_12_Hours_of_Sebring_-_Dodge_City.jpg/960px-2021_12_Hours_of_Sebring_-_Dodge_City.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/2021_12_Hours_of_Sebring_-_Signpost.jpg/960px-2021_12_Hours_of_Sebring_-_Signpost.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/5/57/Bandini_GT_Sebring-1960-03-26-067.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Dodge_Viper_SRT_V10_88.jpg/960px-Dodge_Viper_SRT_V10_88.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/d/d0/Mechanics_checking_cars_at_the_Grand_Prix_race_-_Sebring%2C_Florida.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Sebring_International_Raceway_PNG.png/960px-Sebring_International_Raceway_PNG.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Sebring_satellite.png/960px-Sebring_satellite.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Welcome_to_Sebring_448742717.jpg/960px-Welcome_to_Sebring_448742717.jpg',
];

// Commentary entries — each fires at a specific race-elapsed-time window.
// { start, end } in seconds within the looping race duration.
const COMMENTARY_SCHEDULE = [
  // Track context — early in the race
  {
    start: 5, end: 18,
    topicId: 'prerace_track', category: 'game_feel',
    title: 'Track Preview',
    text: 'Welcome to Sebring International. This historic Florida airfield circuit has hosted endurance racing since 1950 — its concrete-and-asphalt surface punishes both car and driver. Watch for Turn 17, where commitment separates the quick from the cautious.',
    color: 'hsl(210, 60%, 50%)', severity: 3,
    image: 0,
  },
  // Car context
  {
    start: 150, end: 163,
    topicId: 'prerace_car', category: 'game_feel',
    title: 'Car Profile',
    text: 'The BMW M4 GT3 brings serious straight-line speed to Sebring\'s long back straight. Its inline-six turbo loves the high-speed sections, but the heavy front end demands patience through the tight Turn 1-2 complex.',
    color: 'hsl(200, 65%, 45%)', severity: 3,
  },
  // Circuit detail
  {
    start: 350, end: 363,
    topicId: 'prerace_circuit_detail', category: 'game_feel',
    title: 'Circuit Detail',
    text: 'Sebring\'s famously bumpy surface is a relic of its airfield origins — the concrete slabs shift and heave in the Florida heat. The Hairpin at Turn 7 is the slowest point on track at just 35 mph, demanding a precise late-apex to carry speed onto the back straight.',
    color: 'hsl(210, 60%, 50%)', severity: 3,
    image: 5,
  },
  // Gap management
  {
    start: 550, end: 562,
    topicId: 'gap_management', category: 'racing',
    title: 'Gap Analysis',
    text: null, // Filled dynamically based on gap data
    color: 'hsl(45, 90%, 50%)', severity: 4,
  },
  // Fuel warning
  {
    start: 900, end: 912,
    topicId: 'fuel_management', category: 'strategy',
    title: 'Fuel Strategy',
    text: null, // Filled dynamically
    color: 'hsl(35, 90%, 50%)', severity: 5,
  },
  // Tyre context
  {
    start: 1200, end: 1212,
    topicId: 'tyre_management', category: 'strategy',
    title: 'Tyre Condition',
    text: null, // Filled dynamically
    color: 'hsl(280, 50%, 50%)', severity: 4,
  },
  // Position change
  {
    start: 1600, end: 1612,
    topicId: 'position_change', category: 'racing',
    title: 'Race Update',
    text: null, // Filled dynamically
    color: 'hsl(140, 60%, 45%)', severity: 4,
  },
  // Track history
  {
    start: 2000, end: 2013,
    topicId: 'track_context', category: 'game_feel',
    title: 'Track History',
    text: 'The 12 Hours of Sebring has been contested annually since 1952, making it the oldest sports car endurance race in America. The circuit\'s unique character comes from the original WWII airfield — its bumps and surface transitions create a challenge found nowhere else.',
    color: 'hsl(210, 60%, 50%)', severity: 3,
    image: 2,
  },
  // Mid-race insight
  {
    start: 2500, end: 2512,
    topicId: 'race_insight', category: 'racing',
    title: 'Race Insight',
    text: 'Sebring rewards consistency over outright pace. The bumps destroy tires if you attack too hard early, and the long straights mean a small setup compromise costs tenths every lap. Smart drivers build their race — the circuit rewards patience.',
    color: 'hsl(200, 55%, 50%)', severity: 3,
    image: 3,
  },
  // Late-race push
  {
    start: 3000, end: 3012,
    topicId: 'late_race', category: 'racing',
    title: 'Late Race',
    text: null, // Dynamic
    color: 'hsl(0, 70%, 50%)', severity: 6,
  },
];

function pickCommentary(elapsed, currentLap, position, fuel, fuelLapsRemaining, remainingLaps, wearBase, ahead, behind) {
  for (const entry of COMMENTARY_SCHEDULE) {
    if (elapsed >= entry.start && elapsed < entry.end) {
      let text = entry.text;
      let image = entry.image != null ? SEBRING_IMAGES[entry.image] : '';

      // Dynamic text for entries that depend on race state
      if (!text) {
        switch (entry.topicId) {
          case 'gap_management':
            if (ahead) {
              text = `K. Alternate is ${Math.abs(ahead.gap).toFixed(1)}s behind ${ahead.name}. ${Math.abs(ahead.gap) < 2 ? 'That gap is within striking distance — time to push.' : 'The gap is stable. Focus on consistency and wait for your opportunity.'}`;
            } else {
              text = 'Leading the race — maintaining a clean rhythm is the priority now.';
            }
            break;
          case 'fuel_management':
            text = `Fuel reads ${fuel.toFixed(1)}L with ${fuelLapsRemaining.toFixed(1)} laps of range. ${fuelLapsRemaining >= remainingLaps ? 'Enough to make it to the end without stopping.' : `A pit stop will be needed within ${Math.ceil(fuelLapsRemaining)} laps — start planning the window.`}`;
            break;
          case 'tyre_management': {
            const gripPct = Math.round(wearBase * 100);
            text = `Tyre grip at ${gripPct}%. ${gripPct > 80 ? 'Rubber is in good shape — push with confidence.' : gripPct > 60 ? 'Starting to feel the degradation. Smooth inputs through the Esses will preserve what\'s left.' : 'Significant deg now. The Hairpin and Turn 17 will start to slide — adjust your braking points.'}`;
            break;
          }
          case 'position_change':
            text = `Running P${position} after ${currentLap} laps. ${position <= 3 ? 'Strong showing — keep this clean and the podium is there for the taking.' : `P4 is ${behind ? behind.gap.toFixed(1) + 's behind' : 'right there'}. Consistency through the next stint is everything.`}`;
            break;
          case 'late_race':
            text = `Final phase of the race — ${remainingLaps} laps remaining. ${position <= 3 ? 'A podium finish is on the line. Protect position, hit your marks, and bring it home.' : 'Still time to gain places. The drivers ahead will be managing tyres — that\'s your window to strike.'}`;
            break;
        }
      }

      if (!text) return null;
      return { text, title: entry.title, topicId: entry.topicId, category: entry.category, color: entry.color, severity: entry.severity, image };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateSnapshot(nowMs) {
  // Simulation loops every RACE_DURATION seconds
  const elapsed = (nowMs / 1000) % RACE_DURATION;
  const lapFloat = elapsed / LAP_TIME_BASE;
  const currentLap = Math.floor(lapFloat) + 1;
  const lapPct = lapFloat - Math.floor(lapFloat); // 0..1 within current lap
  const currentLapTime = lapPct * LAP_TIME_BASE;
  const completedLaps = currentLap - 1;

  // Seeded jitter per lap so times are stable within a lap
  const lapSeed = Math.floor(lapFloat);
  const lapRand = seededRand(lapSeed * 7919 + 137);
  const thisLapVariation = (lapRand - 0.5) * LAP_TIME_JITTER * 2;
  const lastLapTime = LAP_TIME_BASE + (seededRand((lapSeed - 1) * 7919 + 137) - 0.5) * LAP_TIME_JITTER * 2;
  const bestLapTime = LAP_TIME_BASE - LAP_TIME_JITTER * 0.6; // simulated PB

  // Fuel depletes per lap
  const fuelUsed = completedLaps * FUEL_PER_LAP + lapPct * FUEL_PER_LAP;
  const fuel = Math.max(0, STARTING_FUEL - fuelUsed);
  const fuelPct = (fuel / FUEL_CAPACITY) * 100;
  const fuelLapsRemaining = FUEL_PER_LAP > 0 ? fuel / FUEL_PER_LAP : 0;
  const remainingLaps = Math.max(0, TOTAL_LAPS - currentLap);

  // Speed & pedal profile from track position
  const spdFactor = sampleProfile(lapPct);
  const maxSpd = 178; // mph, GT3 at Sebring
  const speedMph = spdFactor * maxSpd;
  const speedKmh = speedMph * 1.60934;

  // Derive pedal inputs from speed derivative
  const spdNext = sampleProfile(Math.min(1, lapPct + 0.01));
  const accel = spdNext - spdFactor;
  const throttle = accel >= 0 ? Math.min(1, 0.3 + spdFactor * 0.7) : Math.max(0, 0.05);
  const brake = accel < -0.03 ? Math.min(1, Math.abs(accel) * 8) : 0;

  // RPM follows speed
  const maxRpm = 7200;
  const gearRatios = [0, 0.28, 0.42, 0.56, 0.70, 0.84, 1.0]; // 6 gears
  let gear = 1;
  for (let g = 6; g >= 1; g--) {
    if (spdFactor >= gearRatios[g] * 0.65) { gear = g; break; }
  }
  const gearBand = gear < 6 ? gearRatios[gear + 1] - gearRatios[gear] : 0.16;
  const rpmPct = gearBand > 0
    ? 0.45 + 0.55 * ((spdFactor - gearRatios[gear] * 0.65) / (gearBand * 0.65 + 0.01))
    : 0.7;
  const rpm = Math.min(maxRpm, Math.max(800, Math.round(rpmPct * maxRpm)));

  // G-forces from speed changes
  const latG = Math.sin(lapPct * Math.PI * 12) * spdFactor * 1.8;
  const longG = accel * 15;

  // Sector tracking
  const sectorBoundary1 = SECTOR_BOUNDARIES[0];
  const sectorBoundary2 = SECTOR_BOUNDARIES[1];
  const curSector = lapPct < sectorBoundary1 ? 1 : lapPct < sectorBoundary2 ? 2 : 3;

  // Sector splits (completed sectors in this lap)
  const s1Split = lapPct >= sectorBoundary1 ? sectorBoundary1 * LAP_TIME_BASE + thisLapVariation * 0.33 : 0;
  const s2Split = lapPct >= sectorBoundary2 ? (sectorBoundary2 - sectorBoundary1) * LAP_TIME_BASE + thisLapVariation * 0.33 : 0;
  const s3Split = 0; // only after lap completes

  // Lap delta (cumulative, vs best — realistic range)
  const lapDelta = thisLapVariation * lapPct;

  // Sector deltas & states (0=none, 1=PB, 2=faster, 3=slower)
  const s1Delta = s1Split > 0 ? thisLapVariation * 0.33 : 0;
  const s2Delta = s2Split > 0 ? thisLapVariation * 0.33 : 0;
  const s1State = s1Split > 0 ? (s1Delta < -0.3 ? 1 : s1Delta < 0 ? 2 : 3) : 0;
  const s2State = s2Split > 0 ? (s2Delta < -0.3 ? 1 : s2Delta < 0 ? 2 : 3) : 0;

  // Track map position
  const [mapX, mapY] = interpolateTrackXY(lapPct);
  const heading = computeHeading(lapPct);

  // Opponents on track map (spread around the circuit)
  const oppParts = [];
  for (let i = 0; i < DRIVERS.length; i++) {
    if (DRIVERS[i].isPlayer) continue;
    const oppPct = (lapPct + (i * 0.08) + seededRand(i * 31 + lapSeed) * 0.04) % 1.0;
    const [ox, oy] = interpolateTrackXY(oppPct);
    const inPit = (i === 7 && currentLap % 10 === 5) ? 1 : 0; // one car pits occasionally
    oppParts.push(`${ox.toFixed(1)},${oy.toFixed(1)},${inPit}`);
  }

  // Tyre temps & wear (gradual degradation)
  const tyreAgeLaps = completedLaps % 15; // stint length ~15 laps
  const wearBase = Math.max(0.3, 1.0 - tyreAgeLaps * 0.04);
  const tempBase = 85 + spdFactor * 25 + tyreAgeLaps * 1.5;

  // Position — player starts P4, varies slightly
  const posJitter = Math.floor(seededRand(lapSeed * 113) * 3) - 1; // -1, 0, +1
  const position = Math.max(1, Math.min(DRIVERS.length, 4 + posJitter));
  const startPosition = 4;

  // Build leaderboard
  const leaderboard = DRIVERS.map((d, i) => {
    const gap = d.isPlayer ? 0 : d.baseGap + (seededRand(i * 97 + lapSeed) - 0.5) * d.jitter;
    return {
      pos: 0, name: d.name, ir: d.ir,
      best: bestLapTime + (d.isPlayer ? 0 : (i - 3) * 0.4),
      last: lastLapTime + (d.isPlayer ? 0 : (seededRand(i * 53 + lapSeed) - 0.5) * 2),
      gap, pit: 0, isPlayer: d.isPlayer ? 1 : 0
    };
  });
  leaderboard.sort((a, b) => a.gap - b.gap);
  leaderboard.forEach((e, i) => { e.pos = i + 1; });
  const lbArr = leaderboard.map(e => [e.pos, e.name, e.ir, +e.best.toFixed(3), +e.last.toFixed(3), +e.gap.toFixed(1), e.pit, e.isPlayer]);

  // Gap ahead/behind from sorted leaderboard
  const playerIdx = leaderboard.findIndex(e => e.isPlayer);
  const ahead = playerIdx > 0 ? leaderboard[playerIdx - 1] : null;
  const behind = playerIdx < leaderboard.length - 1 ? leaderboard[playerIdx + 1] : null;

  // TC/ABS fire sporadically in braking zones
  const inBrakeZone = brake > 0.3;
  const tcFlicker = inBrakeZone && seededRand(Math.floor(nowMs / 100) * 71) > 0.6 ? 1 : 0;
  const absFlicker = inBrakeZone && seededRand(Math.floor(nowMs / 100) * 43) > 0.5 ? 1 : 0;

  // Session time
  const sessionTime = elapsed;
  const remainingTime = RACE_DURATION - elapsed;

  // ─── Assemble the flat JSON blob ───
  const dsPre = 'K10Motorsports.Plugin.DS.';
  const demoPre = 'K10Motorsports.Plugin.Demo.';
  const demoDsPre = 'K10Motorsports.Plugin.Demo.DS.';

  const p = {};

  // Core game data (live mode keys — dashboard reads these when DemoMode=0)
  p['DataCorePlugin.GameRunning'] = 1;
  p['DataCorePlugin.GameData.Gear'] = '' + gear;
  p['DataCorePlugin.GameData.Rpms'] = rpm;
  p['DataCorePlugin.GameData.CarSettings_MaxRPM'] = maxRpm;
  p['DataCorePlugin.GameData.SpeedMph'] = +speedMph.toFixed(1);
  p['DataCorePlugin.GameData.Throttle'] = +throttle.toFixed(3);
  p['DataCorePlugin.GameData.Brake'] = +brake.toFixed(3);
  p['DataCorePlugin.GameData.Clutch'] = 0;
  p['DataCorePlugin.GameData.Fuel'] = +fuel.toFixed(2);
  p['DataCorePlugin.GameData.MaxFuel'] = FUEL_CAPACITY;
  p['DataCorePlugin.Computed.Fuel_LitersPerLap'] = FUEL_PER_LAP;
  p['DataCorePlugin.GameData.RemainingLaps'] = remainingLaps;
  p['DataCorePlugin.GameData.TyreTempFrontLeft'] = +(tempBase + 1.2).toFixed(1);
  p['DataCorePlugin.GameData.TyreTempFrontRight'] = +(tempBase - 0.8).toFixed(1);
  p['DataCorePlugin.GameData.TyreTempRearLeft'] = +(tempBase + 3.5).toFixed(1);
  p['DataCorePlugin.GameData.TyreTempRearRight'] = +(tempBase + 4.1).toFixed(1);
  p['DataCorePlugin.GameData.TyreWearFrontLeft'] = +(wearBase - 0.02).toFixed(3);
  p['DataCorePlugin.GameData.TyreWearFrontRight'] = +(wearBase - 0.01).toFixed(3);
  p['DataCorePlugin.GameData.TyreWearRearLeft'] = +(wearBase - 0.05).toFixed(3);
  p['DataCorePlugin.GameData.TyreWearRearRight'] = +(wearBase - 0.06).toFixed(3);
  p['DataCorePlugin.GameRawData.Telemetry.dcBrakeBias'] = 56.0;
  p['DataCorePlugin.GameRawData.Telemetry.dcTractionControl'] = 6;
  p['DataCorePlugin.GameRawData.Telemetry.dcABS'] = 4;
  p['DataCorePlugin.GameRawData.Telemetry.dcAntiRollFront'] = 3;
  p['DataCorePlugin.GameRawData.Telemetry.dcAntiRollRear'] = 5;
  p['DataCorePlugin.GameData.Position'] = position;
  p['DataCorePlugin.GameData.CurrentLap'] = currentLap;
  p['DataCorePlugin.GameData.BestLapTime'] = +bestLapTime.toFixed(3);
  p['DataCorePlugin.GameData.CarModel'] = 'BMW M4 GT3';
  p['DataCorePlugin.GameData.SessionTimeSpan'] = sessionTime;
  p['DataCorePlugin.GameData.CurrentLapTime'] = +currentLapTime.toFixed(3);
  p['DataCorePlugin.GameData.LastLapTime'] = completedLaps > 0 ? +lastLapTime.toFixed(3) : 0;
  p['DataCorePlugin.GameData.RemainingTime'] = +remainingTime.toFixed(1);
  p['DataCorePlugin.GameData.TotalLaps'] = TOTAL_LAPS;
  p['DataCorePlugin.GameData.TrackName'] = 'Sebring International';
  p['DataCorePlugin.GameRawData.Telemetry.FrameRate'] = 144;
  p['DataCorePlugin.GameRawData.Telemetry.SteeringWheelAngle'] = +(Math.sin(lapPct * Math.PI * 8) * 2.5).toFixed(3);

  // iRacing extras
  p['IRacingExtraProperties.iRacing_DriverInfo_IRating'] = 2850;
  p['IRacingExtraProperties.iRacing_DriverInfo_SafetyRating'] = 3.56;
  p['IRacingExtraProperties.iRacing_Opponent_Ahead_Gap'] = ahead ? +ahead.gap.toFixed(1) : 0;
  p['IRacingExtraProperties.iRacing_Opponent_Behind_Gap'] = behind ? +behind.gap.toFixed(1) : 0;
  p['IRacingExtraProperties.iRacing_Opponent_Ahead_Name'] = ahead ? ahead.name : '';
  p['IRacingExtraProperties.iRacing_Opponent_Behind_Name'] = behind ? behind.name : '';
  p['IRacingExtraProperties.iRacing_Opponent_Ahead_IRating'] = ahead ? ahead.ir : 0;
  p['IRacingExtraProperties.iRacing_Opponent_Behind_IRating'] = behind ? behind.ir : 0;

  // K10 plugin meta
  p['K10Motorsports.Plugin.GameId'] = 'iracing';
  p['K10Motorsports.Plugin.DemoMode'] = 0;
  p['K10Motorsports.Plugin.SessionTypeName'] = 'Race';
  p['K10Motorsports.Plugin.DriverFirstName'] = 'Kevin';
  p['K10Motorsports.Plugin.DriverLastName'] = 'Alternate';

  // Commentary — cycles through race-contextual prompts
  const commentary = pickCommentary(elapsed, currentLap, position, fuel, fuelLapsRemaining, remainingLaps, wearBase, ahead, behind);
  p['K10Motorsports.Plugin.CommentaryVisible'] = commentary ? 1 : 0;
  p['K10Motorsports.Plugin.CommentaryText'] = commentary ? commentary.text : '';
  p['K10Motorsports.Plugin.CommentaryTopicTitle'] = commentary ? commentary.title : '';
  p['K10Motorsports.Plugin.CommentaryTopicId'] = commentary ? commentary.topicId : '';
  p['K10Motorsports.Plugin.CommentaryCategory'] = commentary ? commentary.category : '';
  p['K10Motorsports.Plugin.CommentarySentimentColor'] = commentary ? commentary.color : '';
  p['K10Motorsports.Plugin.CommentarySeverity'] = commentary ? commentary.severity : 0;
  p['K10Motorsports.Plugin.CommentaryTrackImage'] = commentary ? (commentary.image || '') : '';

  // Strategy
  p['K10Motorsports.Plugin.Strategy.Visible'] = 0;
  p['K10Motorsports.Plugin.Strategy.Text'] = '';
  p['K10Motorsports.Plugin.Strategy.Label'] = '';
  p['K10Motorsports.Plugin.Strategy.Severity'] = 0;
  p['K10Motorsports.Plugin.Strategy.Color'] = '';
  p['K10Motorsports.Plugin.Strategy.TextColor'] = '';
  p['K10Motorsports.Plugin.Strategy.FuelLapsRemaining'] = +fuelLapsRemaining.toFixed(1);
  p['K10Motorsports.Plugin.Strategy.FuelHealthState'] = fuel < 10 ? 'critical' : fuel < 30 ? 'warning' : 'ok';
  p['K10Motorsports.Plugin.Strategy.CanMakeItToEnd'] = fuelLapsRemaining >= remainingLaps ? 1 : 0;
  p['K10Motorsports.Plugin.Strategy.PitWindowOpen'] = 0;
  p['K10Motorsports.Plugin.Strategy.PitWindowClose'] = 0;
  p['K10Motorsports.Plugin.Strategy.TireHealthState'] = wearBase < 0.5 ? 'warning' : 'ok';
  p['K10Motorsports.Plugin.Strategy.TireLapsRemaining'] = +((wearBase - 0.3) / 0.04).toFixed(1);
  p['K10Motorsports.Plugin.Strategy.GripScore'] = +(wearBase * 100).toFixed(0);
  p['K10Motorsports.Plugin.Strategy.StintNumber'] = Math.floor(completedLaps / 15) + 1;
  p['K10Motorsports.Plugin.Strategy.StintLaps'] = completedLaps % 15;

  // Datastream (DS.*)
  p[dsPre + 'LatG'] = +latG.toFixed(3);
  p[dsPre + 'LongG'] = +longG.toFixed(3);
  p[dsPre + 'YawRate'] = +(Math.sin(lapPct * Math.PI * 6) * 0.8).toFixed(3);
  p[dsPre + 'SteerTorque'] = +(Math.sin(lapPct * Math.PI * 8) * 4).toFixed(2);
  p[dsPre + 'TrackTemp'] = 34.2;
  p[dsPre + 'IncidentCount'] = Math.floor(completedLaps / 8); // occasional inc
  p[dsPre + 'EstimatedIRatingDelta'] = position <= 3 ? Math.round(40 - position * 10) : Math.round(-10 * (position - 4));
  p[dsPre + 'IRatingFieldSize'] = DRIVERS.length;
  p[dsPre + 'AbsActive'] = absFlicker;
  p[dsPre + 'TcActive'] = tcFlicker;
  p[dsPre + 'TrackPct'] = +(lapPct * 100).toFixed(2);
  p[dsPre + 'LapDelta'] = +lapDelta.toFixed(3);
  p[dsPre + 'CurrentSector'] = curSector;
  p[dsPre + 'SectorCount'] = 3;
  p[dsPre + 'SectorSplits'] = [s1Split, s2Split, s3Split].map(v => v.toFixed(3)).join(',');
  p[dsPre + 'SectorDeltas'] = [s1Delta, s2Delta, 0].map(v => v.toFixed(3)).join(',');
  p[dsPre + 'SectorStates'] = [s1State, s2State, 0].join(',');
  p[dsPre + 'SectorBoundaryPcts'] = SECTOR_BOUNDARIES.join(',');
  p[dsPre + 'SectorSplitS1'] = +s1Split.toFixed(3);
  p[dsPre + 'SectorSplitS2'] = +s2Split.toFixed(3);
  p[dsPre + 'SectorSplitS3'] = 0;
  p[dsPre + 'SectorDeltaS1'] = +s1Delta.toFixed(3);
  p[dsPre + 'SectorDeltaS2'] = +s2Delta.toFixed(3);
  p[dsPre + 'SectorDeltaS3'] = 0;
  p[dsPre + 'SectorStateS1'] = s1State;
  p[dsPre + 'SectorStateS2'] = s2State;
  p[dsPre + 'SectorStateS3'] = 0;
  p[dsPre + 'SectorS2StartPct'] = SECTOR_BOUNDARIES[0];
  p[dsPre + 'SectorS3StartPct'] = SECTOR_BOUNDARIES[1];
  p[dsPre + 'CompletedLaps'] = completedLaps;
  p[dsPre + 'IsInPitLane'] = 0;
  p[dsPre + 'SpeedKmh'] = +speedKmh.toFixed(1);
  p[dsPre + 'PitLimiterOn'] = 0;
  p[dsPre + 'PitSpeedLimitKmh'] = 60;
  // Computed DS
  p[dsPre + 'ThrottleNorm'] = +throttle.toFixed(3);
  p[dsPre + 'BrakeNorm'] = +brake.toFixed(3);
  p[dsPre + 'ClutchNorm'] = 0;
  p[dsPre + 'RpmRatio'] = +(rpm / maxRpm).toFixed(3);
  p[dsPre + 'FuelPct'] = +fuelPct.toFixed(1);
  p[dsPre + 'FuelLapsRemaining'] = +fuelLapsRemaining.toFixed(1);
  p[dsPre + 'SpeedMph'] = +speedMph.toFixed(1);
  p[dsPre + 'PitSpeedLimitMph'] = 37;
  p[dsPre + 'IsPitSpeeding'] = 0;
  p[dsPre + 'IsNonRaceSession'] = 0;
  p[dsPre + 'IsTimedRace'] = 0;
  p[dsPre + 'IsEndOfRace'] = 0;
  p[dsPre + 'PositionDelta'] = startPosition - position;
  p[dsPre + 'StartPosition'] = startPosition;
  p[dsPre + 'DisplayUnits'] = 0; // imperial (gallons)
  p[dsPre + 'RemainingTimeFormatted'] = fmtTime(remainingTime);
  p[dsPre + 'SpeedDisplay'] = Math.round(speedMph) + ' mph';
  p[dsPre + 'RpmDisplay'] = rpm + '';
  p[dsPre + 'FuelFormatted'] = (fuel / 3.78541).toFixed(1) + ' gal';
  p[dsPre + 'FuelPerLapFormatted'] = (FUEL_PER_LAP / 3.78541).toFixed(2) + ' gal/lap';
  p[dsPre + 'PitSuggestion'] = fuelLapsRemaining < remainingLaps ? 'PIT in ~' + Math.ceil(fuelLapsRemaining) + ' laps' : '';
  p[dsPre + 'BBNorm'] = 0.56;
  p[dsPre + 'TCNorm'] = 0.5;
  p[dsPre + 'ABSNorm'] = 0.33;
  p[dsPre + 'PositionDeltaDisplay'] = (startPosition - position) >= 0 ? '▲ ' + (startPosition - position) : '▼ ' + Math.abs(startPosition - position);
  p[dsPre + 'LapDeltaDisplay'] = (lapDelta >= 0 ? '+' : '') + lapDelta.toFixed(3);
  p[dsPre + 'SafetyRatingDisplay'] = '3.56';
  p[dsPre + 'GapAheadFormatted'] = ahead ? ahead.gap.toFixed(1) + 's' : '—';
  p[dsPre + 'GapBehindFormatted'] = behind ? '+' + behind.gap.toFixed(1) + 's' : '—';
  // Ambient (off)
  p[dsPre + 'AmbientR'] = 0;
  p[dsPre + 'AmbientG'] = 0;
  p[dsPre + 'AmbientB'] = 0;
  p[dsPre + 'AmbientHasData'] = 0;

  // Track map
  p['K10Motorsports.Plugin.TrackMap.Ready'] = 1;
  p['K10Motorsports.Plugin.TrackMap.TrackName'] = 'Sebring International';
  p['K10Motorsports.Plugin.TrackMap.SvgPath'] = SEBRING_SVG;
  p['K10Motorsports.Plugin.TrackMap.PlayerX'] = +mapX.toFixed(1);
  p['K10Motorsports.Plugin.TrackMap.PlayerY'] = +mapY.toFixed(1);
  p['K10Motorsports.Plugin.TrackMap.PlayerHeading'] = +heading.toFixed(1);
  p['K10Motorsports.Plugin.TrackMap.Opponents'] = oppParts.join(';');

  // Leaderboard
  p['K10Motorsports.Plugin.Leaderboard'] = JSON.stringify(lbArr);

  // Flag
  p['currentFlagState'] = 0; // green

  // Grid (racing state = 4)
  p['K10Motorsports.Plugin.Grid.SessionState'] = 4;
  p['K10Motorsports.Plugin.Grid.GriddedCars'] = DRIVERS.length;
  p['K10Motorsports.Plugin.Grid.TotalCars'] = DRIVERS.length;
  p['K10Motorsports.Plugin.Grid.PaceMode'] = 0;
  p['K10Motorsports.Plugin.Grid.StartType'] = 'Competitive Start';
  p['K10Motorsports.Plugin.Grid.LightsPhase'] = 0;
  p['K10Motorsports.Plugin.Grid.TrackCountry'] = 'US';

  // PitBox defaults
  p['K10Motorsports.Plugin.PitBox.PitSvFlags'] = 0;
  p['K10Motorsports.Plugin.PitBox.PitSvFuel'] = 50;
  p['K10Motorsports.Plugin.PitBox.PitSvLFP'] = 172;
  p['K10Motorsports.Plugin.PitBox.PitSvRFP'] = 172;
  p['K10Motorsports.Plugin.PitBox.PitSvLRP'] = 165;
  p['K10Motorsports.Plugin.PitBox.PitSvRRP'] = 165;
  p['K10Motorsports.Plugin.PitBox.TireCompound'] = 0;
  p['K10Motorsports.Plugin.PitBox.FastRepair'] = 0;
  p['K10Motorsports.Plugin.PitBox.Windshield'] = 0;
  p['K10Motorsports.Plugin.PitBox.TireLF'] = 1;
  p['K10Motorsports.Plugin.PitBox.TireRF'] = 1;
  p['K10Motorsports.Plugin.PitBox.TireLR'] = 1;
  p['K10Motorsports.Plugin.PitBox.TireRR'] = 1;
  p['K10Motorsports.Plugin.PitBox.TiresRequested'] = 1;
  p['K10Motorsports.Plugin.PitBox.FuelRequested'] = 50;
  p['K10Motorsports.Plugin.PitBox.FastRepairRequested'] = 0;
  p['K10Motorsports.Plugin.PitBox.WindshieldRequested'] = 0;
  p['K10Motorsports.Plugin.PitBox.FuelDisplay'] = '50.0 L';
  p['K10Motorsports.Plugin.PitBox.PressureLF'] = 172;
  p['K10Motorsports.Plugin.PitBox.PressureRF'] = 172;
  p['K10Motorsports.Plugin.PitBox.PressureLR'] = 165;
  p['K10Motorsports.Plugin.PitBox.PressureRR'] = 165;
  p['K10Motorsports.Plugin.PitBox.HasTC'] = 1;
  p['K10Motorsports.Plugin.PitBox.HasABS'] = 1;
  p['K10Motorsports.Plugin.PitBox.HasARBFront'] = 1;
  p['K10Motorsports.Plugin.PitBox.HasARBRear'] = 1;
  p['K10Motorsports.Plugin.PitBox.HasEnginePower'] = 0;
  p['K10Motorsports.Plugin.PitBox.HasFuelMixture'] = 0;
  p['K10Motorsports.Plugin.PitBox.HasWeightJackerL'] = 0;
  p['K10Motorsports.Plugin.PitBox.HasWeightJackerR'] = 0;
  p['K10Motorsports.Plugin.PitBox.HasWingFront'] = 0;
  p['K10Motorsports.Plugin.PitBox.HasWingRear'] = 0;

  // Additional car adjustments
  p['DataCorePlugin.GameRawData.Telemetry.dcEnginePower'] = 0;
  p['DataCorePlugin.GameRawData.Telemetry.dcFuelMixture'] = 0;
  p['DataCorePlugin.GameRawData.Telemetry.dcWeightJackerLeft'] = 0;
  p['DataCorePlugin.GameRawData.Telemetry.dcWeightJackerRight'] = 0;
  p['DataCorePlugin.GameRawData.Telemetry.dcWingFront'] = 0;
  p['DataCorePlugin.GameRawData.Telemetry.dcWingRear'] = 0;

  // ─── Mirror everything into Demo.* keys too ───
  // (so dashboard works in both DemoMode=0 and DemoMode=1)
  p[demoPre + 'Gear'] = p['DataCorePlugin.GameData.Gear'];
  p[demoPre + 'Rpm'] = rpm;
  p[demoPre + 'MaxRpm'] = maxRpm;
  p[demoPre + 'SpeedMph'] = p['DataCorePlugin.GameData.SpeedMph'];
  p[demoPre + 'Throttle'] = p['DataCorePlugin.GameData.Throttle'];
  p[demoPre + 'Brake'] = p['DataCorePlugin.GameData.Brake'];
  p[demoPre + 'Clutch'] = 0;
  p[demoPre + 'Fuel'] = p['DataCorePlugin.GameData.Fuel'];
  p[demoPre + 'MaxFuel'] = FUEL_CAPACITY;
  p[demoPre + 'FuelPerLap'] = FUEL_PER_LAP;
  p[demoPre + 'RemainingLaps'] = remainingLaps;
  p[demoPre + 'TyreTempFL'] = p['DataCorePlugin.GameData.TyreTempFrontLeft'];
  p[demoPre + 'TyreTempFR'] = p['DataCorePlugin.GameData.TyreTempFrontRight'];
  p[demoPre + 'TyreTempRL'] = p['DataCorePlugin.GameData.TyreTempRearLeft'];
  p[demoPre + 'TyreTempRR'] = p['DataCorePlugin.GameData.TyreTempRearRight'];
  p[demoPre + 'TyreWearFL'] = p['DataCorePlugin.GameData.TyreWearFrontLeft'];
  p[demoPre + 'TyreWearFR'] = p['DataCorePlugin.GameData.TyreWearFrontRight'];
  p[demoPre + 'TyreWearRL'] = p['DataCorePlugin.GameData.TyreWearRearLeft'];
  p[demoPre + 'TyreWearRR'] = p['DataCorePlugin.GameData.TyreWearRearRight'];
  p[demoPre + 'BrakeBias'] = 56.0;
  p[demoPre + 'TC'] = 6;
  p[demoPre + 'ABS'] = 4;
  p[demoPre + 'SessionTypeName'] = 'Race';
  p[demoPre + 'Position'] = position;
  p[demoPre + 'CurrentLap'] = currentLap;
  p[demoPre + 'BestLapTime'] = p['DataCorePlugin.GameData.BestLapTime'];
  p[demoPre + 'CarModel'] = 'BMW M4 GT3';
  p[demoPre + 'SessionTime'] = sessionTime;
  p[demoPre + 'CurrentLapTime'] = p['DataCorePlugin.GameData.CurrentLapTime'];
  p[demoPre + 'LastLapTime'] = p['DataCorePlugin.GameData.LastLapTime'];
  p[demoPre + 'RemainingTime'] = p['DataCorePlugin.GameData.RemainingTime'];
  p[demoPre + 'TotalLaps'] = TOTAL_LAPS;
  p[demoPre + 'IRating'] = 2850;
  p[demoPre + 'SafetyRating'] = 3.56;
  p[demoPre + 'GapAhead'] = p['IRacingExtraProperties.iRacing_Opponent_Ahead_Gap'];
  p[demoPre + 'GapBehind'] = p['IRacingExtraProperties.iRacing_Opponent_Behind_Gap'];
  p[demoPre + 'DriverAhead'] = p['IRacingExtraProperties.iRacing_Opponent_Ahead_Name'];
  p[demoPre + 'DriverBehind'] = p['IRacingExtraProperties.iRacing_Opponent_Behind_Name'];
  p[demoPre + 'IRAhead'] = p['IRacingExtraProperties.iRacing_Opponent_Ahead_IRating'];
  p[demoPre + 'IRBehind'] = p['IRacingExtraProperties.iRacing_Opponent_Behind_IRating'];

  // Demo DS mirror
  const dsKeys = ['LatG','LongG','YawRate','SteerTorque','TrackTemp','IncidentCount',
    'AbsActive','TcActive','LapDelta','IsInPitLane','SpeedKmh','PitLimiterOn','PitSpeedLimitKmh',
    'ThrottleNorm','BrakeNorm','ClutchNorm','RpmRatio','FuelPct','FuelLapsRemaining','SpeedMph',
    'PitSpeedLimitMph','IsPitSpeeding','IsNonRaceSession','IsTimedRace','IsEndOfRace',
    'PositionDelta','StartPosition','RemainingTimeFormatted','SpeedDisplay','RpmDisplay',
    'FuelFormatted','FuelPerLapFormatted','PitSuggestion','BBNorm','TCNorm','ABSNorm',
    'PositionDeltaDisplay','LapDeltaDisplay','SafetyRatingDisplay',
    'GapAheadFormatted','GapBehindFormatted'];
  for (const k of dsKeys) {
    p[demoDsPre + k] = p[dsPre + k];
  }

  // Demo Grid mirror
  const gridKeys = ['SessionState','GriddedCars','TotalCars','PaceMode','LightsPhase','StartType','TrackCountry'];
  for (const k of gridKeys) {
    p['K10Motorsports.Plugin.Demo.Grid.' + k] = p['K10Motorsports.Plugin.Grid.' + k];
  }

  return p;
}

function fmtTime(secs) {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ═══════════════════════════════════════════════════════════════
// VERCEL HANDLER
// ═══════════════════════════════════════════════════════════════

export default function handler(req, res) {
  const snapshot = generateSnapshot(Date.now());
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(snapshot);
}
