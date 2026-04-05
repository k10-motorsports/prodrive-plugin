import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { buildCssFromTokens } from './sd-config'

export interface BuildResult {
  platform: string
  css: string
  hash: string
}

/**
 * Build CSS token files for a given theme.
 * Returns CSS strings for web and overlay platforms.
 */
export async function buildTokens(themeId: string = 'dark'): Promise<BuildResult[]> {
  // 1. Fetch all base tokens
  const baseTokens = await db.select().from(schema.designTokens)

  // 2. Fetch theme overrides (skip for 'dark' since base tokens ARE dark)
  let overrides: (typeof schema.themeOverrides.$inferSelect)[] = []
  if (themeId !== 'dark') {
    overrides = await db
      .select()
      .from(schema.themeOverrides)
      .where(eq(schema.themeOverrides.themeId, themeId))
  }

  // 3. Build override map
  const overrideMap = new Map(overrides.map((o) => [o.tokenPath, o.value]))

  // 4. Build for each platform
  const results: BuildResult[] = []

  for (const platform of ['web', 'overlay'] as const) {
    // Filter tokens for this platform
    const platformTokens = baseTokens.filter(
      (t) => t.platforms === 'both' || t.platforms === platform
    )

    // Apply overrides
    const mergedTokens = platformTokens.map((t) => ({
      ...t,
      value: overrideMap.get(t.path) ?? t.value,
    }))

    // Convert to nested token object for Style Dictionary
    const tokenObj = flatToNested(mergedTokens)

    // Build CSS
    const css = buildCssFromTokens(tokenObj, platform, themeId)

    // Generate hash
    const hash = generateHash(css)

    results.push({ platform, css, hash })
  }

  return results
}

/**
 * Convert flat DB rows to Style Dictionary nested JSON format.
 * "color.background.base" → { color: { background: { base: { $value: "...", ... } } } }
 */
function flatToNested(
  tokens: Array<{
    path: string
    value: string
    cssProperty: string
    kind: string
    description?: string | null
  }>
) {
  const result: Record<string, unknown> = {}

  for (const token of tokens) {
    const parts = token.path.split('.')
    let current = result

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {}
      }
      current = current[parts[i]] as Record<string, unknown>
    }

    const leaf = parts[parts.length - 1]
    current[leaf] = {
      $value: token.value,
      cssProperty: token.cssProperty,
      kind: token.kind,
      comment: token.description || undefined,
    }
  }

  return result
}

function generateHash(content: string): string {
  const { createHash } = require('crypto')
  return createHash('md5').update(content).digest('hex').slice(0, 8)
}
