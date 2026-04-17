import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, and, desc } from 'drizzle-orm'
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
 * JSON exported from iRacing's Data API, AND by the browser extension
 * when importing results from the Results & Stats page.
 */

const ALLOWED_ORIGINS = [
  'chrome-extension://', // any extension origin
  'http://localhost:3000',
  'http://dev.prodrive.racecor.io:3000',
  'https://prodrive.racecor.io',
]

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.some(o =>
    o === 'chrome-extension://' ? origin.startsWith('chrome-extension://') : origin === o
  )
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

function jsonWithCors(request: NextRequest, data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return jsonWithCors(request, { error: 'Not signed in' }, 401)
  }

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  if (!discordId) {
    return jsonWithCors(request, { error: 'No Discord ID in session' }, 401)
  }

  // Resolve DB user
  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) {
    return jsonWithCors(request, { error: 'User not found' }, 404)
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
        .limit(2000)

      const existingGameIds = new Set(
        existingSessions
          .map(s => (s.metadata as Record<string, unknown>)?.gameId)
          .filter(Boolean)
          .map(String)
      )

      // Cross-source dedup: collect IDs of old DOM-scraped sessions
      // (source: 'extension_sync') so we can delete them when a proper
      // S3-sourced session for the same race arrives.
      const extensionSessionsByKey = new Map<string, string>() // extensionKey → session id
      for (const s of existingSessions) {
        const meta = s.metadata as Record<string, unknown> | null
        if (meta?.source === 'extension_sync' && meta?.extensionKey) {
          extensionSessionsByKey.set(String(meta.extensionKey), s.id)
        }
      }

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

    // ── 2b. Clean up old DOM-scraped duplicates ──
    // If there are any extension_sync sessions, remove them — S3 data is authoritative.
    if (extensionSessionsByKey.size > 0 && sessionsImported > 0) {
      const idsToDelete = [...extensionSessionsByKey.values()]
      let cleaned = 0
      for (const id of idsToDelete) {
        try {
          await db.delete(schema.raceSessions)
            .where(and(
              eq(schema.raceSessions.id, id),
              eq(schema.raceSessions.userId, userId),
            ))
          cleaned++
        } catch { /* ignore individual delete errors */ }
      }
      if (cleaned > 0) {
        console.log(`[iracing/upload] cleaned ${cleaned} old DOM-scraped duplicate sessions`)
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
    // Build a map of category → { iRating, safetyRating, license } from the
    // best available source: career summary first, then most recent race data.
    const categoryMap: Record<number, string> = {
      1: 'oval', 2: 'road', 3: 'dirt_oval', 4: 'dirt_road', 5: 'road', 6: 'formula',
    }
    const categoryRatings = new Map<string, { iRating: number; safetyRating: string; license: string }>()

    if (Array.isArray(careerSummary) && careerSummary.length > 0) {
      for (const cat of careerSummary) {
        const category = categoryMap[cat.category_id] || 'road'
        const iRating = cat.irating ?? cat.iRating ?? cat.current_irating ?? 0
        const srRaw = cat.safety_rating ?? cat.safetyRating ?? cat.sr ?? 0
        const safetyRating = typeof srRaw === 'number' ? srRaw.toFixed(2) : String(srRaw)
        // License: try license_level (1-20), then license letter
        let license = 'R'
        const licLevel = cat.license_level ?? cat.licenseLevel ?? 0
        if (licLevel >= 17) license = 'A'
        else if (licLevel >= 13) license = 'B'
        else if (licLevel >= 9) license = 'C'
        else if (licLevel >= 5) license = 'D'
        else if (cat.group_name || cat.license) {
          const letter = (cat.group_name || cat.license || '').charAt(0).toUpperCase()
          if ('ABCDPR'.includes(letter)) license = letter === 'P' ? 'A' : letter
        }
        categoryRatings.set(category, { iRating, safetyRating, license })
      }
    }

    // Fill in any categories we saw in race data but not in career summary
    if (recentRaces.length > 0) {
      // Sort newest first so we get the latest rating per category
      const sorted = [...recentRaces].sort((a, b) => {
        const ta = new Date(a.session_start_time || a.start_time || 0).getTime()
        const tb = new Date(b.session_start_time || b.start_time || 0).getTime()
        return tb - ta
      })
      for (const race of sorted) {
        const category = detectCategoryFromRace(race)
        if (categoryRatings.has(category)) continue // career summary takes precedence
        const postIR = race.newi_rating ?? race.new_irating ?? 0
        if (postIR <= 0) continue
        const postSR = ((race.new_sub_level ?? 0) / 100).toFixed(2)
        let license = 'R'
        const newLL = race.new_license_level
        if (newLL) {
          if (newLL >= 17) license = 'A'
          else if (newLL >= 13) license = 'B'
          else if (newLL >= 9) license = 'C'
          else if (newLL >= 5) license = 'D'
        }
        categoryRatings.set(category, { iRating: Math.round(postIR), safetyRating: postSR, license })
      }
    }

    // First, try using categoryRatings from career summary / race data
    for (const [category, ratings] of categoryRatings) {
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
            iRating: ratings.iRating,
            safetyRating: ratings.safetyRating,
            license: ratings.license,
          })
        } else if (ratings.iRating > 0) {
          await db.update(schema.driverRatings).set({
            iRating: ratings.iRating,
            safetyRating: ratings.safetyRating,
            license: ratings.license,
          }).where(and(
            eq(schema.driverRatings.userId, userId),
            eq(schema.driverRatings.category, category)
          ))
        }
        ratingsUpdated++
      } catch (err: any) {
        errors.push(`Rating ${category}: ${err.message}`)
      }
    }

    // Then, backfill from rating_history — this is the most reliable source
    // since it's already been populated from race iRating data (section 3).
    // For each category, grab the most recent rating_history entry and use it.
    const ratingHistoryCategories = await db.select({
      category: schema.ratingHistory.category,
      iRating: schema.ratingHistory.iRating,
      safetyRating: schema.ratingHistory.safetyRating,
      license: schema.ratingHistory.license,
    })
      .from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, userId))
      .orderBy(desc(schema.ratingHistory.createdAt))

    const latestByCategory = new Map<string, { iRating: number; safetyRating: string; license: string }>()
    for (const row of ratingHistoryCategories) {
      if (!latestByCategory.has(row.category)) {
        latestByCategory.set(row.category, {
          iRating: row.iRating,
          safetyRating: row.safetyRating,
          license: row.license,
        })
      }
    }

    for (const [category, latest] of latestByCategory) {
      if (latest.iRating <= 0) continue
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
            iRating: latest.iRating,
            safetyRating: latest.safetyRating,
            license: latest.license,
          })
          ratingsUpdated++
        } else if (existing[0].iRating === 0 || existing[0].license === 'R') {
          // Overwrite stubs with real data from rating history
          await db.update(schema.driverRatings).set({
            iRating: latest.iRating,
            safetyRating: latest.safetyRating,
            license: latest.license,
          }).where(and(
            eq(schema.driverRatings.userId, userId),
            eq(schema.driverRatings.category, category)
          ))
          ratingsUpdated++
        }
      } catch (err: any) {
        errors.push(`Rating backfill ${category}: ${err.message}`)
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

    return jsonWithCors(request, {
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
    return jsonWithCors(request, { error: 'Internal error' }, 500)
  }
}

// iRacing license_category_id: 1=oval, 2=road, 3=dirt_oval, 4=dirt_road, 5=sports_car(→road), 6=formula
const IRACING_CATEGORY_MAP: Record<number, string> = {
  1: 'oval', 2: 'road', 3: 'dirt_oval', 4: 'dirt_road', 5: 'road', 6: 'formula',
}

function detectCategoryFromRace(race: Record<string, unknown>): string {
  // Prefer the explicit license_category_id from iRacing
  const catId = race.license_category_id as number
  if (catId && IRACING_CATEGORY_MAP[catId]) return IRACING_CATEGORY_MAP[catId]

  // Fallback: parse license_category string
  const catStr = ((race.license_category || '') as string).toLowerCase()
  if (catStr === 'formula car') return 'formula'
  if (catStr === 'sports car') return 'road' // merged into road in 2024 S2
  if (catStr === 'dirt oval') return 'dirt_oval'
  if (catStr === 'dirt road') return 'dirt_road'
  if (catStr === 'oval') return 'oval'
  if (catStr === 'road') return 'road'

  // Last resort: parse series name
  const s = ((race.series_name || '') as string).toLowerCase()
  if (s.includes('formula') || s.includes('f1') || s.includes('ir-04') || s.includes('ir04')
    || s.includes('super formula') || s.includes('w series') || s.includes('formula vee')
    || s.includes('skip barber') || s.includes('usf 2000') || s.includes('indy pro')
    || s.includes('formula 1600')) return 'formula'
  if (s.includes('dirt') && s.includes('oval')) return 'dirt_oval'
  if (s.includes('dirt')) return 'dirt_road'
  if (s.includes('oval') || s.includes('nascar') || s.includes('indycar')) return 'oval'
  // GT/prototype/endurance all fall under road now
  return 'road'
}
