import { NextRequest, NextResponse } from 'next/server'
import { buildTokens } from '@/lib/tokens/build'

// GET /api/tokens/css/[platform] — Dynamically render CSS from DB (dev/preview fallback)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params

    if (platform !== 'web' && platform !== 'overlay') {
      return new NextResponse('Invalid platform. Use "web" or "overlay".', { status: 400 })
    }

    const setSlug = request.nextUrl.searchParams.get('set') || 'default'
    const results = await buildTokens(setSlug)
    const result = results.find((r) => r.platform === platform)

    if (!result) {
      return new NextResponse('Build failed', { status: 500 })
    }

    return new NextResponse(result.css, {
      headers: {
        'Content-Type': 'text/css',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Failed to build CSS:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
