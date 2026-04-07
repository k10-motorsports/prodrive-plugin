import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════
//  Unsplash Background Image API
//  GET /api/unsplash/background?brand=porsche&theme=dark
//
//  Searches Unsplash for a landscape photo matching the brand +
//  theme, caches the result for 24 hours, and returns the URL.
//  Always includes "f1" in the query for motorsport relevance.
//  Falls back to generic "f1 car" if brand query is empty.
// ═══════════════════════════════════════════════════════════════

const UNSPLASH_API = 'https://api.unsplash.com/search/photos'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry {
  url: string
  blurHash: string | null
  photographer: string
  photographerUrl: string
  fetchedAt: number
}

// In-memory cache keyed by "brand|theme"
const cache = new Map<string, CacheEntry>()

async function searchUnsplash(query: string, accessKey: string): Promise<any[] | null> {
  const url = new URL(UNSPLASH_API)
  url.searchParams.set('query', query)
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('per_page', '10')
  url.searchParams.set('content_filter', 'high')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.warn(`[Unsplash] "${query}" → ${res.status} — ${body}`)
    if (res.status === 401 || res.status === 403) throw new Error('AUTH_FAILED')
    return null
  }

  const data = await res.json()
  const results = data.results as any[]
  console.log(`[Unsplash] "${query}" → ${results?.length ?? 0} results`)
  return results?.length ? results : null
}

export async function GET(req: NextRequest) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    return NextResponse.json(
      { error: 'UNSPLASH_ACCESS_KEY not configured' },
      { status: 503 }
    )
  }

  const { searchParams } = req.nextUrl
  const brand = (searchParams.get('brand') || '').trim()
  const theme = searchParams.get('theme') === 'light' ? 'light' : 'dark'

  const cacheKey = `${brand.toLowerCase()}|${theme}`

  // Return cached if fresh
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  }

  try {
    // Try brand-specific first, then generic fallback
    let results = brand
      ? await searchUnsplash(`${brand} f1 car ${theme}`, accessKey)
      : null

    if (!results) {
      results = await searchUnsplash(`f1 car ${theme}`, accessKey)
    }

    if (!results) {
      return NextResponse.json({ error: 'No results' }, { status: 404 })
    }

    const pick = results[Math.floor(Math.random() * results.length)]

    const entry: CacheEntry = {
      url: pick.urls?.regular || pick.urls?.full,
      blurHash: pick.blur_hash || null,
      photographer: pick.user?.name || 'Unknown',
      photographerUrl: pick.user?.links?.html || 'https://unsplash.com',
      fetchedAt: Date.now(),
    }

    cache.set(cacheKey, entry)

    return NextResponse.json(entry, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch (err: any) {
    if (err?.message === 'AUTH_FAILED') {
      return NextResponse.json(
        { error: 'Unsplash API auth failed. Check your UNSPLASH_ACCESS_KEY.' },
        { status: 502 }
      )
    }
    console.error('[Unsplash] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
