import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'

/**
 * POST /api/sessions/backfill — Update the most recent session with actual rating deltas
 * Called at the start of the NEXT session, when real post-race ratings are known
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
    const { actualIRatingDelta, actualSRDelta, postRaceIRating, postRaceSR } = await request.json()

    // Find the most recent session for this user
    const recent = await db.select().from(schema.raceSessions)
      .where(eq(schema.raceSessions.userId, result.user.id))
      .orderBy(desc(schema.raceSessions.createdAt))
      .limit(1)

    if (recent.length === 0) {
      return NextResponse.json({ error: 'No session to backfill' }, { status: 404 })
    }

    const session = recent[0]
    const meta = (session.metadata as Record<string, unknown>) || {}

    // Update metadata with actual deltas
    await db.update(schema.raceSessions).set({
      metadata: {
        ...meta,
        actualIRatingDelta,
        actualSRDelta,
        postRaceIRating,
        postRaceSR,
        backfilledAt: new Date().toISOString()
      }
    }).where(eq(schema.raceSessions.id, session.id))

    // Update current driver ratings with actual post-race values
    if (postRaceIRating > 0) {
      await db.update(schema.driverRatings).set({
        iRating: postRaceIRating,
        safetyRating: String(postRaceSR || 0),
        updatedAt: new Date()
      }).where(eq(schema.driverRatings.userId, result.user.id))
    }

    return NextResponse.json({ success: true, backfilled: session.id })
  } catch (err) {
    console.error('[sessions/backfill] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
