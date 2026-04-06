import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/tracks?trackName=xxx — Resolve display name for a track.
 *
 * Public endpoint (no auth) used by the overlay to show user-defined
 * display names instead of raw game-provided track names.
 *
 * Returns: { trackName, displayName, trackId }
 * displayName is null if no custom name has been set.
 */
export async function GET(request: NextRequest) {
  const trackName = request.nextUrl.searchParams.get('trackName')

  if (!trackName) {
    return NextResponse.json({ error: 'trackName query param required' }, { status: 400 })
  }

  // Try exact match on trackName first (game-provided name)
  let results = await db
    .select({
      trackId: schema.trackMaps.trackId,
      trackName: schema.trackMaps.trackName,
      displayName: schema.trackMaps.displayName,
      sectorCount: schema.trackMaps.sectorCount,
      sectorBoundaries: schema.trackMaps.sectorBoundaries,
    })
    .from(schema.trackMaps)
    .where(eq(schema.trackMaps.trackName, trackName.trim()))
    .limit(1)

  // Fall back to trackId slug match
  if (results.length === 0) {
    const slug = trackName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    results = await db
      .select({
        trackId: schema.trackMaps.trackId,
        trackName: schema.trackMaps.trackName,
        displayName: schema.trackMaps.displayName,
        sectorCount: schema.trackMaps.sectorCount,
        sectorBoundaries: schema.trackMaps.sectorBoundaries,
      })
      .from(schema.trackMaps)
      .where(eq(schema.trackMaps.trackId, slug))
      .limit(1)
  }

  if (results.length === 0) {
    return NextResponse.json({ trackName, displayName: trackName, trackId: null, sectorCount: 3, sectorBoundaries: null })
  }

  const track = results[0]
  const parsedBoundaries = track.sectorBoundaries ? JSON.parse(track.sectorBoundaries) : null
  return NextResponse.json({
    trackId: track.trackId,
    trackName: track.trackName,
    displayName: track.displayName || track.trackName,
    sectorCount: track.sectorCount,
    sectorBoundaries: parsedBoundaries,
  })
}
