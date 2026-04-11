import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { seedDesignTokens } from '@/lib/tokens/seed'

// POST /api/admin/tokens/reseed — Push seed.ts base token values into the DB
// This upserts all tokens from the seed file, updating values for any that
// already exist. Useful after changing font families or adding new tokens.
export async function POST() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await seedDesignTokens()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reseed failed:', error)
    return NextResponse.json(
      { error: 'Reseed failed', details: String(error) },
      { status: 500 }
    )
  }
}
