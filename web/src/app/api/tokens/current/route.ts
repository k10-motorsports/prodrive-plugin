import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'

// GET /api/tokens/current — Returns latest blob URLs for active theme
export async function GET() {
  try {
    const builds = await db
      .select()
      .from(schema.tokenBuilds)
      .where(eq(schema.tokenBuilds.themeId, 'dark')) // default theme
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
