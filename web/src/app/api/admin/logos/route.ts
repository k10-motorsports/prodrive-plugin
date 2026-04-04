import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc, ilike, sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'
import masterBrands from '@/data/master-brands.json'

// ── Types ──
interface MasterBrand {
  key: string
  name: string
  country: string
  defaultColor: string
  games: string[]
}

// ── GET /api/admin/logos — List all logos + missing brands ──
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = request.nextUrl.searchParams.get('search') || ''
  const game = request.nextUrl.searchParams.get('game') || ''
  const sort = request.nextUrl.searchParams.get('sort') || 'name-asc'

  // Fetch all logos from DB
  let logos = await db
    .select()
    .from(schema.carLogos)
    .orderBy(asc(schema.carLogos.brandName))

  // Apply search filter
  if (search) {
    const q = search.toLowerCase()
    logos = logos.filter(l =>
      l.brandName.toLowerCase().includes(q) || l.brandKey.toLowerCase().includes(q)
    )
  }

  // Apply game filter against master data
  const brands = masterBrands as MasterBrand[]
  const brandGameMap = new Map(brands.map(b => [b.key, b.games]))
  if (game) {
    logos = logos.filter(l => {
      const games = brandGameMap.get(l.brandKey) || []
      return games.includes(game)
    })
  }

  // Apply sort
  if (sort === 'name-desc') {
    logos.reverse()
  } else if (sort === 'recent') {
    logos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  // Compute missing: brands in master JSON but not in DB
  const dbKeys = new Set(logos.map(l => l.brandKey))
  let missing = brands
    .filter(b => !dbKeys.has(b.key))
    .map(b => ({ brandKey: b.key, brandName: b.name, country: b.country, defaultColor: b.defaultColor, games: b.games }))

  if (game) {
    missing = missing.filter(b => b.games.includes(game))
  }
  if (search) {
    const q = search.toLowerCase()
    missing = missing.filter(b => b.brandName.toLowerCase().includes(q) || b.brandKey.toLowerCase().includes(q))
  }

  // Strip raw SVG/PNG from list view (send only metadata)
  const logosForList = logos.map(l => ({
    id: l.id,
    brandKey: l.brandKey,
    brandName: l.brandName,
    brandColorHex: l.brandColorHex,
    hasSvg: !!l.logoSvg,
    hasPng: !!l.logoPng,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }))

  return NextResponse.json({ logos: logosForList, missing, total: logos.length })
}

// ── POST /api/admin/logos — Create or update a car logo ──
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { brandKey, brandName, logoSvg, logoPng, brandColorHex } = body

    if (!brandKey || !brandName) {
      return NextResponse.json({ error: 'brandKey and brandName are required' }, { status: 400 })
    }
    if (!logoSvg && !logoPng) {
      return NextResponse.json({ error: 'At least one of logoSvg or logoPng is required' }, { status: 400 })
    }

    // Validate SVG if provided
    if (logoSvg) {
      if (typeof logoSvg !== 'string' || !logoSvg.includes('<svg')) {
        return NextResponse.json({ error: 'logoSvg must be valid SVG markup' }, { status: 400 })
      }
      if (logoSvg.length > 500_000) {
        return NextResponse.json({ error: 'SVG exceeds 500KB limit' }, { status: 400 })
      }
    }

    // Validate PNG base64 if provided
    if (logoPng) {
      if (typeof logoPng !== 'string') {
        return NextResponse.json({ error: 'logoPng must be a base64 string' }, { status: 400 })
      }
      // ~2MB base64 limit (base64 is ~33% larger than raw)
      if (logoPng.length > 2_800_000) {
        return NextResponse.json({ error: 'PNG exceeds 2MB limit' }, { status: 400 })
      }
    }

    // Validate color hex
    if (brandColorHex && !/^#[0-9A-Fa-f]{6}$/.test(brandColorHex)) {
      return NextResponse.json({ error: 'brandColorHex must be a valid hex color (e.g. #FF0000)' }, { status: 400 })
    }

    const normalizedKey = brandKey.toLowerCase().trim()

    // Upsert: check if exists
    const existing = await db
      .select({ id: schema.carLogos.id })
      .from(schema.carLogos)
      .where(eq(schema.carLogos.brandKey, normalizedKey))
      .limit(1)

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = {
        brandName: brandName.trim(),
        updatedAt: new Date(),
      }
      if (logoSvg !== undefined) updateData.logoSvg = logoSvg
      if (logoPng !== undefined) updateData.logoPng = logoPng
      if (brandColorHex !== undefined) updateData.brandColorHex = brandColorHex

      await db
        .update(schema.carLogos)
        .set(updateData)
        .where(eq(schema.carLogos.brandKey, normalizedKey))

      return NextResponse.json({ success: true, status: 'replaced', brandKey: normalizedKey })
    }

    // Insert new
    await db
      .insert(schema.carLogos)
      .values({
        brandKey: normalizedKey,
        brandName: brandName.trim(),
        logoSvg: logoSvg || null,
        logoPng: logoPng || null,
        brandColorHex: brandColorHex || null,
      })

    return NextResponse.json({ success: true, status: 'created', brandKey: normalizedKey }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ── PATCH /api/admin/logos — Update brand color or name ──
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const { brandKey, brandName, brandColorHex } = body

    if (!brandKey) {
      return NextResponse.json({ error: 'brandKey is required' }, { status: 400 })
    }

    if (brandColorHex && !/^#[0-9A-Fa-f]{6}$/.test(brandColorHex)) {
      return NextResponse.json({ error: 'Invalid hex color' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (brandName) updateData.brandName = brandName.trim()
    if (brandColorHex !== undefined) updateData.brandColorHex = brandColorHex || null

    const updated = await db
      .update(schema.carLogos)
      .set(updateData)
      .where(eq(schema.carLogos.brandKey, brandKey.toLowerCase().trim()))
      .returning({ id: schema.carLogos.id, brandKey: schema.carLogos.brandKey })

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, ...updated[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ── DELETE /api/admin/logos?brandKey=xxx ──
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const brandKey = request.nextUrl.searchParams.get('brandKey')
  if (!brandKey) {
    return NextResponse.json({ error: 'brandKey is required' }, { status: 400 })
  }

  const deleted = await db
    .delete(schema.carLogos)
    .where(eq(schema.carLogos.brandKey, brandKey.toLowerCase().trim()))
    .returning({ id: schema.carLogos.id })

  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, brandKey: brandKey.toLowerCase().trim() })
}
