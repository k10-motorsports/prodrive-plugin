import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * POST /api/iracing/latest — Import only the latest recent races from iRacing
 *
 * Called by the overlay after a race ends. The overlay polls the SimHub plugin
 * for recent races until the just-finished race appears, then sends the delta
 * here. We only insert NEW races that don't already exist (deduped by subsessionId).
 *
 * This is a lightweight variant of /api/iracing/import that skips career summary
 * and chart data — it only processes recentRaces.
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
    const { custId, displayName, recentRaces } = body

    if (!custId || !Array.isArray(recentRaces)) {
      return NextResponse.json({ error: 'Missing custId or recentRaces' }, { status: 400 })
    }

    let sessionsImported = 0
    let ratingsImported = 0
    const errors: string[] = []

    // Load existing sessions to deduplicate by subsessionId
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

        // Insert race session
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
            source: 'iracing_latest',
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

        // Also insert a rating_history entry for each new race with rating deltas
        const postIR = race.newi_rating ?? race.new_irating ?? race.newIRating ?? 0
        const preIR = race.oldi_rating ?? race.old_irating ?? race.oldIRating ?? 0
        const postSR = (race.new_sub_level ?? race.newSubLevel ?? 0) / 100
        const preSR = (race.old_sub_level ?? race.oldSubLevel ?? 0) / 100

        if (postIR > 0) {
          try {
            await db.insert(schema.ratingHistory).values({
              userId,
              category,
              iRating: Math.round(postIR),
              safetyRating: postSR.toFixed(2),
              license: race.new_license_level ? licenseFromLevel(race.new_license_level) : 'R',
              prevIRating: preIR > 0 ? Math.round(preIR) : null,
              prevSafetyRating: preSR > 0 ? preSR.toFixed(2) : null,
              sessionType: category,
              trackName: race.track?.track_name || race.track_name || race.trackName || null,
              carModel: race.car_name || race.carName || null,
              createdAt: race.session_start_time || race.start_time
                ? new Date(race.session_start_time || race.start_time)
                : new Date(),
            })
            ratingsImported++
          } catch {
            // May be duplicate — skip
          }
        }
      } catch (err: any) {
        errors.push(`Race ${race.subsession_id || '?'}: ${err.message}`)
      }
    }

    // Update lastImportAt if we imported anything
    if (sessionsImported > 0) {
      try {
        await db.update(schema.iracingAccounts).set({
          lastImportAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(schema.iracingAccounts.userId, userId))
      } catch {}
    }

    return NextResponse.json({
      success: true,
      imported: {
        sessions: sessionsImported,
        ratings: ratingsImported,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[iracing/latest] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
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

function licenseFromLevel(level: number): string {
  if (level >= 18) return 'P'
  if (level >= 16) return 'A'
  if (level >= 12) return 'B'
  if (level >= 8) return 'C'
  if (level >= 4) return 'D'
  return 'R'
}
