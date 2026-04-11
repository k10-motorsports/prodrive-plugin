import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq, and, desc, ne, inArray, sql } from 'drizzle-orm'

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

    // Upsert driver rating per category
    const existing = await db.select().from(schema.driverRatings)
      .where(and(
        eq(schema.driverRatings.userId, result.user.id),
        eq(schema.driverRatings.category, category)
      ))
      .limit(1)

    if (existing.length > 0) {
      await db.update(schema.driverRatings).set({
        iRating, safetyRating: String(safetyRating), license,
        updatedAt: new Date()
      }).where(eq(schema.driverRatings.id, existing[0].id))
    } else {
      await db.insert(schema.driverRatings).values({
        userId: result.user.id,
        category, iRating, safetyRating: String(safetyRating), license
      })
    }

    // Record a history point only when the iRating actually changed
    let historyRecorded = false
    let historyError: string | null = null
    const roundedIR = Math.round(iRating)

    if (roundedIR > 0) {
      try {
        // Check the most recent history entry for this user+category
        const lastEntry = await db.select().from(schema.ratingHistory)
          .where(and(
            eq(schema.ratingHistory.userId, result.user.id),
            eq(schema.ratingHistory.category, category)
          ))
          .orderBy(desc(schema.ratingHistory.createdAt))
          .limit(1)

        const lastIR = lastEntry.length > 0 ? lastEntry[0].iRating : null

        if (lastIR !== roundedIR) {
          await db.insert(schema.ratingHistory).values({
            userId: result.user.id,
            category,
            iRating: roundedIR,
            safetyRating: String(safetyRating || '0.00'),
            license: license || 'R',
            prevIRating: lastIR,
            sessionType: category,
            trackName: null,
            carModel: null,
            createdAt: new Date(),
          })
          historyRecorded = true
        }
      } catch (histErr: unknown) {
        historyError = histErr instanceof Error ? histErr.message : String(histErr)
        console.error('[ratings] ratingHistory insert failed:', historyError)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      historyRecorded,
      historyError,
      historySkipped: roundedIR > 0 && !historyRecorded && !historyError ? 'unchanged' : undefined,
    })
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

/**
 * DELETE /api/ratings — Clear duplicate history rows, keeping one per category
 */
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const result = await validateToken(authHeader.slice(7))
  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  // For each category, keep only the most recent history row
  const allHistory = await db.select().from(schema.ratingHistory)
    .where(eq(schema.ratingHistory.userId, result.user.id))
    .orderBy(desc(schema.ratingHistory.createdAt))

  const keepIds = new Set<string>()
  const seenCategories = new Set<string>()
  for (const row of allHistory) {
    if (!seenCategories.has(row.category)) {
      seenCategories.add(row.category)
      keepIds.add(row.id)
    }
  }

  const deleteIds = allHistory
    .filter(r => !keepIds.has(r.id))
    .map(r => r.id)

  if (deleteIds.length > 0) {
    await db.delete(schema.ratingHistory)
      .where(and(
        eq(schema.ratingHistory.userId, result.user.id),
        inArray(schema.ratingHistory.id, deleteIds)
      ))
  }

  return NextResponse.json({
    success: true,
    kept: keepIds.size,
    deleted: deleteIds.length,
  })
}
