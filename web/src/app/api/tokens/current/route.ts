import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, and, desc } from 'drizzle-orm'

// GET /api/tokens/current?set=default — Returns latest blob URLs for a theme set
// The ?set param is optional; defaults to 'default' for backward compatibility.
// Overlay doesn't need a rebuild — it just adds ?set=slug when the user picks a set.
export async function GET(request: NextRequest) {
  try {
    const setSlug = request.nextUrl.searchParams.get('set') || 'default'

    const builds = await db
      .select()
      .from(schema.tokenBuilds)
      .where(
        and(
          eq(schema.tokenBuilds.setSlug, setSlug),
          eq(schema.tokenBuilds.themeId, 'dark')
        )
      )
      .orderBy(desc(schema.tokenBuilds.builtAt))

    const result: Record<string, { url: string; hash: string }> = {}

    for (const build of builds) {
      if (!result[build.platform]) {
        result[build.platform] = {
          url: build.blobUrl,
          hash: build.hash,
        }
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Failed to fetch current tokens:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
