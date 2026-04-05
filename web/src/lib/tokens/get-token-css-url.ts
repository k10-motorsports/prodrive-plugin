import { db, schema } from '@/db'
import { eq, and, desc } from 'drizzle-orm'

/**
 * Get the latest built CSS blob URL for the web platform.
 * Returns null if no build exists yet (fallback CSS in globals.css handles this).
 */
export async function getTokenCssUrl(
  setSlug: string = 'default',
  themeId: string = 'dark'
): Promise<string | null> {
  try {
    const build = await db
      .select()
      .from(schema.tokenBuilds)
      .where(
        and(
          eq(schema.tokenBuilds.setSlug, setSlug),
          eq(schema.tokenBuilds.themeId, themeId),
          eq(schema.tokenBuilds.platform, 'web')
        )
      )
      .orderBy(desc(schema.tokenBuilds.builtAt))
      .limit(1)

    return build[0]?.blobUrl ?? null
  } catch {
    return null
  }
}
