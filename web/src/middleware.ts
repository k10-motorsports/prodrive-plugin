import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Subdomain routing middleware.
 *
 * Production:
 *   - k10motorsports.racing        → /marketing/* (public website)
 *   - drive.k10motorsports.racing   → /drive/*     (K10 Pro Drive members app)
 *
 * Dev (via /etc/hosts):
 *   - dev.k10motorsports.racing:3000       → /marketing/*
 *   - dev.drive.k10motorsports.racing:3000 → /drive/*
 *
 * Fallback: ?subdomain=drive query param works in any environment.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Skip Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // Detect drive subdomain — matches both:
  //   drive.k10motorsports.racing     (production)
  //   dev.drive.k10motorsports.racing  (local dev)
  const isDrive =
    host.includes('drive.') ||
    request.nextUrl.searchParams.get('subdomain') === 'drive'

  if (isDrive) {
    if (!pathname.startsWith('/drive')) {
      return NextResponse.rewrite(new URL(`/drive${pathname}`, request.url))
    }
  } else {
    if (!pathname.startsWith('/marketing') && !pathname.startsWith('/drive')) {
      return NextResponse.rewrite(new URL(`/marketing${pathname}`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
