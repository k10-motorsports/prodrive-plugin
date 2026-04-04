import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc } from 'drizzle-orm'

/** GET /api/logos — Public endpoint: returns all car brand logos for the overlay.
 *  Optional query: ?brandKey=ferrari to fetch a single brand.
 *  Response is cacheable (1 hour). */
export async function GET(request: NextRequest) {
  const brandKey = request.nextUrl.searchParams.get('brandKey')

  if (brandKey) {
    const [logo] = await db
      .select()
      .from(schema.carLogos)
      .where(eq(schema.carLogos.brandKey, brandKey.toLowerCase().trim()))
      .limit(1)

    if (!logo) {
      return NextResponse.json({ error: 'Logo not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        brandKey: logo.brandKey,
        brandName: logo.brandName,
        logoSvg: logo.logoSvg,
        logoPng: logo.logoPng,
        brandColorHex: logo.brandColorHex,
      },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
    )
  }

  // Return all logos (lightweight: SVG included since overlay needs it)
  const logos = await db
    .select({
      brandKey: schema.carLogos.brandKey,
      brandName: schema.carLogos.brandName,
      logoSvg: schema.carLogos.logoSvg,
      brandColorHex: schema.carLogos.brandColorHex,
    })
    .from(schema.carLogos)
    .orderBy(asc(schema.carLogos.brandName))

  return NextResponse.json(
    { logos },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  )
}
