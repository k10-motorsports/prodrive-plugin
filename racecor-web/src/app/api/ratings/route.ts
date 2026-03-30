import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ratings — Receive rating updates from the dashboard overlay.
 * The overlay posts here after each race to sync the driver's ratings
 * with the website backend. This is the bridge until iRacing OAuth
 * is approved and we can fetch ratings directly.
 *
 * Expected body: {
 *   discordId: string,
 *   category: 'road' | 'oval' | 'dirt_road' | 'dirt_oval' | 'sports_car',
 *   iRating: number,
 *   safetyRating: number,
 *   license: 'R' | 'D' | 'C' | 'B' | 'A' | 'P',
 *   carModel?: string,
 *   manufacturer?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const { discordId, category, iRating, safetyRating, license } = body
    if (!discordId || !category || iRating == null || safetyRating == null || !license) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // TODO: Validate auth token (Discord session or API key)
    // TODO: Store in Strapi or database
    // For now, log and acknowledge
    console.log('[K10 Ratings API] Received:', {
      discordId,
      category,
      iRating,
      safetyRating,
      license,
      carModel: body.carModel,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/**
 * GET /api/ratings?discordId=xxx — Fetch a driver's current ratings.
 */
export async function GET(request: NextRequest) {
  const discordId = request.nextUrl.searchParams.get('discordId')
  if (!discordId) {
    return NextResponse.json({ error: 'discordId required' }, { status: 400 })
  }

  // TODO: Fetch from Strapi or database
  // For now, return empty structure
  return NextResponse.json({
    discordId,
    ratings: {
      activeCategory: 'road',
      categories: {
        road: { category: 'road', iRating: 0, safetyRating: 0, license: 'R' },
        oval: { category: 'oval', iRating: 0, safetyRating: 0, license: 'R' },
        dirt_road: { category: 'dirt_road', iRating: 0, safetyRating: 0, license: 'R' },
        dirt_oval: { category: 'dirt_oval', iRating: 0, safetyRating: 0, license: 'R' },
        sports_car: { category: 'sports_car', iRating: 0, safetyRating: 0, license: 'R' },
      },
      updatedAt: new Date().toISOString(),
    },
    history: [],
    carSessions: [],
  })
}
