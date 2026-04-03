/**
 * iRacing History Import — Type Definitions & Utilities
 * ─────────────────────────────────────────────
 * Import logic has been inlined into /api/iracing/import/route.ts.
 * The C# plugin (IRacingDataClient.cs) reads local iRacing cookies,
 * fetches career data, and the overlay pushes it to the web API.
 *
 * This file is kept for shared utility functions.
 */

/**
 * Detect racing category from series name.
 */
export function detectCategoryFromSeries(seriesName: string): string {
  const s = (seriesName || '').toLowerCase()
  if (s.includes('dirt') && s.includes('oval')) return 'dirt_oval'
  if (s.includes('dirt') && s.includes('road')) return 'dirt_road'
  if (s.includes('dirt')) return 'dirt_road'
  if (s.includes('oval') || s.includes('nascar') || s.includes('indycar') || s.includes('stock')) return 'oval'
  if (s.includes('sports car') || s.includes('gt') || s.includes('prototype') || s.includes('endurance')) return 'sports_car'
  return 'road'
}
