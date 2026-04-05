import { put, del } from '@vercel/blob'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import type { BuildResult } from './build'

/**
 * Upload built CSS to Vercel Blob Storage and update the tokenBuilds table.
 */
export async function uploadTokenBuild(
  results: BuildResult[],
  themeId: string,
  builtBy?: string // user ID
) {
  const uploads = []

  for (const result of results) {
    const pathname = `tokens/${themeId}/${result.platform}-${result.hash}.css`

    // Upload to Vercel Blob
    const blob = await put(pathname, result.css, {
      access: 'public',
      contentType: 'text/css',
      addRandomSuffix: false,
    })

    // Upsert into tokenBuilds — keep only latest per theme+platform
    // First, try to find existing build for this theme+platform
    const existing = await db
      .select()
      .from(schema.tokenBuilds)
      .where(
        and(
          eq(schema.tokenBuilds.themeId, themeId),
          eq(schema.tokenBuilds.platform, result.platform)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(schema.tokenBuilds)
        .set({
          blobUrl: blob.url,
          hash: result.hash,
          builtAt: new Date(),
          builtBy: builtBy || null,
        })
        .where(eq(schema.tokenBuilds.id, existing[0].id))

      // Try to delete old blob (best-effort)
      try {
        await del(existing[0].blobUrl)
      } catch {
        // Ignore deletion failures
      }
    } else {
      // Insert new record
      await db.insert(schema.tokenBuilds).values({
        themeId,
        platform: result.platform,
        blobUrl: blob.url,
        hash: result.hash,
        builtBy: builtBy || null,
      })
    }

    uploads.push({
      platform: result.platform,
      url: blob.url,
      hash: result.hash,
    })
  }

  return uploads
}
