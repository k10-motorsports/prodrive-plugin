import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { buildTrackLookup, resolveTrackName, consolidateUserTracks } from '@/lib/resolve-track'
import { resolveIRacingTrackId } from '@/data/iracing-track-map'

/**
 * POST /api/iracing/upload — Web-based iRacing data import
 *
 * Same logic as /api/iracing/import but authenticated via NextAuth session
 * instead of plugin Bearer tokens. Accepts the same career data payload
 * (member info, recent races, career summary, chart data).
 *
 * Used by the /drive/iracing upload page where users paste or drop
 * JSON exported from iRacing's Data API.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  if (!discordId) {
    return NextResponse.json({ error: 'No Discord ID in session' }, { status: 401 })
  }

  // Resolve DB user
  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userId = users[0].id

  try {
    const raw = await request.json()

    // Handle EVERY possible shape of iRacing data:
    // 1. Raw array of race objects: [{ subsession_id, ... }, ...]
    // 2. iRacing API envelope: { races: [...] }
    // 3. Our export format: { recentRaces: [...], careerSummary: [...], ... }
    // 4. Nested member_recent_races: { data: { races: [...] } }
    let body: Record<string, unknown>

    if (Array.isArray(raw)) {
      // Flatten nested arrays: [[{race1}, {race2}]] → [{race1}, {race2}]
      let flat = raw
      while (flat.length === 1 && Array.isArray(flat[0])) {
        flat = flat[0]
      }
      // Also handle [[race1, race2, ...]] where inner items are objects mixed with arrays
      if (flat.some((item: unknown) => Array.isArray(item))) {
        flat = flat.flat(Infinity)
      }
      body = { recentRaces: flat }
    } else if (raw.races && Array.isArray(raw.races)) {
      body = { ...raw, recentRaces: raw.races }
    } else if (raw.data?.races && Array.isArray(raw.data.races)) {
      body = { ...raw, recentRaces: raw.data.races }
    } else {
      body = raw
    }

    let recentRaces = (body.recentRaces || body.recent_races || []) as any[]
    // Safety: flatten any remaining nested arrays
    while (recentRaces.length > 0 && recentRaces.length === 1 && Array.isArray(recentRaces[0])) {
      recentRaces = recentRaces[0]
    }
    const careerSummary = (body.careerSummary || body.career_summary || body.stats || []) as any[]
    const chartData = (body.chartData || body.chart_data || null) as Record<string, any[]> | null
    const custId = body.custId || body.cust_id || 0
    const displayName = body.displayName || body.display_name || ''

    let sessionsImported = 0
    let ratingsUpdated = 0
    const errors: string[] = []

    console.log('[iracing/upload] received:', {
      isArray: Array.isArray(raw),
      topKeys: Object.keys(Array.isArray(raw) ? {} : raw),
      recentRacesCount: recentRaces.length,
      firstRaceKeys: recentRaces[0] ? Object.keys(recentRaces[0]).slice(0, 10) : [],
      custId,
    })

    // ── 0. Build track lookup for resolving iRacing names → DB track names ──
    const trackLookup = await buildTrackLookup()


    // ── 2. Import recent races ──
    const trackResolutions: Record<string, string> = {}

    if (Array.isArray(recentRaces)) {
      const existingSessions = await db.select().from(schema.raceSessions)
        .where(eq(schema.raceSessions.userId, userId))
        .limit(500)

      const existingGameIds = new Set(
        existingSessions
          .map(s => (s.metadata as Record<string, unknown>)?.gameId)
          .filter(Boolean)
          .map(String)
      )

      for (const race of recentRaces) {
        try {
          const subsessionId = String(race.subsession_id || race.subsessionId || '')
          if (!subsessionId || existingGameIds.has(subsessionId)) continue

          const category = detectCategoryFromRace(race)
          const iracingTrackName = race.track?.track_name || race.track_name || race.trackName || 'Unknown'
          const resolvedTrackName = resolveTrackName(trackLookup, iracingTrackName, race.track?.config_name) || iracingTrackName
          trackResolutions[iracingTrackName] = resolvedTrackName

          await db.insert(schema.raceSessions).values({
            userId,
            carModel: race.car_name || race.carName || 'Unknown',
            manufacturer: null,
            category,
            trackName: resolvedTrackName,
            sessionType: (race.event_type_name as string) || category,
            finishPosition: race.finish_position ?? race.finishPosition ?? null,
            incidentCount: race.incidents ?? null,
            metadata: {
              source: 'iracing_upload',
              iracingTrackName: iracingTrackName,
              iracingTrackConfig: race.track?.config_name || null,
              subsessionId: Number(subsessionId),
              sessionId: race.session_id ?? null,
              gameId: subsessionId,
              seriesName: race.series_name || race.seriesName || '',
              seriesId: race.series_id ?? null,
              seasonName: race.season_name || race.seasonName || '',
              seasonId: race.season_id ?? null,
              seasonYear: race.season_year ?? null,
              seasonQuarter: race.season_quarter ?? null,
              licenseCategory: race.license_category || '',
              licenseCategoryId: race.license_category_id ?? null,
              eventType: race.event_type_name || race.event_type || '',
              officialSession: race.official_session ?? null,
              numDrivers: race.num_drivers ?? null,
              preRaceIRating: race.oldi_rating ?? race.old_irating ?? 0,
              postRaceIRating: race.newi_rating ?? race.new_irating ?? 0,
              actualIRatingDelta: (race.newi_rating ?? race.new_irating ?? 0)
                - (race.oldi_rating ?? race.old_irating ?? 0),
              preRaceSR: (race.old_sub_level ?? 0) / 100,
              postRaceSR: (race.new_sub_level ?? 0) / 100,
              startPosition: race.starting_position ?? race.start_position ?? 0,
              finishPositionInClass: race.finish_position_in_class ?? null,
              completedLaps: race.laps_complete ?? race.laps ?? 0,
              eventLapsComplete: race.event_laps_complete ?? null,
              lapsLed: race.laps_led ?? 0,
              champPoints: race.champ_points ?? 0,
              strengthOfField: race.event_strength_of_field ?? race.strength_of_field ?? 0,
              startedAt: race.start_time || race.session_start_time || null,
              endedAt: race.end_time || null,
              carId: race.car_id ?? null,
              carClassId: race.car_class_id ?? null,
              carClassName: race.car_class_name || '',
              iracingTrackId: race.track?.track_id ?? null,
              prodriveTrackId: resolveIRacingTrackId(race.track?.track_name || '', race.track?.config_name),
              trackConfig: race.track?.config_name || '',
            },
            createdAt: race.session_start_time || race.start_time
              ? new Date(race.session_start_time || race.start_time)
              : new Date(),
          })
          sessionsImported++
        } catch (err: any) {
          errors.push(`Race ${race.subsession_id || '?'}: ${err.message}`)
        }
      }
    }

    // ── 3. Create rating_history entries from race iRating data ──
    let historyPointsImported = 0
    if (Array.isArray(recentRaces)) {
      for (const race of recentRaces) {
        try {
          const postIR = race.newi_rating ?? race.new_irating ?? 0
          if (postIR <= 0) continue

          const preIR = race.oldi_rating ?? race.old_irating ?? 0
          const postSR = (race.new_sub_level ?? 0) / 100
          const preSR = (race.old_sub_level ?? 0) / 100
          const category = detectCategoryFromRace(race)
          const raceTime = race.session_start_time || race.start_time
            ? new Date(race.session_start_time || race.start_time)
            : new Date()

          await db.insert(schema.ratingHistory).values({
            userId,
            category,
            iRating: Math.round(postIR),
            safetyRating: postSR.toFixed(2),
            license: (race.new_license_level ? String(Math.floor(race.new_license_level / 4) + 1) : 'R'),
            prevIRating: preIR > 0 ? Math.round(preIR) : null,
            prevSafetyRating: preSR > 0 ? preSR.toFixed(2) : null,
            sessionType: (race.event_type_name as string) || category,
            trackName: race.track?.track_name || race.track_name || race.trackName || null,
            carModel: race.car_name || race.carName || null,
            createdAt: raceTime,
          })
          historyPointsImported++
        } catch {
          // Skip duplicates / errors for individual points
        }
      }
    }

    // ── 4. Import chartData → ratingHistory (iRating timeline per category) ──
    // Handles two shapes:
    //   Flat:   { road: [{ when, value }, ...] }
    //   Nested: { road: { irating: [{ when, value }, ...], sr: [...] } }
    let chartPointsImported = 0
    if (chartData && typeof chartData === 'object') {
      for (const [category, raw] of Object.entries(chartData)) {
        const points: any[] = Array.isArray(raw)
          ? raw
          : (raw && typeof raw === 'object' && Array.isArray((raw as any).irating))
            ? (raw as any).irating
            : []

        for (const point of points) {
          try {
            const when = point.when || point.date || ''
            const value = point.value || point.irating || point.iRating || 0
            if (!when || value <= 0) continue

            await db.insert(schema.ratingHistory).values({
              userId,
              category,
              iRating: Math.round(value),
              safetyRating: '0.00',
              license: 'R',
              sessionType: category,
              trackName: null,
              carModel: null,
              createdAt: new Date(when),
            })
            chartPointsImported++
          } catch {
            // Skip duplicates
          }
        }
      }
    }

    // ── 5. Import career summary → driverRatings ──
    // If careerSummary was provided, use it. Otherwise derive categories from race data.
    const categoriesToUpsert = new Set<string>()

    if (Array.isArray(careerSummary) && careerSummary.length > 0) {
      const categoryMap: Record<number, string> = {
        1: 'oval', 2: 'road', 3: 'dirt_oval', 4: 'dirt_road', 5: 'sports_car',
      }
      for (const cat of careerSummary) {
        categoriesToUpsert.add(categoryMap[cat.category_id] || 'road')
      }
    } else if (recentRaces.length > 0) {
      // Derive categories from the races we just imported
      for (const race of recentRaces) {
        categoriesToUpsert.add(detectCategoryFromRace(race))
      }
    }

    for (const category of categoriesToUpsert) {
      try {
        const existing = await db.select().from(schema.driverRatings)
          .where(and(
            eq(schema.driverRatings.userId, userId),
            eq(schema.driverRatings.category, category)
          ))
          .limit(1)

        if (existing.length === 0) {
          await db.insert(schema.driverRatings).values({
            userId,
            category,
            iRating: 0,
            safetyRating: '0.00',
            license: 'R',
          })
        }
        ratingsUpdated++
      } catch (err: any) {
        errors.push(`Rating ${category}: ${err.message}`)
      }
    }

    // ── 4. Mark import complete (only if account was linked) ──
    if (custId) {
      try {
        await db.update(schema.iracingAccounts).set({
          importStatus: 'complete',
          lastImportAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(schema.iracingAccounts.userId, userId))
      } catch {}
    }

    // ── 5. Auto-consolidate all track names (fixes old imports too) ──
    const consolidation = await consolidateUserTracks(userId)

    return NextResponse.json({
      success: true,
      imported: {
        sessions: sessionsImported,
        ratings: ratingsUpdated,
        chartPoints: chartPointsImported,
        ratingHistoryFromRaces: historyPointsImported,
      },
      received: {
        races: recentRaces.length,
        careerSummary: careerSummary.length,
        chartDataCategories: chartData ? Object.keys(chartData) : [],
      },
      errors: errors.length > 0 ? errors : undefined,
      trackMappings: trackResolutions,
      consolidation: {
        updated: consolidation.updated,
        unmatched: consolidation.unmatchedTracks,
      },
    })
  } catch (err: any) {
    console.error('[iracing/upload] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// iRacing license_category_id: 1=oval, 2=road, 3=dirt_oval, 4=dirt_road, 5=sports_car
const IRACING_CATEGORY_MAP: Record<number, string> = {
  1: 'oval', 2: 'road', 3: 'dirt_oval', 4: 'dirt_road', 5: 'sports_car',
}

function detectCategoryFromRace(race: Record<string, unknown>): string {
  // Prefer the explicit license_category_id from iRacing
  const catId = race.license_category_id as number
  if (catId && IRACING_CATEGORY_MAP[catId]) return IRACING_CATEGORY_MAP[catId]

  // Fallback: parse license_category string
  const catStr = ((race.license_category || '') as string).toLowerCase()
  if (catStr === 'sports car') return 'sports_car'
  if (catStr === 'dirt oval') return 'dirt_oval'
  if (catStr === 'dirt road') return 'dirt_road'
  if (catStr === 'oval') return 'oval'
  if (catStr === 'road') return 'road'

  // Last resort: parse series name
  const s = ((race.series_name || '') as string).toLowerCase()
  if (s.includes('dirt') && s.includes('oval')) return 'dirt_oval'
  if (s.includes('dirt')) return 'dirt_road'
  if (s.includes('oval') || s.includes('nascar') || s.includes('indycar')) return 'oval'
  if (s.includes('gt') || s.includes('prototype') || s.includes('lmp') || s.includes('endurance')) return 'sports_car'
  return 'road'
}
