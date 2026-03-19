import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Subdomain routing middleware.
 * - drive.k10motorsports.com → /drive/* routes (K10 Pro Drive members app)
 * - k10motorsports.com → /marketing/* routes (public website)
 *
 * In local dev, use ?subdomain=drive to simulate.
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

  // Detect subdomain
  const isDrive =
    host.startsWith('drive.') ||
    request.nextUrl.searchParams.get('subdomain') === 'drive'

  if (isDrive) {
    // Rewrite drive.k10motorsports.com/* → /drive/*
    if (!pathname.startsWith('/drive')) {
      return NextResponse.rewrite(new URL(`/drive${pathname}`, request.url))
    }
  } else {
    // Rewrite k10motorsports.com/* → /marketing/*
    if (!pathname.startsWith('/marketing') && !pathname.startsWith('/drive')) {
      return NextResponse.rewrite(new URL(`/marketing${pathname}`, request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
