import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Subdomain routing middleware — three sites from one Next.js app.
 *
 * Production:
 *   - racecor.io                     → /marketing/* (product site)
 *   - drive.racecor.io               → /drive/*     (Pro Drive members area)
 *   - k10motorsports.racing          → /k10/*       (org hub)
 *   - drive.k10motorsports.racing    → /drive/*     (fallback to drive.racecor.io)
 *
 * Dev (via /etc/hosts):
 *   - dev.racecor.io:3000            → /marketing/*
 *   - dev.drive.racecor.io:3000      → /drive/*
 *   - dev.k10motorsports.racing:3000 → /k10/*
 *
 * Fallback: ?subdomain=drive or ?subdomain=k10 query param works in any environment.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  const subdomain = request.nextUrl.searchParams.get('subdomain')

  // Skip Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Detect subdomain — prioritize query param, then host header
  let targetPath = '/marketing' // default

  if (host.includes('drive.') || subdomain === 'drive') {
    targetPath = '/drive'
  } else if (host.includes('k10motorsports.racing') && !host.includes('drive.')) {
    targetPath = '/k10'
  }

  // Rewrite if not already at target path
  if (!pathname.startsWith(targetPath) && !pathname.startsWith('/drive') && !pathname.startsWith('/k10') && !pathname.startsWith('/marketing')) {
    return NextResponse.rewrite(new URL(`${targetPath}${pathname}`, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
