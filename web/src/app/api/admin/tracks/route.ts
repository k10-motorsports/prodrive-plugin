import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc, desc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'
import { csvToSvg, generateSvgPreview } from '@/lib/track-svg'
import { logConnection } from '@/lib/connection-logger'
import masterTracks from '@/data/master-tracks.json'

interface MasterTrack {
  id: string
  name: string
  games: string[]
}

/** GET /api/admin/tracks — List all track maps + missing tracks */
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = request.nextUrl.searchParams.get('search') || ''
  const game = request.nextUrl.searchParams.get('game') || ''
  const sort = request.nextUrl.searchParams.get('sort') || 'name-asc'

  // Fetch all tracks
  let tracks = await db
    .select({
      id: schema.trackMaps.id,
      trackId: schema.trackMaps.trackId,
      trackName: schema.trackMaps.trackName,
      displayName: schema.trackMaps.displayName,
      svgPath: schema.trackMaps.svgPath,
      pointCount: schema.trackMaps.pointCount,
      gameName: schema.trackMaps.gameName,
      trackLengthKm: schema.trackMaps.trackLengthKm,
      createdAt: schema.trackMaps.createdAt,
      updatedAt: schema.trackMaps.updatedAt,
    })
    .from(schema.trackMaps)
    .orderBy(asc(schema.trackMaps.trackName))

  // Apply search
  if (search) {
    const q = search.toLowerCase()
    tracks = tracks.filter(t =>
      t.trackName.toLowerCase().includes(q) ||
      t.trackId.toLowerCase().includes(q) ||
      (t.displayName && t.displayName.toLowerCase().includes(q))
    )
  }

  // Apply game filter
  if (game) {
    tracks = tracks.filter(t => (t.gameName || 'iracing').toLowerCase() === game.toLowerCase())
  }

  // Apply sort
  if (sort === 'name-desc') {
    tracks.sort((a, b) => b.trackName.localeCompare(a.trackName))
  } else if (sort === 'name-asc') {
    tracks.sort((a, b) => a.trackName.localeCompare(b.trackName))
  } else if (sort === 'recent') {
    tracks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  // Compute missing tracks (in master JSON but not uploaded)
  const dbTrackIds = new Set(tracks.map(t => t.trackId))
  const allMasterTracks = masterTracks as MasterTrack[]
  let missing = allMasterTracks
    .filter(t => !dbTrackIds.has(t.id))
    .map(t => ({ trackId: t.id, name: t.name, games: t.games }))

  if (game) {
    missing = missing.filter(t => t.games.includes(game.toLowerCase()))
  }
  if (search) {
    const q = search.toLowerCase()
    missing = missing.filter(t => t.name.toLowerCase().includes(q) || t.trackId.toLowerCase().includes(q))
  }

  return NextResponse.json({ tracks, missing, total: tracks.length })
}

/** POST /api/admin/tracks — Upload CSV to create/replace a track map */
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { trackId, trackName, displayName, rawCsv, gameName, trackLengthKm } = body

    if (!trackId || !trackName || !rawCsv) {
      return NextResponse.json(
        { error: 'Missing required fields: trackId, trackName, rawCsv' },
        { status: 400 }
      )
    }

    const normalizedTrackId = trackId.toLowerCase().trim()

    // Generate SVG from CSV
    const { svgPath, pointCount, svgPreview } = csvToSvg(rawCsv, trackName.trim())

    // Check if track exists — if so, replace it
    const existing = await db
      .select({ id: schema.trackMaps.id })
      .from(schema.trackMaps)
      .where(eq(schema.trackMaps.trackId, normalizedTrackId))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(schema.trackMaps)
        .set({
          trackName: trackName.trim(),
          displayName: displayName?.trim() || null,
          svgPath,
          pointCount,
          rawCsv: rawCsv.trim(),
          gameName: (gameName || 'iracing').toLowerCase().trim(),
          trackLengthKm: trackLengthKm ? Number(trackLengthKm) : null,
          svgPreview,
          updatedAt: new Date(),
        })
        .where(eq(schema.trackMaps.trackId, normalizedTrackId))

      return NextResponse.json({
        success: true,
        status: 'replaced',
        trackId: normalizedTrackId,
        pointCount,
      })
    }

    // Insert new
    const result = await db
      .insert(schema.trackMaps)
      .values({
        trackId: normalizedTrackId,
        trackName: trackName.trim(),
        displayName: displayName?.trim() || null,
        svgPath,
        pointCount,
        rawCsv: rawCsv.trim(),
        gameName: (gameName || 'iracing').toLowerCase().trim(),
        trackLengthKm: trackLengthKm ? Number(trackLengthKm) : null,
        svgPreview,
      })
      .returning({ id: schema.trackMaps.id })

    return NextResponse.json({
      success: true,
      status: 'created',
      trackId: normalizedTrackId,
      mapId: result[0].id,
      pointCount,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/** PATCH /api/admin/tracks — Update track display name */
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { trackId, displayName } = body

    if (!trackId) {
      return NextResponse.json({ error: 'trackId required' }, { status: 400 })
    }

    const normalizedId = trackId.toLowerCase().trim()

    const updated = await db
      .update(schema.trackMaps)
      .set({
        displayName: displayName?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.trackMaps.trackId, normalizedId))
      .returning({ id: schema.trackMaps.id, trackId: schema.trackMaps.trackId, displayName: schema.trackMaps.displayName })

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Track map not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, ...updated[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/** DELETE /api/admin/tracks?trackId=xxx — Remove a track map */
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const trackId = request.nextUrl.searchParams.get('trackId')
  if (!trackId) {
    return NextResponse.json({ error: 'trackId required' }, { status: 400 })
  }

  const normalizedId = trackId.toLowerCase().trim()
  const deleted = await db
    .delete(schema.trackMaps)
    .where(eq(schema.trackMaps.trackId, normalizedId))
    .returning({ id: schema.trackMaps.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Track map not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, trackId: normalizedId })
}
