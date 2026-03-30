import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { findOrCreateUser, createAuthCode } from '@/lib/plugin-auth'

/**
 * GET /api/plugin-auth/authorize
 *
 * Plugin OAuth2 authorization endpoint.
 * Requires the user to be logged in via Discord (NextAuth session).
 * Returns an auth code to the plugin's localhost callback.
 *
 * Query params:
 *   - code_challenge: PKCE challenge (optional but recommended)
 *   - code_challenge_method: 'S256' (default) or 'plain'
 *   - state: opaque state value returned to plugin
 *   - redirect_uri: plugin's localhost callback (e.g. http://localhost:18492/callback)
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    // Not logged in — redirect to Discord login, then back here
    const returnUrl = request.nextUrl.toString()
    const loginUrl = new URL('/drive', request.nextUrl.origin)
    loginUrl.searchParams.set('callbackUrl', returnUrl)
    return NextResponse.redirect(loginUrl)
  }

  const { searchParams } = request.nextUrl
  const codeChallenge = searchParams.get('code_challenge')
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256'
  const state = searchParams.get('state') || ''
  const redirectUri = searchParams.get('redirect_uri') || 'http://localhost:18492/callback'

  // Validate redirect_uri is localhost
  try {
    const uri = new URL(redirectUri)
    if (uri.hostname !== 'localhost' && uri.hostname !== '127.0.0.1') {
      return NextResponse.json({ error: 'redirect_uri must be localhost' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid redirect_uri' }, { status: 400 })
  }

  // Get Discord profile from session — exposed via our JWT callback
  const user_ext = session.user as Record<string, unknown>
  const discordId = (user_ext.discordId as string) || session.user.email || ''
  const username = (user_ext.discordUsername as string) || session.user.name || ''
  const displayName = (user_ext.discordDisplayName as string) || username
  const avatar = (user_ext.discordAvatar as string) || session.user.image || null

  // Find or create user in our database
  const user = await findOrCreateUser(
    discordId,
    username,
    displayName,
    avatar,
    session.user.email,
  )

  // Generate auth code
  const code = await createAuthCode(
    user.id,
    codeChallenge ?? undefined,
    codeChallengeMethod,
  )

  // Redirect to plugin's localhost callback with code + state
  const callbackUrl = new URL(redirectUri)
  callbackUrl.searchParams.set('code', code)
  if (state) callbackUrl.searchParams.set('state', state)

  return NextResponse.redirect(callbackUrl.toString())
}
