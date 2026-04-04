import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'
import { csvToSvg, generateSvgPreview } from '@/lib/track-svg'

import { logConnection } from '@/lib/connection-logger'
/** GET /api/admin/tracks — List all track maps */
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tracks = await db
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
    .orderBy(desc(schema.trackMaps.updatedAt))

  return NextResponse.json({ tracks })
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
