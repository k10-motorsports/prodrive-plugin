import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * GET /api/user/logo
 *
 * Returns the user's custom logo URL.
 * Authentication: Bearer token in Authorization header
 *
 * Response: { logoUrl: string | null }
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const result = await validateToken(token)

  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  return NextResponse.json({
    logoUrl: result.user.customLogoUrl || null,
  })
}

/**
 * POST /api/user/logo
 *
 * Sets the user's custom logo URL.
 * Authentication: Bearer token in Authorization header
 *
 * Body: { logoUrl: string }
 * logoUrl must be a valid HTTPS URL (max 500 chars), or empty string to reset
 *
 * Response: { logoUrl: string }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const result = await validateToken(token)

  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const logoUrl = body.logoUrl?.trim() || ''

    // Validate URL if provided
    if (logoUrl) {
      if (logoUrl.length > 500) {
        return NextResponse.json(
          { error: 'logoUrl must be 500 characters or less' },
          { status: 400 }
        )
      }

      // Validate HTTPS URL
      try {
        const url = new URL(logoUrl)
        if (url.protocol !== 'https:') {
          return NextResponse.json(
            { error: 'logoUrl must use HTTPS protocol' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'logoUrl must be a valid URL' },
          { status: 400 }
        )
      }
    }

    // Update user's customLogoUrl in database
    await db.update(schema.users)
      .set({ customLogoUrl: logoUrl || null })
      .where(eq(schema.users.id, result.user.id))

    return NextResponse.json({
      logoUrl: logoUrl || null,
    })
  } catch (err) {
    console.error('[logo] POST error:', err)
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
