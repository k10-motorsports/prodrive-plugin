import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const GITHUB_REPO = 'alternatekev/media-coach-simhub-plugin'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

/**
 * GET /api/download/latest
 *
 * Proxy for the latest GitHub release .zip asset.
 * Requires authentication (Discord login via NextAuth session).
 * Resolves the latest release and redirects to the .zip download URL.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const res = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'K10-Motorsports-Web',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch release info' }, { status: 502 })
    }

    const release = await res.json()

    // Find the .zip asset (installer)
    const zipAsset = release.assets?.find((a: { name: string }) =>
      a.name.endsWith('.zip') || a.name.includes('Setup')
    )

    if (zipAsset?.browser_download_url) {
      return NextResponse.redirect(zipAsset.browser_download_url)
    }

    // Fallback to the zipball (source archive)
    if (release.zipball_url) {
      return NextResponse.redirect(release.zipball_url)
    }

    return NextResponse.json({ error: 'No download asset found' }, { status: 404 })
  } catch (err) {
    console.error('[download/latest] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
