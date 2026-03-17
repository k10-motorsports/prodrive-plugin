/**
 * Bathurst (Mount Panorama) track map data for the demo sequence.
 *
 * The SVG path traces the circuit in a 100×100 coordinate space.
 * Layout reference (clockwise from S/F):
 *   S/F → Hell Corner → Mountain Straight → Griffin's Bend → The Cutting →
 *   Reid Park → Sulman Park → McPhillamy Park → Skyline → The Esses →
 *   The Dipper → Forrest's Elbow → Conrod Straight → The Chase → Murray's →
 *   back to S/F.
 *
 * The path starts at the S/F line (bottom-center) and proceeds clockwise.
 * Coordinates are approximate but capture the distinctive mountain shape.
 *
 * Also includes a lookup table mapping trackPct (0-1) → [x, y] so the
 * demo can animate player/opponent positions along the circuit.
 */

// ── SVG Path ──────────────────────────────────────────────────────────────
export const BATHURST_SVG = [
  'M 50 82',           // Start/Finish line
  'L 58 82',           // Pit straight
  'Q 68 82 72 78',     // Hell Corner approach
  'Q 76 74 74 68',     // Hell Corner (sharp right-hander)
  'L 70 58',           // Mountain Straight (climbing)
  'Q 68 52 64 47',     // Griffin's Bend
  'Q 60 42 56 38',     // The Cutting entry
  'Q 52 34 48 30',     // The Cutting
  'Q 44 26 40 22',     // Reid Park
  'Q 36 18 34 15',     // Sulman Park
  'Q 32 12 34 10',     // McPhillamy Park
  'Q 36 8 40 10',      // Skyline
  'Q 44 12 46 16',     // The Esses entry
  'Q 48 20 50 24',     // The Esses
  'Q 52 28 56 30',     // The Dipper
  'Q 60 32 64 36',     // Forrest's Elbow
  'L 72 46',           // Conrod Straight entry
  'L 78 58',           // Conrod Straight (descending)
  'L 80 66',           // Conrod Straight continues
  'Q 80 72 76 76',     // The Chase entry
  'Q 72 80 66 82',     // The Chase
  'Q 60 84 54 84',     // Murray's Corner
  'Q 50 84 48 83',     // Murray's exit
  'L 50 82',           // Back to S/F
  'Z',
].join(' ');

// ── Track Position Lookup ─────────────────────────────────────────────────
// Pre-computed points around the circuit at even intervals.
// Each entry is [x, y] in the 100×100 SVG coordinate space.
// Index 0 = S/F line, wraps around clockwise.

const TRACK_POINTS: [number, number][] = [
  [50, 82],   // 0.00  S/F line
  [54, 82],   // 0.02
  [58, 82],   // 0.04  Pit straight
  [62, 82],   //
  [66, 81],   //
  [70, 79],   // 0.10  Hell Corner approach
  [73, 76],   //       Hell Corner
  [74, 72],   //
  [73, 66],   //       Mountain Straight (climbing)
  [71, 61],   //
  [69, 56],   // 0.20
  [67, 51],   //
  [64, 47],   //       Griffin's Bend
  [61, 43],   //
  [58, 40],   //       The Cutting
  [55, 37],   // 0.30
  [52, 34],   //
  [49, 31],   //
  [46, 28],   //       Reid Park
  [43, 25],   //
  [40, 22],   // 0.40  Sulman Park
  [38, 19],   //
  [35, 16],   //
  [34, 13],   //       McPhillamy Park
  [34, 10],   //
  [36, 9],    // 0.50  Skyline
  [39, 10],   //
  [42, 12],   //
  [44, 14],   //       The Esses entry
  [46, 17],   //
  [48, 20],   // 0.60  The Esses
  [50, 24],   //
  [52, 27],   //
  [55, 30],   //       The Dipper
  [58, 32],   //
  [62, 34],   // 0.70  Forrest's Elbow
  [65, 38],   //
  [68, 42],   //       Conrod Straight entry
  [71, 47],   //
  [74, 52],   //
  [76, 57],   // 0.80  Conrod Straight (descending)
  [78, 62],   //
  [79, 67],   //
  [80, 70],   //
  [79, 74],   //       The Chase
  [76, 77],   // 0.90
  [72, 80],   //
  [67, 82],   //       Murray's Corner
  [61, 84],   //
  [55, 83],   //
];

const NUM_POINTS = TRACK_POINTS.length;

/**
 * Given a lap fraction (0-1), return interpolated [x, y] on the track.
 */
export function getTrackPosition(pct: number): [number, number] {
  const p = ((pct % 1) + 1) % 1; // Normalize to 0-1
  const exact = p * NUM_POINTS;
  const i0 = Math.floor(exact) % NUM_POINTS;
  const i1 = (i0 + 1) % NUM_POINTS;
  const frac = exact - Math.floor(exact);

  const [x0, y0] = TRACK_POINTS[i0];
  const [x1, y1] = TRACK_POINTS[i1];

  return [
    x0 + (x1 - x0) * frac,
    y0 + (y1 - y0) * frac,
  ];
}
