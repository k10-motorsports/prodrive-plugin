import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/iracing/import — Receive bulk career data from the desktop plugin
 *
 * The SimHub plugin reads iRacing session cookies locally, fetches career data
 * from members-ng.iracing.com, and POSTs the whole payload here for storage.
 *
 * Auth: Bearer token (plugin auth)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const result = await validateToken(authHeader.slice(7))
  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  const userId = result.user.id

  try {
    const body = await request.json()
    const { custId, displayName, recentRaces, careerSummary, chartData } = body

    if (!custId) {
      return NextResponse.json({ error: 'Missing custId' }, { status: 400 })
    }

    let sessionsImported = 0
    let ratingsUpdated = 0
    let historyPointsImported = 0
    const errors: string[] = []

    // ── 1. Upsert iRacing account link ──
    try {
      const existing = await db.select().from(schema.iracingAccounts)
        .where(eq(schema.iracingAccounts.userId, userId))
        .limit(1)

      if (existing.length > 0) {
        await db.update(schema.iracingAccounts).set({
          iracingCustId: custId,
          iracingDisplayName: displayName || null,
          importStatus: 'importing',
          updatedAt: new Date(),
        }).where(eq(schema.iracingAccounts.id, existing[0].id))
      } else {
        await db.insert(schema.iracingAccounts).values({
          userId,
          iracingCustId: custId,
          iracingDisplayName: displayName || null,
          importStatus: 'importing',
        })
      }
    } catch (err: any) {
      errors.push(`Account link: ${err.message}`)
    }

    // ── 2. Import recent races ──
    if (Array.isArray(recentRaces)) {
      // Load existing sessions to deduplicate
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

          const category = detectCategory(race.series_name || race.seriesName || '')

          await db.insert(schema.raceSessions).values({
            userId,
            carModel: race.car_name || race.carName || 'Unknown',
            manufacturer: null,
            category,
            trackName: race.track?.track_name || race.track_name || race.trackName || 'Unknown',
            sessionType: category,
            finishPosition: race.finish_position ?? race.finishPosition ?? null,
            incidentCount: race.incidents ?? null,
            metadata: {
              source: 'iracing_import',
              subsessionId: Number(subsessionId),
              gameId: subsessionId,
              seriesName: race.series_name || race.seriesName || '',
              seasonName: race.season_name || race.seasonName || '',
              preRaceIRating: race.oldi_rating ?? race.old_irating ?? race.oldIRating ?? 0,
              postRaceIRating: race.newi_rating ?? race.new_irating ?? race.newIRating ?? 0,
              actualIRatingDelta: (race.newi_rating ?? race.new_irating ?? race.newIRating ?? 0)
                - (race.oldi_rating ?? race.old_irating ?? race.oldIRating ?? 0),
              preRaceSR: (race.old_sub_level ?? race.oldSubLevel ?? 0) / 100,
              postRaceSR: (race.new_sub_level ?? race.newSubLevel ?? 0) / 100,
              startPosition: race.starting_position ?? race.start_position ?? race.startingPosition ?? 0,
              completedLaps: race.laps_complete ?? race.laps ?? race.lapsComplete ?? 0,
              lapsLed: race.laps_led ?? race.lapsLed ?? 0,
              champPoints: race.champ_points ?? race.champPoints ?? 0,
              strengthOfField: race.strength_of_field ?? race.sof ?? race.strengthOfField ?? 0,
              startedAt: race.session_start_time || race.start_time || race.sessionStartTime || null,
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

    // ── 3. Import career summary → driverRatings ──
    const categoryMap: Record<number, string> = {
      1: 'oval', 2: 'road', 3: 'dirt_oval', 4: 'dirt_road', 5: 'sports_car'
    }

    if (Array.isArray(careerSummary)) {
      for (const cat of careerSummary) {
        try {
          const category = categoryMap[cat.category_id] || 'road'
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
          errors.push(`Rating ${cat.category_id}: ${err.message}`)
        }
      }
    }

    // ── 4. Import iRating chart data → ratingHistory ──
    if (chartData && typeof chartData === 'object') {
      for (const [category, points] of Object.entries(chartData)) {
        if (!Array.isArray(points)) continue
        for (const point of points) {
          try {
            const when = point.when || point.date || ''
            const value = point.value || point.irating || 0
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
            historyPointsImported++
          } catch (err: any) {
            // Skip individual point errors (may be duplicates)
          }
        }
      }
    }

    // ── 5. Mark import complete ──
    try {
      await db.update(schema.iracingAccounts).set({
        importStatus: 'complete',
        lastImportAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(schema.iracingAccounts.userId, userId))
    } catch {}

    return NextResponse.json({
      success: true,
      imported: {
        sessions: sessionsImported,
        ratings: ratingsUpdated,
        historyPoints: historyPointsImported,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[iracing/import] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * GET /api/iracing/import — Check iRacing connection/import status
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const result = await validateToken(authHeader.slice(7))
  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  const accounts = await db.select().from(schema.iracingAccounts)
    .where(eq(schema.iracingAccounts.userId, result.user.id))
    .limit(1)

  if (accounts.length === 0) {
    return NextResponse.json({ connected: false })
  }

  const account = accounts[0]
  return NextResponse.json({
    connected: true,
    iracingCustId: account.iracingCustId,
    iracingDisplayName: account.iracingDisplayName,
    importStatus: account.importStatus,
    lastImportAt: account.lastImportAt?.toISOString() || null,
  })
}

function detectCategory(seriesName: string): string {
  const s = (seriesName || '').toLowerCase()
  if (s.includes('dirt') && s.includes('oval')) return 'dirt_oval'
  if (s.includes('dirt') && s.includes('road')) return 'dirt_road'
  if (s.includes('dirt')) return 'dirt_road'
  if (s.includes('oval') || s.includes('nascar') || s.includes('indycar') || s.includes('stock')) return 'oval'
  if (s.includes('sports car') || s.includes('gt') || s.includes('prototype') || s.includes('endurance')) return 'sports_car'
  return 'road'
}
