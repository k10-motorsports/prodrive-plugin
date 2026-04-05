import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, asc } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'

// GET /api/admin/tokens — List all tokens + theme overrides
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const tokens = await db
      .select()
      .from(schema.designTokens)
      .orderBy(asc(schema.designTokens.sortOrder))

    const overrides = await db
      .select()
      .from(schema.themeOverrides)

    return NextResponse.json({ tokens, overrides })
  } catch (error) {
    console.error('Failed to fetch tokens:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/tokens — Batch upsert tokens
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = (await request.json()) as { tokens: Array<{ path: string; value: string }> }
    const { tokens } = body

    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    for (const token of tokens) {
      await db
        .update(schema.designTokens)
        .set({
          value: token.value,
          updatedAt: new Date(),
        })
        .where(eq(schema.designTokens.path, token.path))
    }

    return NextResponse.json({ updated: tokens.length })
  } catch (error) {
    console.error('Failed to update tokens:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
