import type { IRacingSchedule } from './next-race-ideas'

/**
 * Fetches the current iRacing season schedule from iracing-week-planner.tmo.lol
 *
 * The week planner is a React SPA that bundles its season data (scraped from
 * iRacing's /data/series/seasons API) into its webpack JS bundle. We:
 *   1. Fetch the index HTML to discover the current bundle hash
 *   2. Fetch the bundle JS
 *   3. Extract the embedded JSON season array
 *   4. Map field names to our IRacingSchedule interface
 *
 * Results are cached in memory for 24 hours (the schedule only changes weekly).
 */

const WEEK_PLANNER_URL = 'https://iracing-week-planner.tmo.lol'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Category ID mapping: week planner catid → our category string
// Week planner IDs: 1=oval, 2=road, 3=dirt_oval, 4=dirt_road, 5=sports_car (→road), 6=formula
const CATID_MAP: Record<number, string> = {
  1: 'oval',
  2: 'road',
  3: 'dirt_oval',
  4: 'dirt_road',
  5: 'road',     // iRacing merged sports car into road in 2024 S2
  6: 'formula',
}

// In-memory cache
let cachedSchedule: IRacingSchedule[] | null = null
let cacheTimestamp = 0

/**
 * Fetch the current iRacing season schedule.
 * Returns cached data if available and fresh (< 24h old).
 */
export async function fetchIRacingSchedule(): Promise<IRacingSchedule[]> {
  const now = Date.now()
  if (cachedSchedule && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedSchedule
  }

  try {
    const schedule = await fetchFromWeekPlanner()
    cachedSchedule = schedule
    cacheTimestamp = now
    return schedule
  } catch (err) {
    console.error('[iracing-schedule-fetcher] Failed to fetch schedule:', err)
    // Return stale cache if available
    if (cachedSchedule) {
      console.warn('[iracing-schedule-fetcher] Returning stale cache')
      return cachedSchedule
    }
    return []
  }
}

/**
 * Invalidate the in-memory cache (e.g. after a new season starts).
 */
export function invalidateScheduleCache(): void {
  cachedSchedule = null
  cacheTimestamp = 0
}

async function fetchFromWeekPlanner(): Promise<IRacingSchedule[]> {
  // Step 1: Fetch index.html to get the bundle hash
  const indexRes = await fetch(WEEK_PLANNER_URL)
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch week planner index: ${indexRes.status}`)
  }
  const html = await indexRes.text()

  // Extract the main.js URL with hash parameter
  // Pattern: src="/main.js?0a6cbc15ceb8af1e0a0e"
  const scriptMatch = html.match(/src="(\/main\.js\?[a-f0-9]+)"/)
  if (!scriptMatch) {
    throw new Error('Could not find main.js bundle URL in week planner HTML')
  }
  const bundleUrl = `${WEEK_PLANNER_URL}${scriptMatch[1]}`

  // Step 2: Fetch the JS bundle
  const bundleRes = await fetch(bundleUrl)
  if (!bundleRes.ok) {
    throw new Error(`Failed to fetch week planner bundle: ${bundleRes.status}`)
  }
  const bundleJs = await bundleRes.text()

  // Step 3: Extract the season JSON array
  // The data is embedded as a JSON array starting with [{"seriesid":
  const startMarker = '[{"seriesid":'
  const startIdx = bundleJs.indexOf(startMarker)
  if (startIdx === -1) {
    throw new Error('Could not find season data in week planner bundle')
  }

  // Find the matching closing bracket
  let depth = 0
  let endIdx = startIdx
  for (let i = startIdx; i < bundleJs.length; i++) {
    if (bundleJs[i] === '[') depth++
    else if (bundleJs[i] === ']') {
      depth--
      if (depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }

  let rawJson = bundleJs.slice(startIdx, endIdx)

  // Step 4: Fix escaped characters (e.g. Kevin Harvick\'s → valid JSON)
  rawJson = rawJson.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\')

  const rawData: WeekPlannerSeries[] = JSON.parse(rawJson)

  // Log category distribution for debugging
  const catCounts = new Map<string, number>()
  for (const s of rawData) {
    const cat = s.licenceGroup === 6 ? 'formula' : (CATID_MAP[s.catid] || 'road')
    catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
  }
  console.log(`[iracing-schedule-fetcher] Parsed ${rawData.length} series:`, Object.fromEntries(catCounts))

  // Step 5: Map to our IRacingSchedule interface
  return rawData.map(mapToIRacingSchedule)
}

// ── Week planner raw types ──

interface WeekPlannerSeries {
  seriesid: number
  seriesname: string
  start: string
  end: string
  catid: number
  isOfficial: boolean
  licenceGroup: number
  licenceGroupName: string
  minlicenselevel: number
  isFixedSetup: boolean
  carclasses: Array<{ shortname: string }>
  cars: Array<{ sku: number }>
  seasonid: number
  tracks: WeekPlannerTrack[]
}

interface WeekPlannerTrack {
  raceweek: number
  config: string | null
  name: string
  pkgid: number
  start: string
  weekLength: number
  race_time_descriptors: Array<{
    day_offset?: number[]
    first_session_time?: string
    repeat_minutes?: number
    repeating: boolean
    session_minutes: number
    start_date?: string
    super_session?: boolean
    session_times?: string[]
  }>
  race_lap_limit: number | null
  race_time_limit: number | null
  carsForWeek: unknown[]
  precipChance: number
}

function mapToIRacingSchedule(series: WeekPlannerSeries): IRacingSchedule {
  // catid: 1=oval, 2=road(unused), 3=dirt_oval, 4=dirt_road, 5=road/sports_car, 6=formula
  const category = CATID_MAP[series.catid] || 'road'

  return {
    season_id: series.seasonid,
    series_id: series.seriesid,
    series_name: series.seriesname,
    season_name: series.seriesname,
    official: series.isOfficial,
    fixed_setup: series.isFixedSetup,
    license_group: series.licenceGroup,
    license_group_name: series.licenceGroupName,
    min_license_level: series.minlicenselevel,
    track_types: [{ track_type: category }],
    start_date: series.start,
    car_classes: series.carclasses.map((cc, idx) => ({
      short_name: cc.shortname,
      name: cc.shortname,
      car_class_id: idx,
    })),
    schedules: series.tracks.map(track => ({
      race_week_num: track.raceweek,
      track: {
        track_id: track.pkgid,
        track_name: track.name,
        config_name: track.config || null,
        category,
      },
      race_time_descriptors: track.race_time_descriptors.map(rtd => ({
        repeating: rtd.repeating,
        session_minutes: rtd.session_minutes,
        day_offset: rtd.day_offset,
        first_session_time: rtd.first_session_time,
        repeat_minutes: rtd.repeat_minutes,
        session_times: rtd.session_times,
      })),
      race_lap_limit: track.race_lap_limit ?? undefined,
      race_time_limit: track.race_time_limit ?? undefined,
    })),
  }
}
