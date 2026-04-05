import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { buildCssFromTokens } from './sd-config'

export interface BuildResult {
  platform: string
  css: string
  hash: string
}

/**
 * Build CSS token files that include both dark (base) and light theme blocks.
 * Each blob contains:
 *   :root { /* dark/base tokens */ }
 *   [data-theme="light"] { /* light overrides */ }
 *
 * Returns CSS strings for web and overlay platforms.
 */
export async function buildTokens(themeId: string = 'dark'): Promise<BuildResult[]> {
  // 1. Fetch all base tokens
  const baseTokens = await db.select().from(schema.designTokens)

  // 2. Fetch light theme overrides
  const lightOverrides = await db
    .select()
    .from(schema.themeOverrides)
    .where(eq(schema.themeOverrides.themeId, 'light'))

  const lightOverrideMap = new Map(lightOverrides.map((o) => [o.tokenPath, o.value]))

  // 3. Build for each platform
  const results: BuildResult[] = []

  for (const platform of ['web', 'overlay'] as const) {
    // Filter tokens for this platform
    const platformTokens = baseTokens.filter(
      (t) => t.platforms === 'both' || t.platforms === platform
    )

    // ── Dark theme (base) ──
    const darkTokenObj = flatToNested(platformTokens)
    const darkCss = buildCssFromTokens(darkTokenObj, platform, 'dark')

    // ── Light theme (only overridden tokens) ──
    const lightTokens = platformTokens
      .filter((t) => lightOverrideMap.has(t.path))
      .map((t) => ({
        ...t,
        value: lightOverrideMap.get(t.path)!,
      }))

    let lightCss = ''
    if (lightTokens.length > 0) {
      const lightTokenObj = flatToNested(lightTokens)
      lightCss = buildCssFromTokens(lightTokenObj, platform, 'light')
    }

    // ── Combine into single CSS blob ──
    const parts = [
      '/* K10 Design Tokens — Auto-generated */',
      '/* Dark theme (base) */',
      darkCss,
    ]

    if (lightCss) {
      parts.push('')
      parts.push('/* Light theme overrides */')
      parts.push(lightCss)
    }

    const css = parts.join('\n')

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
