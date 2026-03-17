/**
 * Demo Sequence — generates a timed telemetry progression that walks through
 * the full race lifecycle when no SimHub connection is available.
 *
 * Timeline (seconds from demo start):
 *   0–30   Idle         gameRunning=false — K10 logo at 50%
 *  30–35   Get In Car   gameRunning=true, sessionState=1
 *  35–42   Warmup       sessionState=2, car on track
 *  42–55   Parade Laps  sessionState=3, pace car
 *  55–58   Lights       lightsPhase 1→2→3→4→5 (red lights one by one)
 *  58       Green!       lightsPhase=6, flagState=Green
 *  58–160  Racing       sessionState=4, dynamic telemetry
 * 160–165  White flag   flagState=White (last lap)
 * 165      Checkered    flagState=Checkered, sessionState=5
 * 165–195  Cooldown     Race end screen visible
 * 195      Loop         Restart from idle
 */

import type { ParsedTelemetry } from '../types/telemetry';
import { BATHURST_SVG, getTrackPosition } from './bathurst-map';

const LOOP_DURATION = 195;

/** Base telemetry template — realistic GT3 values */
const BASE: ParsedTelemetry = {
  gameRunning: false,
  gear: 'N',
  rpm: 0,
  maxRpm: 8500,
  speedMph: 0,
  throttleRaw: 0,
  brakeRaw: 0,
  clutchRaw: 0,
  fuelPercent: 100,
  fuelLiters: 80,
  maxFuelLiters: 80,
  fuelPerLap: 3.2,
  fuelRemainingLaps: 25,
  tyreTempFL: 70, tyreTempFR: 70, tyreTempRL: 70, tyreTempRR: 70,
  tyreWearFL: 1.0, tyreWearFR: 1.0, tyreWearRL: 1.0, tyreWearRR: 1.0,
  brakeBias: 52.5, tractionControl: 4, tc: 4, abs: 3,
  position: 8,
  gapAhead: 0,
  gapBehind: 0,
  driverAhead: '',
  driverBehind: '',
  irAhead: 0,
  irBehind: 0,
  currentLap: 0,
  totalLaps: 25,
  currentLapTime: 0,
  bestLapTime: 0,
  lastLapTime: 0,
  sessionBestLapTime: 0,
  sessionTime: 0,
  remainingTime: 0,
  iRating: 3200,
  safetyRating: 3.45,
  carModel: 'Mercedes-AMG GT3 EVO',
  commentaryVisible: false,
  commentaryText: '',
  commentaryTitle: '',
  commentaryTopicId: '',
  commentaryCategory: '',
  commentaryColor: '',
  commentarySeverity: 0,
  latG: 0, longG: 0, yawRate: 0,
  steerTorque: 0, trackTemp: 32, incidentCount: 0,
  absActive: false, tcActive: false, trackPct: 0,
  lapDelta: 0, completedLaps: 0,
  isInPitLane: false, speedKmh: 0,
  pitLimiterOn: false, pitSpeedLimitKmh: 72,
  trackMapReady: true, trackMapSvg: BATHURST_SVG, playerMapX: 50, playerMapY: 82,
  opponentMapPositions: '', leaderboardJson: '',
  driverFirstName: 'Kevin', driverLastName: 'Conboy',
  driverDisplayName: 'K. Conboy',
  flagState: '',
  flagColor1: '', flagColor2: '', flagColor3: '',
  sessionState: '0',
  griddedCars: 0, totalCars: 24, paceMode: '', startType: 'rolling',
  lightsPhase: 0, trackCountry: 'AU',
  gridCountdown: 0,
  demoMode: true,
};

/** Deterministic pseudo-random from a seed (for repeatable "dynamic" data) */
function seededRandom(t: number): number {
  const x = Math.sin(t * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth oscillation between min and max */
function osc(t: number, period: number, min: number, max: number): number {
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  return mid + amp * Math.sin((t / period) * Math.PI * 2);
}

/** Lerp */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Build opponent map positions string for N cars at various track offsets */
function buildOpponents(playerPct: number, totalCars: number, playerPos: number): string {
  const parts: string[] = [];
  for (let i = 1; i <= totalCars; i++) {
    if (i === playerPos) continue; // Skip player
    // Spread opponents around the track relative to player
    const offset = (i - playerPos) * (1 / totalCars);
    const oppPct = ((playerPct + offset) % 1 + 1) % 1;
    const [x, y] = getTrackPosition(oppPct);
    const inPit = 0; // No opponents in pit during demo
    parts.push(`${x.toFixed(1)},${y.toFixed(1)},${inPit}`);
  }
  return parts.join(';');
}

/**
 * Generate ParsedTelemetry for a given elapsed time in the demo sequence.
 */
export function getDemoTelemetry(elapsedMs: number): ParsedTelemetry {
  const t = (elapsedMs / 1000) % LOOP_DURATION;

  // ─── Phase: Idle (0–30s) ───
  if (t < 30) {
    return { ...BASE };
  }

  // ─── Phase: Get In Car (30–35s) ───
  if (t < 35) {
    return {
      ...BASE,
      gameRunning: true,
      sessionState: '1',
      gear: 'N',
      rpm: 800,
      speedKmh: 0,
      speedMph: 0,
      fuelLiters: 80,
      tyreTempFL: 70, tyreTempFR: 70, tyreTempRL: 70, tyreTempRR: 70,
      flagColor1: '#00008B', flagColor2: '#FFFFFF', flagColor3: '#FF0000',
      griddedCars: 0, totalCars: 24,
    };
  }

  // ─── Phase: Warmup (35–42s) ───
  if (t < 42) {
    const warmupPct = (t - 35) / 7;
    return {
      ...BASE,
      gameRunning: true,
      sessionState: '2',
      gear: '1',
      rpm: lerp(800, 3000, warmupPct),
      speedMph: lerp(0, 30, warmupPct),
      speedKmh: lerp(0, 48, warmupPct),
      throttleRaw: lerp(0, 0.3, warmupPct),
      tyreTempFL: lerp(70, 140, warmupPct),
      tyreTempFR: lerp(70, 138, warmupPct),
      tyreTempRL: lerp(70, 130, warmupPct),
      tyreTempRR: lerp(70, 128, warmupPct),
      isInPitLane: warmupPct < 0.5,
      pitLimiterOn: warmupPct < 0.5,
      flagColor1: '#00008B', flagColor2: '#FFFFFF', flagColor3: '#FF0000',
      griddedCars: Math.floor(lerp(0, 24, warmupPct)), totalCars: 24,
    };
  }

  // ─── Phase: Parade Laps (42–55s) ───
  if (t < 55) {
    const paradePct = (t - 42) / 13;
    return {
      ...BASE,
      gameRunning: true,
      sessionState: '3',
      flagState: 'Yellow',
      paceMode: 'single-file',
      gear: '2',
      rpm: osc(t, 3, 2800, 3800),
      speedMph: lerp(40, 55, paradePct),
      speedKmh: lerp(64, 88, paradePct),
      throttleRaw: osc(t, 2, 0.15, 0.4),
      brakeRaw: osc(t, 3, 0, 0.1),
      position: 8,
      gapAhead: osc(t, 4, 0.3, 1.2),
      gapBehind: osc(t, 5, 0.4, 1.5),
      driverAhead: 'L. Hamilton',
      driverBehind: 'M. Verstappen',
      irAhead: 4100,
      irBehind: 4600,
      tyreTempFL: lerp(140, 175, paradePct),
      tyreTempFR: lerp(138, 178, paradePct),
      tyreTempRL: lerp(130, 165, paradePct),
      tyreTempRR: lerp(128, 163, paradePct),
      trackPct: paradePct * 0.95,
      playerMapX: getTrackPosition(paradePct * 0.95)[0],
      playerMapY: getTrackPosition(paradePct * 0.95)[1],
      opponentMapPositions: buildOpponents(paradePct * 0.95, 24, 8),
      griddedCars: 24,
      totalCars: 24,
      flagColor1: '#00008B', flagColor2: '#FFFFFF', flagColor3: '#FF0000',
    };
  }

  // ─── Phase: Start Lights (55–58s) ───
  if (t < 58) {
    const lightTime = t - 55;
    let lightsPhase = 0;
    if (lightTime < 0.6) lightsPhase = 1;
    else if (lightTime < 1.2) lightsPhase = 2;
    else if (lightTime < 1.8) lightsPhase = 3;
    else if (lightTime < 2.4) lightsPhase = 4;
    else if (lightTime < 2.7) lightsPhase = 5;
    else lightsPhase = 6; // GREEN!

    return {
      ...BASE,
      gameRunning: true,
      sessionState: '3',
      flagState: lightsPhase >= 6 ? 'Green' : '',
      gear: '1',
      rpm: lightsPhase >= 6 ? 7500 : lerp(4000, 6500, lightTime / 2.7),
      speedMph: lightsPhase >= 6 ? 45 : 0,
      speedKmh: lightsPhase >= 6 ? 72 : 0,
      throttleRaw: lightsPhase >= 6 ? 1.0 : lerp(0.3, 0.6, lightTime / 2.7),
      brakeRaw: lightsPhase >= 6 ? 0 : 0.8,
      position: 8,
      lightsPhase,
      griddedCars: 24,
      totalCars: 24,
      tyreTempFL: 175, tyreTempFR: 178, tyreTempRL: 165, tyreTempRR: 163,
      flagColor1: '#00008B', flagColor2: '#FFFFFF', flagColor3: '#FF0000',
    };
  }

  // ─── Phase: Racing (58–160s) ───
  if (t < 160) {
    const racePct = (t - 58) / 102; // 0→1 over race duration
    const racingT = t - 58;
    const lapDuration = 84; // ~84 seconds per lap
    const currentLap = Math.floor(racingT / lapDuration) + 1;
    const lapProgress = (racingT % lapDuration) / lapDuration;

    // Simulate speed/rpm oscillation (corner entry/exit)
    const cornerPhase = (lapProgress * 12) % 1; // 12 "corners" per lap
    const inCorner = cornerPhase < 0.35;
    const onStraight = cornerPhase > 0.6;

    const gear = onStraight ? '5' : inCorner ? '3' : '4';
    const rpm = onStraight ? osc(t, 0.8, 6500, 8200)
      : inCorner ? osc(t, 0.5, 3500, 5200)
      : osc(t, 0.6, 5000, 6800);
    const speed = onStraight ? osc(t, 1.2, 145, 175)
      : inCorner ? osc(t, 0.8, 65, 95)
      : osc(t, 1.0, 100, 135);

    // Position improves slightly over race
    const pos = Math.max(1, Math.round(lerp(8, 3, racePct * racePct)));

    // Fuel decreases
    const fuelRemaining = lerp(80, 12, racePct);

    // Tyres degrade
    const wearFactor = lerp(1.0, 0.65, racePct);

    // Tyre temps increase then stabilize
    const tempBase = lerp(175, 200, Math.min(racePct * 3, 1));

    // Incidents accumulate slowly
    const incidents = Math.floor(racePct * 3);

    // Gap oscillates
    const gapAhead = pos === 1 ? 0 : osc(t, 7, 0.3, 2.8);
    const gapBehind = osc(t, 9, 0.5, 3.2);

    // Commentary appears occasionally
    const showCommentary = racingT > 15 && racingT < 22;

    return {
      ...BASE,
      gameRunning: true,
      sessionState: '4',
      flagState: pos <= 3 && racePct > 0.5 ? '' : seededRandom(Math.floor(t / 30)) > 0.85 ? 'Yellow' : '',
      gear,
      rpm,
      maxRpm: 8500,
      speedMph: speed,
      speedKmh: speed * 1.609,
      throttleRaw: onStraight ? osc(t, 0.4, 0.85, 1.0) : inCorner ? osc(t, 0.3, 0.0, 0.35) : osc(t, 0.5, 0.4, 0.7),
      brakeRaw: inCorner ? osc(t, 0.3, 0.4, 0.95) : 0,
      clutchRaw: 0,
      fuelLiters: fuelRemaining,
      fuelPercent: (fuelRemaining / 80) * 100,
      fuelPerLap: 3.2,
      fuelRemainingLaps: Math.floor(fuelRemaining / 3.2),
      tyreTempFL: tempBase + seededRandom(t * 1.1) * 8,
      tyreTempFR: tempBase + 3 + seededRandom(t * 1.2) * 8,
      tyreTempRL: tempBase - 10 + seededRandom(t * 1.3) * 6,
      tyreTempRR: tempBase - 8 + seededRandom(t * 1.4) * 6,
      tyreWearFL: wearFactor - seededRandom(t * 0.1) * 0.04,
      tyreWearFR: wearFactor - 0.04 - seededRandom(t * 0.2) * 0.04,
      tyreWearRL: wearFactor + 0.08,
      tyreWearRR: wearFactor + 0.05,
      position: pos,
      gapAhead,
      gapBehind,
      driverAhead: pos === 1 ? '' : ['L. Hamilton', 'S. Vettel', 'C. Leclerc', 'L. Norris'][pos % 4] || 'L. Hamilton',
      driverBehind: ['M. Verstappen', 'D. Ricciardo', 'V. Bottas', 'P. Gasly'][(pos + 1) % 4] || 'M. Verstappen',
      irAhead: pos === 1 ? 0 : 3800 + Math.floor(seededRandom(pos) * 1200),
      irBehind: 2800 + Math.floor(seededRandom(pos + 5) * 1500),
      currentLap,
      totalLaps: 25,
      currentLapTime: lapProgress * lapDuration,
      bestLapTime: currentLap > 1 ? 83.456 : 0,
      lastLapTime: currentLap > 1 ? 83.456 + seededRandom(currentLap) * 2 : 0,
      sessionBestLapTime: 82.901,
      sessionTime: racingT,
      remainingTime: Math.max(0, (25 - currentLap) * lapDuration),
      incidentCount: incidents,
      latG: inCorner ? osc(t, 0.4, -1.2, 1.2) : osc(t, 1, -0.3, 0.3),
      longG: inCorner ? -0.8 : onStraight ? 0.3 : 0,
      yawRate: inCorner ? osc(t, 0.3, -0.15, 0.15) : 0,
      steerTorque: inCorner ? osc(t, 0.4, -12, 12) : osc(t, 1, -2, 2),
      absActive: inCorner && seededRandom(t * 3) > 0.7,
      tcActive: !inCorner && seededRandom(t * 4) > 0.85,
      trackPct: lapProgress,
      playerMapX: getTrackPosition(lapProgress)[0],
      playerMapY: getTrackPosition(lapProgress)[1],
      opponentMapPositions: buildOpponents(lapProgress, 24, pos),
      lapDelta: osc(t, 15, -0.5, 0.3),
      completedLaps: currentLap - 1,
      trackTemp: 32 + seededRandom(Math.floor(t / 60)) * 3,
      commentaryVisible: showCommentary,
      commentaryText: showCommentary ? 'Great pace through the esses — really finding the rhythm now.' : '',
      commentaryTitle: showCommentary ? 'Driving Style' : '',
      commentaryTopicId: showCommentary ? 'driving-style' : '',
      commentaryCategory: showCommentary ? 'positive' : '',
      commentaryColor: showCommentary ? 'hsla(200, 70%, 50%, 0.8)' : '',
      commentarySeverity: showCommentary ? 1 : 0,
      griddedCars: 24,
      totalCars: 24,
    };
  }

  // ─── Phase: White Flag / Last Lap (160–165s) ───
  if (t < 165) {
    return {
      ...BASE,
      gameRunning: true,
      sessionState: '4',
      flagState: 'White',
      gear: '4',
      rpm: osc(t, 0.7, 5500, 7200),
      speedMph: osc(t, 1.5, 110, 155),
      speedKmh: osc(t, 1.5, 177, 250),
      throttleRaw: osc(t, 0.5, 0.6, 1.0),
      brakeRaw: osc(t, 0.8, 0, 0.5),
      position: 3,
      gapAhead: osc(t, 3, 0.8, 1.5),
      gapBehind: osc(t, 4, 1.2, 3.0),
      driverAhead: 'L. Hamilton',
      driverBehind: 'S. Vettel',
      irAhead: 4200,
      irBehind: 4800,
      currentLap: 25,
      totalLaps: 25,
      currentLapTime: (t - 160) * 16.8,
      bestLapTime: 83.456,
      lastLapTime: 84.102,
      sessionBestLapTime: 82.901,
      fuelLiters: 8.5,
      fuelPercent: 10.6,
      fuelRemainingLaps: 2,
      tyreTempFL: 198, tyreTempFR: 202, tyreTempRL: 188, tyreTempRR: 192,
      tyreWearFL: 0.68, tyreWearFR: 0.64, tyreWearRL: 0.76, tyreWearRR: 0.73,
      incidentCount: 2,
      trackPct: lerp(0.7, 0.98, (t - 160) / 5),
      playerMapX: getTrackPosition(lerp(0.7, 0.98, (t - 160) / 5))[0],
      playerMapY: getTrackPosition(lerp(0.7, 0.98, (t - 160) / 5))[1],
      opponentMapPositions: buildOpponents(lerp(0.7, 0.98, (t - 160) / 5), 24, 3),
      completedLaps: 24,
      griddedCars: 24,
      totalCars: 24,
    };
  }

  // ─── Phase: Checkered / Race End (165–195s) ───
  return {
    ...BASE,
    gameRunning: true,
    sessionState: '5',
    flagState: 'Checkered',
    gear: '3',
    rpm: lerp(4000, 2000, Math.min((t - 165) / 10, 1)),
    speedMph: lerp(80, 30, Math.min((t - 165) / 15, 1)),
    speedKmh: lerp(129, 48, Math.min((t - 165) / 15, 1)),
    throttleRaw: lerp(0.3, 0, Math.min((t - 165) / 10, 1)),
    brakeRaw: 0,
    position: 3,
    gapAhead: 1.234,
    gapBehind: 4.567,
    driverAhead: 'L. Hamilton',
    driverBehind: 'S. Vettel',
    irAhead: 4200,
    irBehind: 4800,
    currentLap: 25,
    totalLaps: 25,
    currentLapTime: 84 + (t - 165),
    bestLapTime: 83.456,
    lastLapTime: 84.102,
    sessionBestLapTime: 82.901,
    fuelLiters: 6.2,
    fuelPercent: 7.75,
    fuelRemainingLaps: 1,
    tyreTempFL: 195, tyreTempFR: 200, tyreTempRL: 185, tyreTempRR: 190,
    tyreWearFL: 0.68, tyreWearFR: 0.64, tyreWearRL: 0.76, tyreWearRR: 0.73,
    iRating: 3200,
    safetyRating: 3.45,
    incidentCount: 2,
    trackPct: 0.99,
    completedLaps: 25,
    griddedCars: 24,
    totalCars: 24,
  };
}

/**
 * Returns the loop duration in ms so callers can detect restarts.
 */
export const DEMO_LOOP_MS = LOOP_DURATION * 1000;
