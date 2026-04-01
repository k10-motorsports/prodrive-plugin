import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Subdomain routing middleware — three sites from one Next.js app.
 *
 * Production:
 *   - racecor.io                     → /marketing/* (product site)
 *   - prodrive.racecor.io            → /drive/*     (Pro Drive members area)
 *   - k10motorsports.racing          → /k10/*       (org hub)
 *   - drive.k10motorsports.racing    → 308 redirect to prodrive.racecor.io (canonical for OAuth)
 *
 * Dev (via /etc/hosts):
 *   - dev.racecor.io:3000            → /marketing/*
 *   - dev.prodrive.racecor.io:3000   → /drive/*
 *   - dev.k10motorsports.racing:3000 → /k10/*
 *
 * Fallback: ?subdomain=drive or ?subdomain=k10 query param works in any environment.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // ── Domain redirect (runs BEFORE any path filtering) ──────────
  // Redirect drive.k10motorsports.racing → prodrive.racecor.io so OAuth
  // callbacks (including /api/auth/*) always resolve to a single
  // canonical domain. Without this, Discord redirects back to the old
  // domain and NextAuth returns a Configuration error.
  if (host.includes('drive.k10motorsports.racing') || host.includes('dev.drive.k10motorsports.racing')) {
    const racecorHost = host.replace(/drive\..*k10motorsports\.racing/, 'prodrive.racecor.io')
    const dest = new URL(request.url)
    dest.host = racecorHost
    return NextResponse.redirect(dest, 308)
  }

  // ── Skip non-page routes ──────────────────────────────────────
  const subdomain = request.nextUrl.searchParams.get('subdomain')

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Redirect drive.k10motorsports.racing → prodrive.racecor.io so OAuth
  // callbacks always resolve to a single canonical domain.
  if (host.includes('drive.k10motorsports.racing') || host.includes('dev.drive.k10motorsports.racing')) {
    const racecorHost = host.replace(/drive\..*k10motorsports\.racing/, 'prodrive.racecor.io')
    const dest = new URL(request.url)
    dest.host = racecorHost
    return NextResponse.redirect(dest, 308)
  }

  // Detect subdomain — prioritize query param, then host header
  let targetPath = '/marketing' // default

  if (host.includes('prodrive.') || subdomain === 'drive') {
    targetPath = '/drive'
  } else if (host.includes('k10motorsports.racing')) {
    targetPath = '/k10'
  }

  // Rewrite if not already at target path
  if (!pathname.startsWith(targetPath) && !pathname.startsWith('/drive') && !pathname.startsWith('/k10') && !pathname.startsWith('/marketing')) {
    return NextResponse.rewrite(new URL(`${targetPath}${pathname}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Match everything EXCEPT Next.js internals and static files.
  // api/auth on the old domain is handled by the domain redirect above,
  // which must run before the path filter — so we include /api/auth here.
  matcher: [
    '/((?!_next|.*\\..*).*)',
  ],
}
