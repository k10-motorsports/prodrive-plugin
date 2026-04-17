import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, and, desc } from 'drizzle-orm'

/**
 * POST /api/iracing/extension-sync — Receive scraped data from the RaceCor browser extension
 *
 * The extension scrapes members-ng.iracing.com DOM and sends:
 *   - ratingHistory: { date, iRating }[] — extracted from SVG chart circles
 *   - careerStats: Record<string, string>[] — from career stats table
 *   - recentRaces: Record<string, string>[] — from race results table
 *
 * Auth: NextAuth session cookie (user must be logged into prodrive.racecor.io).
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

  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userId = users[0].id

  try {
    const body = await request.json()
    const {
      ratingHistory = [],
      careerStats = [],
      recentRaces = [],
      category = 'road',
    } = body as {
      ratingHistory: { date: string | null; iRating: number }[]
      careerStats: Record<string, string>[]
      recentRaces: Record<string, string>[]
      category: string
    }

    let historyImported = 0
    let statsProcessed = 0
    let racesProcessed = 0
    const errors: string[] = []

    console.log('[extension-sync] received:', {
      category,
      ratingHistoryCount: ratingHistory.length,
      careerStatsCount: careerStats.length,
      recentRacesCount: recentRaces.length,
    })

    // ── 1. Import rating history points ──────────────────────────────────────
    // These come from the SVG chart — each is { date: "YYYY-MM-DD", iRating: number }
    if (ratingHistory.length > 0) {
      // Get existing history for this user+category to avoid duplicates
      const existing = await db.select({
        iRating: schema.ratingHistory.iRating,
        createdAt: schema.ratingHistory.createdAt,
      })
        .from(schema.ratingHistory)
        .where(and(
          eq(schema.ratingHistory.userId, userId),
          eq(schema.ratingHistory.category, category),
        ))

      // Build a set of "date|iRating" keys for dedup
      const existingKeys = new Set(
        existing.map(e => {
          const d = e.createdAt instanceof Date
            ? e.createdAt.toISOString().split('T')[0]
            : String(e.createdAt).split('T')[0]
          return `${d}|${e.iRating}`
        })
      )

      for (const point of ratingHistory) {
        try {
          if (!point.date || !point.iRating || point.iRating <= 0) continue
          const key = `${point.date}|${Math.round(point.iRating)}`
          if (existingKeys.has(key)) continue

          await db.insert(schema.ratingHistory).values({
            userId,
            category,
            iRating: Math.round(point.iRating),
            safetyRating: '0.00',
            license: 'R',
            sessionType: 'extension_sync',
            trackName: null,
            carModel: null,
            createdAt: new Date(point.date),
          })
          existingKeys.add(key)
          historyImported++
        } catch (err: any) {
          errors.push(`History point ${point.date}: ${err.message}`)
        }
      }
    }

    // ── 2. Process career stats ──────────────────────────────────────────────
    // DOM table rows like { category: "Sports Car", starts: "42", wins: "3", ... }
    // We can extract current iRating / SR / license from these if present.
    for (const stat of careerStats) {
      try {
        const catName = (stat.category || stat.Category || '').toLowerCase()
        const resolvedCategory = resolveCategory(catName) || category

        // Try to extract current iRating from the career stats row
        const iRating = parseInt(stat.irating || stat.iRating || stat['current irating'] || '0', 10)
        const sr = parseFloat(stat.sr || stat.safetyRating || stat['safety rating'] || '0')
        const license = stat.license || stat.License || 'R'

        if (iRating > 0) {
          const existing = await db.select().from(schema.driverRatings)
            .where(and(
              eq(schema.driverRatings.userId, userId),
              eq(schema.driverRatings.category, resolvedCategory),
            ))
            .limit(1)

          if (existing.length === 0) {
            await db.insert(schema.driverRatings).values({
              userId,
              category: resolvedCategory,
              iRating,
              safetyRating: sr > 0 ? sr.toFixed(2) : '0.00',
              license: license.charAt(0).toUpperCase(),
            })
          } else {
            await db.update(schema.driverRatings).set({
              iRating,
              safetyRating: sr > 0 ? sr.toFixed(2) : existing[0].safetyRating,
              license: license !== 'R' ? license.charAt(0).toUpperCase() : existing[0].license,
            }).where(and(
              eq(schema.driverRatings.userId, userId),
              eq(schema.driverRatings.category, resolvedCategory),
            ))
          }
          statsProcessed++
        }
      } catch (err: any) {
        errors.push(`Career stat: ${err.message}`)
      }
    }

    // ── 3. Backfill driverRatings from the newly imported history ────────────
    // If we imported chart history, the latest point is the current rating.
    if (historyImported > 0) {
      const latestHistory = await db.select({
        iRating: schema.ratingHistory.iRating,
      })
        .from(schema.ratingHistory)
        .where(and(
          eq(schema.ratingHistory.userId, userId),
          eq(schema.ratingHistory.category, category),
        ))
        .orderBy(desc(schema.ratingHistory.createdAt))
        .limit(1)

      if (latestHistory.length > 0 && latestHistory[0].iRating > 0) {
        const existing = await db.select().from(schema.driverRatings)
          .where(and(
            eq(schema.driverRatings.userId, userId),
            eq(schema.driverRatings.category, category),
          ))
          .limit(1)

        if (existing.length === 0) {
          await db.insert(schema.driverRatings).values({
            userId,
            category,
            iRating: latestHistory[0].iRating,
            safetyRating: '0.00',
            license: 'R',
          })
        } else if (existing[0].iRating === 0 || existing[0].license === 'R') {
          await db.update(schema.driverRatings).set({
            iRating: latestHistory[0].iRating,
          }).where(and(
            eq(schema.driverRatings.userId, userId),
            eq(schema.driverRatings.category, category),
          ))
        }
      }
    }

    // ── 4. Mark import timestamp ─────────────────────────────────────────────
    try {
      await db.update(schema.iracingAccounts).set({
        lastImportAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(schema.iracingAccounts.userId, userId))
    } catch { /* no iracing account linked yet — fine */ }

    return NextResponse.json({
      success: true,
      message: `Synced ${historyImported} rating history points, ${statsProcessed} career stats, ${racesProcessed} race results for ${category}.`,
      imported: {
        ratingHistory: historyImported,
        careerStats: statsProcessed,
        recentRaces: racesProcessed,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[extension-sync] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function resolveCategory(name: string): string | null {
  const n = name.toLowerCase().trim()
  if (n.includes('formula')) return 'formula'
  if (n.includes('sports car') || n.includes('sports_car')) return 'road'
  if (n.includes('dirt oval') || n.includes('dirt_oval')) return 'dirt_oval'
  if (n.includes('dirt road') || n.includes('dirt_road')) return 'dirt_road'
  if (n.includes('oval')) return 'oval'
  if (n.includes('road')) return 'road'
  return null
}
