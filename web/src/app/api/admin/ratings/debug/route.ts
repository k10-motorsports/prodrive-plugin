import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/admin/ratings/debug
 * Diagnose iRating data: what's in rating_history vs session metadata.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  if (!discordId) return NextResponse.json({ error: 'No Discord ID' }, { status: 401 })

  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const userId = users[0].id

  // rating_history rows
  const historyRows = await db.select().from(schema.ratingHistory)
    .where(eq(schema.ratingHistory.userId, userId))
    .orderBy(desc(schema.ratingHistory.createdAt))
    .limit(10)

  // Sample session metadata (most recent 5)
  const sessions = await db.select().from(schema.raceSessions)
    .where(eq(schema.raceSessions.userId, userId))
    .orderBy(desc(schema.raceSessions.createdAt))
    .limit(5)

  const sessionSamples = sessions.map(s => {
    const meta = (s.metadata as Record<string, any>) || {}
    return {
      id: s.id,
      category: s.category,
      trackName: s.trackName,
      carModel: s.carModel,
      createdAt: s.createdAt,
      metadataKeys: Object.keys(meta),
      iRatingFields: {
        postRaceIRating: meta.postRaceIRating,
        preRaceIRating: meta.preRaceIRating,
        actualIRatingDelta: meta.actualIRatingDelta,
        postRaceSR: meta.postRaceSR,
        preRaceSR: meta.preRaceSR,
        // check alternate field names
        newi_rating: meta.newi_rating,
        oldi_rating: meta.oldi_rating,
        new_irating: meta.new_irating,
        old_irating: meta.old_irating,
        iRating: meta.iRating,
      },
    }
  })

  // driverRatings rows
  const driverRatings = await db.select().from(schema.driverRatings)
    .where(eq(schema.driverRatings.userId, userId))

  return NextResponse.json({
    userId,
    ratingHistoryCount: historyRows.length,
    ratingHistoryRows: historyRows,
    sessionCount: sessions.length,
    sessionSamples,
    driverRatings,
  }, { status: 200 })
}
