import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, refreshTokenPair } from '@/lib/plugin-auth'

/**
 * POST /api/plugin-auth/token
 *
 * Token exchange endpoint. Accepts either:
 * - grant_type=authorization_code + code + code_verifier (PKCE)
 * - grant_type=refresh_token + refresh_token
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const grantType = body.grant_type

  if (grantType === 'authorization_code') {
    const { code, code_verifier } = body
    if (!code) {
      return NextResponse.json({ error: 'missing_code' }, { status: 400 })
    }

    const tokens = await exchangeCode(code, code_verifier)
    if (!tokens) {
      return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
    }

    return NextResponse.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_at: tokens.expiresAt,
    })
  }

  if (grantType === 'refresh_token') {
    const { refresh_token } = body
    if (!refresh_token) {
      return NextResponse.json({ error: 'missing_refresh_token' }, { status: 400 })
    }

    const tokens = await refreshTokenPair(refresh_token)
    if (!tokens) {
      return NextResponse.json({ error: 'invalid_refresh_token' }, { status: 400 })
    }

    return NextResponse.json({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: 'Bearer',
      expires_at: tokens.expiresAt,
    })
  }

  return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
}
