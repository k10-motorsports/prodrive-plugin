import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { PRO_FEATURES } from '@/lib/plugin-auth'

/**
 * GET /api/plugin-auth/verify
 *
 * Token verification endpoint. The plugin calls this on startup and periodically
 * to confirm its token is valid and get the user's profile + feature entitlements.
 *
 * Headers: Authorization: Bearer <access_token>
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

  // All authenticated users get all pro features (for now — could be tier-gated later)
  const features = PRO_FEATURES.map(f => f.key)

  return NextResponse.json({
    user: result.user,
    features,
    expires_at: result.expiresAt,
  })
}
