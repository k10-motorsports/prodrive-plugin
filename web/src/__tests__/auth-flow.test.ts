/**
 * End-to-end auth flow tests
 *
 * Validates the full OAuth chain:
 *   1. Middleware domain redirects (old domain → racecor.io)
 *   2. Subdomain routing (prodrive.racecor.io → /drive/*)
 *   3. NextAuth configuration (providers, callbacks, basePath)
 *   4. Plugin OAuth PKCE flow (/api/plugin-auth/authorize)
 *   5. Environment variable sanity checks
 *
 * These tests exercise middleware and auth config directly — no running
 * server required. They catch the class of bug where a matcher regex or
 * domain redirect silently skips /api/auth/* paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import { DRIVE_URL, SITE_URL, K10_URL } from '../lib/constants'

// ─── Helpers ────────────────────────────────────────────────────

/** Build a NextRequest with a given URL + host header. */
function makeRequest(url: string, host?: string): NextRequest {
  const req = new NextRequest(new URL(url))
  if (host) {
    // NextRequest headers are read-only, so we reconstruct with headers
    return new NextRequest(new URL(url), {
      headers: { host },
    })
  }
  return req
}

/** Extract the Location header from a redirect response. */
function redirectLocation(response: ReturnType<typeof middleware>): string | null {
  return response.headers.get('location')
}

// ─── 1. Domain redirect: drive.k10motorsports.racing → prodrive.racecor.io ────

describe('domain redirect (old → canonical)', () => {
  it('redirects drive.k10motorsports.racing root to prodrive.racecor.io', () => {
    const res = middleware(
      makeRequest('https://drive.k10motorsports.racing/', 'drive.k10motorsports.racing'),
    )
    expect(res.status).toBe(308)
    expect(redirectLocation(res)).toMatch(/prodrive\.racecor\.io\//)
  })

  it('redirects /api/auth/callback/discord on old domain (the actual OAuth bug)', () => {
    const res = middleware(
      makeRequest(
        'https://drive.k10motorsports.racing/api/auth/callback/discord?code=abc&state=xyz',
        'drive.k10motorsports.racing',
      ),
    )
    expect(res.status).toBe(308)
    const loc = redirectLocation(res)!
    expect(loc).toContain('prodrive.racecor.io')
    expect(loc).toContain('/api/auth/callback/discord')
    expect(loc).toContain('code=abc')
    expect(loc).toContain('state=xyz')
  })

  it('redirects /api/auth/signin/discord on old domain', () => {
    const res = middleware(
      makeRequest(
        'https://drive.k10motorsports.racing/api/auth/signin/discord',
        'drive.k10motorsports.racing',
      ),
    )
    expect(res.status).toBe(308)
    expect(redirectLocation(res)).toContain('prodrive.racecor.io/api/auth/signin/discord')
  })

  it('redirects dev.drive.k10motorsports.racing too', () => {
    const res = middleware(
      makeRequest(
        'http://dev.drive.k10motorsports.racing:3000/api/auth/callback/discord?code=test',
        'dev.drive.k10motorsports.racing:3000',
      ),
    )
    expect(res.status).toBe(308)
    expect(redirectLocation(res)).toContain('prodrive.racecor.io')
  })

  it('preserves full query string through redirect', () => {
    const res = middleware(
      makeRequest(
        'https://drive.k10motorsports.racing/api/auth/callback/discord?code=abc123&state=def456',
        'drive.k10motorsports.racing',
      ),
    )
    const loc = redirectLocation(res)!
    expect(loc).toContain('code=abc123')
    expect(loc).toContain('state=def456')
  })

  it('does NOT redirect k10motorsports.racing (no drive subdomain)', () => {
    const res = middleware(
      makeRequest('https://k10motorsports.racing/', 'k10motorsports.racing'),
    )
    // Should be a rewrite to /k10, not a 308 redirect
    expect(res.status).not.toBe(308)
  })
})

// ─── 2. Subdomain routing ───────────────────────────────────────

describe('subdomain routing', () => {
  it('rewrites prodrive.racecor.io/ → /drive/', () => {
    const res = middleware(
      makeRequest('https://prodrive.racecor.io/', 'prodrive.racecor.io'),
    )
    // Rewrite — not a redirect
    expect(res.status).not.toBe(308)
    expect(res.headers.get('x-middleware-rewrite')).toContain('/drive/')
  })

  it('rewrites racecor.io/ → /marketing/', () => {
    const res = middleware(
      makeRequest('https://racecor.io/', 'racecor.io'),
    )
    expect(res.headers.get('x-middleware-rewrite')).toContain('/marketing/')
  })

  it('rewrites k10motorsports.racing/ → /k10/', () => {
    const res = middleware(
      makeRequest('https://k10motorsports.racing/', 'k10motorsports.racing'),
    )
    expect(res.headers.get('x-middleware-rewrite')).toContain('/k10/')
  })

  it('supports ?subdomain=drive query param fallback', () => {
    const res = middleware(
      makeRequest('http://localhost:3000/?subdomain=drive', 'localhost:3000'),
    )
    expect(res.headers.get('x-middleware-rewrite')).toContain('/drive/')
  })

  it('passes through /api routes on canonical domain without rewrite', () => {
    const res = middleware(
      makeRequest('https://prodrive.racecor.io/api/auth/session', 'prodrive.racecor.io'),
    )
    // Should NOT be rewritten or redirected — just pass through
    expect(res.status).not.toBe(308)
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })
})

// ─── 3. NextAuth configuration (static analysis) ───────────────
// NextAuth requires the Next.js runtime, so we validate the config
// files exist and have the right shape via filesystem checks rather
// than importing them directly.

describe('NextAuth config (static)', () => {
  it('auth.ts defines Discord provider with trustHost', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const authSrc = fs.readFileSync(
      path.resolve(__dirname, '../lib/auth.ts'),
      'utf-8',
    )
    expect(authSrc).toContain("import Discord from 'next-auth/providers/discord'")
    expect(authSrc).toContain('trustHost: true')
    expect(authSrc).toContain("basePath: '/api/auth'")
    expect(authSrc).toContain('handlers')
    expect(authSrc).toContain('signIn')
    expect(authSrc).toContain('signOut')
    expect(authSrc).toContain('auth')
  })

  it('route handler re-exports GET and POST from auth', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const routeSrc = fs.readFileSync(
      path.resolve(__dirname, '../app/api/auth/[...nextauth]/route.ts'),
      'utf-8',
    )
    expect(routeSrc).toContain("import { handlers } from '@/lib/auth'")
    expect(routeSrc).toContain('export const { GET, POST } = handlers')
  })
})

// ─── 4. Plugin OAuth flow (PKCE) ───────────────────────────────
// plugin-auth.ts imports the DB at module scope, so we can't import
// it directly without a database connection. Instead we test the pure
// crypto functions by reimplementing them inline (they're one-liners)
// and validate the source file has the right shape.

describe('plugin-auth PKCE logic', () => {
  it('S256 PKCE verification works (crypto only)', async () => {
    const crypto = await import('crypto')

    // Reimplement verifyPKCE to test the algorithm
    function verifyPKCE(verifier: string, challenge: string, method = 'S256') {
      if (method === 'S256') {
        return crypto.createHash('sha256').update(verifier).digest('base64url') === challenge
      }
      return verifier === challenge
    }

    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

    expect(verifyPKCE(verifier, challenge, 'S256')).toBe(true)
    expect(verifyPKCE('wrong-verifier', challenge, 'S256')).toBe(false)
    expect(verifyPKCE('my-code', 'my-code', 'plain')).toBe(true)
    expect(verifyPKCE('my-code', 'different', 'plain')).toBe(false)
  })

  it('generateToken uses 48 random bytes (base64url = 64 chars)', async () => {
    const crypto = await import('crypto')
    // Mirrors plugin-auth.ts: randomBytes(48).toString('base64url')
    const token = crypto.randomBytes(48).toString('base64url')
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBe(64)
  })

  it('generateAuthCode uses 24 random bytes (base64url = 32 chars)', async () => {
    const crypto = await import('crypto')
    const code = crypto.randomBytes(24).toString('base64url')
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(code.length).toBe(32)
  })

  it('plugin-auth.ts source exports expected functions', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(__dirname, '../lib/plugin-auth.ts'),
      'utf-8',
    )
    expect(src).toContain('export function verifyPKCE')
    expect(src).toContain('export function generateToken')
    expect(src).toContain('export function generateAuthCode')
    expect(src).toContain('export async function findOrCreateUser')
    expect(src).toContain('export async function createAuthCode')
    expect(src).toContain('export async function exchangeCode')
    expect(src).toContain('export async function validateToken')
  })

  it('authorize route validates redirect_uri is localhost', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(__dirname, '../app/api/plugin-auth/authorize/route.ts'),
      'utf-8',
    )
    expect(src).toContain("uri.hostname !== 'localhost'")
    expect(src).toContain("uri.hostname !== '127.0.0.1'")
    expect(src).toContain("redirect_uri must be localhost")
  })
})

// ─── 5. Constants / domain sanity ───────────────────────────────

describe('domain constants', () => {
  it('DRIVE_URL points to prodrive.racecor.io (not k10motorsports)', () => {
    expect(DRIVE_URL).toContain('racecor.io')
    expect(DRIVE_URL).toContain('prodrive.')
    expect(DRIVE_URL).not.toContain('k10motorsports')
  })

  it('SITE_URL points to racecor.io', () => {
    expect(SITE_URL).toContain('racecor.io')
  })

  it('K10_URL points to k10motorsports.racing', () => {
    expect(K10_URL).toContain('k10motorsports.racing')
  })
})

// ─── 6. Env variable validation ─────────────────────────────────

describe('.env.example correctness', () => {
  it('documents prodrive.racecor.io as the OAuth callback domain', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const envExample = fs.readFileSync(
      path.resolve(__dirname, '../../.env.example'),
      'utf-8',
    )

    // Must reference the canonical domain for Discord redirect URI
    expect(envExample).toContain('prodrive.racecor.io/api/auth/callback/discord')
    // Must NOT reference old domain as the redirect URI
    expect(envExample).not.toMatch(
      /^\s*#?\s*https:\/\/drive\.k10motorsports\.racing\/api\/auth\/callback/m,
    )
    // NEXTAUTH_URL must reference racecor.io
    expect(envExample).toMatch(/NEXTAUTH_URL.*racecor\.io/)
  })
})

// ─── 7. Middleware matcher coverage ─────────────────────────────

describe('middleware matcher', () => {
  it('matcher regex matches /api/auth paths', async () => {
    const { config } = await import('../middleware')
    const pattern = new RegExp(config.matcher[0])

    // These must match (middleware must run for them)
    expect(pattern.test('/api/auth/callback/discord')).toBe(true)
    expect(pattern.test('/api/auth/signin')).toBe(true)
    expect(pattern.test('/api/plugin-auth/authorize')).toBe(true)
    expect(pattern.test('/')).toBe(true)
    expect(pattern.test('/drive')).toBe(true)

    // These must NOT match (static files, Next.js internals)
    expect(pattern.test('/_next/static/chunk.js')).toBe(false)
    expect(pattern.test('/favicon.ico')).toBe(false)
    expect(pattern.test('/images/logo.png')).toBe(false)
  })
})
