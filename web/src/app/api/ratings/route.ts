import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'

/**
 * POST /api/ratings — Receive rating updates (legacy endpoint, kept for compatibility)
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
    const { category, iRating, safetyRating, license } = body

    if (!category || iRating == null || safetyRating == null || !license) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert driver rating
    const existing = await db.select().from(schema.driverRatings)
      .where(eq(schema.driverRatings.userId, result.user.id))
      .limit(1)

    if (existing.length > 0) {
      await db.update(schema.driverRatings).set({
        category, iRating, safetyRating: String(safetyRating), license,
        updatedAt: new Date()
      }).where(eq(schema.driverRatings.id, existing[0].id))
    } else {
      await db.insert(schema.driverRatings).values({
        userId: result.user.id,
        category, iRating, safetyRating: String(safetyRating), license
      })
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/**
 * GET /api/ratings — Fetch a driver's current ratings and history
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    // Fallback: allow discordId query for backwards compatibility
    const discordId = request.nextUrl.searchParams.get('discordId')
    if (!discordId) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 })
    }

    const users = await db.select().from(schema.users).where(eq(schema.users.discordId, discordId)).limit(1)
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const ratings = await db.select().from(schema.driverRatings)
      .where(eq(schema.driverRatings.userId, users[0].id))

    const history = await db.select().from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, users[0].id))
      .orderBy(desc(schema.ratingHistory.createdAt))
      .limit(50)

    return NextResponse.json({
      discordId,
      ratings: ratings.reduce((acc, r) => {
        acc[r.category] = { iRating: r.iRating, safetyRating: r.safetyRating, license: r.license }
        return acc
      }, {} as Record<string, unknown>),
      history
    })
  }

  const result = await validateToken(authHeader.slice(7))
  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  const ratings = await db.select().from(schema.driverRatings)
    .where(eq(schema.driverRatings.userId, result.user.id))

  const history = await db.select().from(schema.ratingHistory)
    .where(eq(schema.ratingHistory.userId, result.user.id))
    .orderBy(desc(schema.ratingHistory.createdAt))
    .limit(50)

  return NextResponse.json({
    ratings: ratings.reduce((acc, r) => {
      acc[r.category] = { iRating: r.iRating, safetyRating: r.safetyRating, license: r.license }
      return acc
    }, {} as Record<string, unknown>),
    history
  })
}
