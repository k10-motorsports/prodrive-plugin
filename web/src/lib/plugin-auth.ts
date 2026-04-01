/**
 * Plugin OAuth2 Authorization Server
 *
 * Flow:
 * 1. Plugin opens browser to /api/plugin-auth/authorize?code_challenge=...&state=...
 * 2. User logs in with Discord (if not already logged in via NextAuth)
 * 3. Server generates authorization code, redirects to localhost callback
 * 4. Plugin exchanges code for access token via /api/plugin-auth/token
 * 5. Plugin uses access token for /api/plugin-auth/verify to check status
 */

import { randomBytes, createHash } from 'crypto'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'

const ACCESS_TOKEN_EXPIRY_DAYS = 90
const AUTH_CODE_EXPIRY_MINUTES = 5

export function generateToken(): string {
  return randomBytes(48).toString('base64url')
}

export function generateAuthCode(): string {
  return randomBytes(24).toString('base64url')
}

/** Verify PKCE code_challenge against code_verifier */
export function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string = 'S256'): boolean {
  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url')
    return hash === codeChallenge
  }
  // plain method
  return codeVerifier === codeChallenge
}

/** Find or create a user from Discord profile */
export async function findOrCreateUser(discordId: string, username: string, displayName: string | null, avatar: string | null, email?: string | null) {
  const existing = await db.select().from(schema.users).where(eq(schema.users.discordId, discordId)).limit(1)

  if (existing.length > 0) {
    // Update profile fields
    await db.update(schema.users).set({
      discordUsername: username,
      discordDisplayName: displayName,
      discordAvatar: avatar,
      email: email ?? undefined,
      updatedAt: new Date(),
    }).where(eq(schema.users.discordId, discordId))
    return existing[0]
  }

  const result = await db.insert(schema.users).values({
    discordId,
    discordUsername: username,
    discordDisplayName: displayName,
    discordAvatar: avatar,
    email,
  }).returning()

  return result[0]
}

/** Create an authorization code for the plugin OAuth flow */
export async function createAuthCode(userId: string, codeChallenge?: string, codeChallengeMethod?: string) {
  const code = generateAuthCode()
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MINUTES * 60 * 1000)

  await db.insert(schema.authCodes).values({
    code,
    userId,
    codeChallenge: codeChallenge ?? null,
    codeChallengeMethod: codeChallengeMethod ?? null,
    expiresAt,
  })

  return code
}

/** Exchange an authorization code for access + refresh tokens */
export async function exchangeCode(code: string, codeVerifier?: string) {
  const rows = await db.select().from(schema.authCodes)
    .where(and(eq(schema.authCodes.code, code), eq(schema.authCodes.used, false)))
    .limit(1)

  if (rows.length === 0) return null
  const authCode = rows[0]

  // Check expiry
  if (new Date() > authCode.expiresAt) return null

  // PKCE verification
  if (authCode.codeChallenge && codeVerifier) {
    if (!verifyPKCE(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod ?? 'S256')) {
      return null
    }
  }

  // Mark code as used
  await db.update(schema.authCodes).set({ used: true }).where(eq(schema.authCodes.id, authCode.id))

  // Generate tokens
  const accessToken = generateToken()
  const refreshToken = generateToken()
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(schema.pluginTokens).values({
    userId: authCode.userId,
    accessToken,
    refreshToken,
    expiresAt,
  })

  return { accessToken, refreshToken, expiresAt: expiresAt.toISOString() }
}

/** Refresh an expired/active token pair */
export async function refreshTokenPair(refreshToken: string) {
  const rows = await db.select().from(schema.pluginTokens)
    .where(and(eq(schema.pluginTokens.refreshToken, refreshToken), eq(schema.pluginTokens.revoked, false)))
    .limit(1)

  if (rows.length === 0) return null

  // Revoke old pair
  await db.update(schema.pluginTokens).set({ revoked: true }).where(eq(schema.pluginTokens.id, rows[0].id))

  // Issue new pair
  const newAccessToken = generateToken()
  const newRefreshToken = generateToken()
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(schema.pluginTokens).values({
    userId: rows[0].userId,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt,
  })

  return { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresAt: expiresAt.toISOString() }
}

/** Validate an access token and return the user */
export async function validateToken(accessToken: string) {
  const rows = await db.select({
    token: schema.pluginTokens,
    user: schema.users,
  })
    .from(schema.pluginTokens)
    .innerJoin(schema.users, eq(schema.pluginTokens.userId, schema.users.id))
    .where(and(eq(schema.pluginTokens.accessToken, accessToken), eq(schema.pluginTokens.revoked, false)))
    .limit(1)

  if (rows.length === 0) return null

  const { token, user } = rows[0]

  // Check expiry
  if (new Date() > token.expiresAt) return null

  return {
    user: {
      id: user.id,
      discordId: user.discordId,
      discordUsername: user.discordUsername,
      discordDisplayName: user.discordDisplayName,
      discordAvatar: user.discordAvatar,
      customLogoUrl: user.customLogoUrl,
    },
    expiresAt: token.expiresAt.toISOString(),
  }
}

/** Revoke all plugin tokens for a user */
export async function revokeUserTokens(userId: string) {
  await db.update(schema.pluginTokens).set({ revoked: true }).where(eq(schema.pluginTokens.userId, userId))
}

/** Pro features list — what gets unlocked when connected */
export const PRO_FEATURES = [
  { key: 'commentary', label: 'AI Commentary' },
  { key: 'incidents', label: 'Incidents Panel' },
  { key: 'spotter', label: 'Virtual Spotter' },
  { key: 'leaderboard', label: 'Live Leaderboard' },
  { key: 'datastream', label: 'Datastream Telemetry' },
  { key: 'webgl', label: 'WebGL Effects' },
  { key: 'reflections', label: 'Ambient Reflections' },
  { key: 'modules', label: 'Module Customization' },
] as const
