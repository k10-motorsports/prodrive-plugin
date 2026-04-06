import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'

/**
 * POST /api/sessions — Record a completed race session
 * Auth: Bearer token (from RaceCor.io Pro Drive plugin auth)
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

  try {
    const body = await request.json()

    const {
      preRaceIRating, preRaceSR, preRaceLicense,
      carModel, trackName, sessionType, gameId, gameName,
      finishPosition, incidentCount, completedLaps, totalLaps,
      bestLapTime, estimatedIRatingDelta,
      startedAt, finishedAt,
      isPracticeSession, practiceData
    } = body

    // Validate required fields
    if (!carModel || !trackName || !sessionType) {
      return NextResponse.json({ error: 'Missing required session fields' }, { status: 400 })
    }

    // Determine game and whether it's iRacing
    const normalizedGameName = (gameName || 'iRacing').trim()
    const isIRacing = normalizedGameName.toLowerCase() === 'iracing'

    // Insert session (race or practice/qualifying/warmup)
    const session = await db.insert(schema.raceSessions).values({
      userId: result.user.id,
      carModel: carModel || 'Unknown',
      manufacturer: null, // Could be extracted from carModel later
      category: _detectCategory(sessionType),
      trackName,
      sessionType,
      finishPosition: finishPosition || null,
      incidentCount: incidentCount || null,
      metadata: {
        gameId,
        gameName: normalizedGameName,
        preRaceIRating,
        preRaceSR,
        preRaceLicense,
        completedLaps,
        totalLaps,
        bestLapTime,
        estimatedIRatingDelta,
        startedAt,
        finishedAt,
        // Practice/qualifying session data (null for race sessions)
        ...(isPracticeSession ? {
          isPracticeSession: true,
          practiceData: practiceData || null,
        } : {})
      }
    }).returning()

    // Only insert rating history and update driverRatings for iRacing sessions with valid ratings
    if (isIRacing && (preRaceIRating > 0 || preRaceSR > 0)) {
      await db.insert(schema.ratingHistory).values({
        userId: result.user.id,
        category: _detectCategory(sessionType),
        iRating: preRaceIRating || 0,
        safetyRating: String(preRaceSR || 0),
        license: preRaceLicense || 'R',
        sessionType,
        trackName,
        carModel
      })
    }

    // Update current ratings only for iRacing sessions with valid ratings
    if (isIRacing && preRaceIRating > 0) {
      const category = _detectCategory(sessionType)
      const existing = await db.select().from(schema.driverRatings)
        .where(eq(schema.driverRatings.userId, result.user.id))
        .limit(1)

      if (existing.length > 0) {
        await db.update(schema.driverRatings).set({
          iRating: preRaceIRating,
          safetyRating: String(preRaceSR || 0),
          license: preRaceLicense || 'R',
          updatedAt: new Date()
        }).where(eq(schema.driverRatings.id, existing[0].id))
      } else {
        await db.insert(schema.driverRatings).values({
          userId: result.user.id,
          category,
          iRating: preRaceIRating,
          safetyRating: String(preRaceSR || 0),
          license: preRaceLicense || 'R'
        })
      }
    }

    return NextResponse.json({ success: true, sessionId: session[0]?.id })
  } catch (err) {
    console.error('[sessions] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function _detectCategory(sessionType: string): string {
  const st = (sessionType || '').toLowerCase()
  if (st.includes('oval') && !st.includes('road')) return 'oval'
  if (st.includes('dirt') && st.includes('road')) return 'dirt_road'
  if (st.includes('dirt') && st.includes('oval')) return 'dirt_oval'
  return 'road'
}

/**
 * GET /api/sessions — Get session history for the authenticated user
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

  const sessions = await db.select().from(schema.raceSessions)
    .where(eq(schema.raceSessions.userId, result.user.id))
    .orderBy(desc(schema.raceSessions.createdAt))
    .limit(100)

  return NextResponse.json({ sessions })
}
