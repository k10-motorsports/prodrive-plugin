import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'

/**
 * POST /api/admin/ratings/backfill
 *
 * Backfill rating_history from existing race session metadata.
 * Sessions imported via /api/iracing/upload stored iRating in metadata
 * (preRaceIRating / postRaceIRating) but never wrote rating_history rows.
 * This endpoint fixes that retroactively.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  if (!discordId) {
    return NextResponse.json({ error: 'No Discord ID' }, { status: 401 })
  }

  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userId = users[0].id

  // Fetch all sessions with metadata
  const allSessions = await db.select().from(schema.raceSessions)
    .where(eq(schema.raceSessions.userId, userId))
    .orderBy(desc(schema.raceSessions.createdAt))

  // Fetch existing rating_history timestamps to avoid duplicates
  const existingHistory = await db.select({
    createdAt: schema.ratingHistory.createdAt,
    category: schema.ratingHistory.category,
  }).from(schema.ratingHistory)
    .where(eq(schema.ratingHistory.userId, userId))

  const existingKeys = new Set(
    existingHistory.map(h => `${h.category}:${h.createdAt.getTime()}`)
  )

  let created = 0
  let skipped = 0

  for (const s of allSessions) {
    const meta = (s.metadata as Record<string, any>) || {}
    const postIR = meta.postRaceIRating ?? 0
    if (postIR <= 0) { skipped++; continue }

    const preIR = meta.preRaceIRating ?? 0
    const postSR = meta.postRaceSR ?? 0
    const preSR = meta.preRaceSR ?? 0
    const category = s.category || 'road'
    const raceTime = new Date(s.createdAt)

    // Skip if we already have a history entry at this exact time + category
    const key = `${category}:${raceTime.getTime()}`
    if (existingKeys.has(key)) { skipped++; continue }

    try {
      await db.insert(schema.ratingHistory).values({
        userId,
        category,
        iRating: Math.round(postIR),
        safetyRating: typeof postSR === 'number' ? postSR.toFixed(2) : '0.00',
        license: 'R',
        prevIRating: preIR > 0 ? Math.round(preIR) : null,
        prevSafetyRating: typeof preSR === 'number' && preSR > 0 ? preSR.toFixed(2) : null,
        sessionType: s.sessionType || category,
        trackName: s.trackName || null,
        carModel: s.carModel || null,
        createdAt: raceTime,
      })
      existingKeys.add(key)
      created++
    } catch {
      // Skip individual errors (constraint violations, etc.)
      skipped++
    }
  }

  return NextResponse.json({
    success: true,
    created,
    skipped,
    totalSessions: allSessions.length,
  })
}
