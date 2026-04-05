import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'

// POST /api/admin/themes — Create/update theme overrides for a specific set
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = (await request.json()) as {
      setSlug?: string
      themeId: string
      overrides: Array<{ tokenPath: string; value: string }>
    }
    const { themeId, overrides } = body
    const setSlug = body.setSlug || 'default'

    if (!themeId || !overrides || !Array.isArray(overrides)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    for (const override of overrides) {
      // Check if override exists for this set+theme+token
      const existing = await db
        .select()
        .from(schema.themeOverrides)
        .where(
          and(
            eq(schema.themeOverrides.setSlug, setSlug),
            eq(schema.themeOverrides.themeId, themeId),
            eq(schema.themeOverrides.tokenPath, override.tokenPath)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(schema.themeOverrides)
          .set({ value: override.value, updatedAt: new Date() })
          .where(eq(schema.themeOverrides.id, existing[0].id))
      } else {
        await db.insert(schema.themeOverrides).values({
          setSlug,
          themeId,
          tokenPath: override.tokenPath,
          value: override.value,
        })
      }
    }

    return NextResponse.json({ updated: overrides.length })
  } catch (error) {
    console.error('Failed to update theme overrides:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
