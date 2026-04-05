import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'

// GET /api/admin/theme-sets — List all theme sets
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const sets = await db
      .select()
      .from(schema.themeSets)
      .orderBy(asc(schema.themeSets.sortOrder))

    return NextResponse.json({ sets })
  } catch (error) {
    console.error('Failed to fetch theme sets:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/theme-sets — Create or update a theme set
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = (await request.json()) as {
      slug: string
      name: string
      description?: string
      liveryImage?: string
      sortOrder?: number
    }

    if (!body.slug || !body.name) {
      return NextResponse.json({ error: 'slug and name are required' }, { status: 400 })
    }

    // Upsert
    const existing = await db
      .select()
      .from(schema.themeSets)
      .where(eq(schema.themeSets.slug, body.slug))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(schema.themeSets)
        .set({
          name: body.name,
          description: body.description ?? existing[0].description,
          liveryImage: body.liveryImage ?? existing[0].liveryImage,
          sortOrder: body.sortOrder ?? existing[0].sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(schema.themeSets.slug, body.slug))
    } else {
      await db.insert(schema.themeSets).values({
        slug: body.slug,
        name: body.name,
        description: body.description || null,
        liveryImage: body.liveryImage || null,
        sortOrder: body.sortOrder ?? 99,
      })
    }

    return NextResponse.json({ success: true, slug: body.slug })
  } catch (error) {
    console.error('Failed to upsert theme set:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
