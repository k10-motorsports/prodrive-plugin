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
 * CORS: Allows requests from the Chrome extension origin with credentials.
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

  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) {
    return jsonWithCors(request, { error: 'User not found' }, 404)
  }
  const userId = users[0].id

  try {
    const body = await request.json()
    const {
      ratingHistory = [],
      careerStats = [],
      recentRaces = [],
      licenseData = [],
      category = 'road',
    } = body as {
      ratingHistory: { date: string | null; iRating: number }[]
      careerStats: Record<string, string>[]
      recentRaces: Record<string, string>[]
      licenseData: { category: string; license: string; safetyRating: number; iRating: number }[]
      category: string
    }

    let historyImported = 0
    let historySkipped = 0
    let historyReceived = 0
    let statsProcessed = 0
    let licensesUpdated = 0
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

      historyReceived = ratingHistory.length
      for (const point of ratingHistory) {
        try {
          if (!point.date || !point.iRating || point.iRating <= 0) continue
          const key = `${point.date}|${Math.round(point.iRating)}`
          if (existingKeys.has(key)) { historySkipped++; continue }

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

    // ── 3. Race results from DOM table — SKIPPED ──────────────────────────────
    // DOM-scraped race results are low-quality (date parsing issues, limited
    // metadata) and cause duplicates when the user also imports from the
    // Results & Stats page via the S3 JSON path (/api/iracing/upload).
    // Race data should come exclusively from the S3 upload path.
    // The recentRaces field is still accepted but ignored.

    // ── 3b. Backfill driverRatings from the newly imported history ───────────
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

    // ── 4. Import license data from sidebar badges ────────────────────────────
    // This is the most reliable source for current license/SR/iRating per category.
    if (licenseData.length > 0) {
      for (const lic of licenseData) {
        try {
          if (!lic.category || !lic.license) continue

          const existing = await db.select().from(schema.driverRatings)
            .where(and(
              eq(schema.driverRatings.userId, userId),
              eq(schema.driverRatings.category, lic.category),
            ))
            .limit(1)

          const values = {
            iRating: lic.iRating || 0,
            safetyRating: lic.safetyRating > 0 ? lic.safetyRating.toFixed(2) : '0.00',
            license: lic.license,
          }

          if (existing.length === 0) {
            await db.insert(schema.driverRatings).values({
              userId,
              category: lic.category,
              ...values,
            })
            licensesUpdated++
          } else {
            // Always update from the sidebar — it's the ground truth
            await db.update(schema.driverRatings).set(values).where(and(
              eq(schema.driverRatings.userId, userId),
              eq(schema.driverRatings.category, lic.category),
            ))
            licensesUpdated++
          }
        } catch (err: any) {
          errors.push(`License ${lic.category}: ${err.message}`)
        }
      }
    }

    // ── 5. Mark import timestamp ─────────────────────────────────────────────
    try {
      await db.update(schema.iracingAccounts).set({
        lastImportAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(schema.iracingAccounts.userId, userId))
    } catch { /* no iracing account linked yet — fine */ }

    const parts: string[] = []
    if (historyImported > 0) parts.push(`${historyImported} new rating points`)
    if (historySkipped > 0 && historyImported === 0) parts.push(`${historySkipped} rating points already synced`)
    if (licensesUpdated > 0) parts.push(`${licensesUpdated} license ratings updated`)
    if (racesProcessed > 0) parts.push(`${racesProcessed} races`)
    const message = parts.length > 0
      ? `Synced: ${parts.join(', ')}.`
      : 'No new data to sync.'

    return jsonWithCors(request, {
      success: true,
      message,
      imported: {
        ratingHistory: historyImported,
        licenses: licensesUpdated,
        careerStats: statsProcessed,
        recentRaces: racesProcessed,
      },
      received: historyReceived,
      skipped: historySkipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[extension-sync] error:', err)
    return jsonWithCors(request, { error: 'Internal error' }, 500)
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
