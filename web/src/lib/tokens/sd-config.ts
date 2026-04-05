/**
 * Build CSS custom properties from a nested token object.
 * Direct generation without Style Dictionary file I/O (serverless-safe).
 * Style Dictionary transforms can be layered in later for complex use cases.
 */
export function buildCssFromTokens(
  tokens: Record<string, unknown>,
  platform: 'web' | 'overlay',
  themeId: string
): string {
  const selector = themeId === 'dark' ? ':root' : `[data-theme="${themeId}"]`
  const props: string[] = []

  function walk(obj: Record<string, unknown>) {
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object' && '$value' in (val as Record<string, unknown>)) {
        const token = val as Record<string, unknown>
        const name = (token.cssProperty as string) || `--${key}`
        let value = String(token.$value)

        // Platform transform: web backgrounds get solid alpha
        if (platform === 'web' && token.kind === 'color' && name.startsWith('--bg')) {
          value = forceOpaqueAlpha(value)
        }

        props.push(`  ${name}: ${value};`)
      } else if (val && typeof val === 'object') {
        walk(val as Record<string, unknown>)
      }
    }
  }

  walk(tokens)
  return `${selector} {\n${props.join('\n')}\n}`
}

/**
 * Force alpha channel to 1.0 for web backgrounds.
 * Web pages have solid backgrounds unlike the transparent overlay window.
 */
function forceOpaqueAlpha(value: string): string {
  // hsla(0, 0%, 8%, 0.90) → hsla(0, 0%, 8%, 1.0)
  const hslaMatch = value.match(/^hsla\((.+),\s*([\d.]+)\)$/)
  if (hslaMatch) {
    return `hsla(${hslaMatch[1]}, 1.0)`
  }

  // rgba(16, 16, 32, 0.90) → rgba(16, 16, 32, 1.0)
  const rgbaMatch = value.match(/^rgba\((.+),\s*([\d.]+)\)$/)
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, 1.0)`
  }

  return value
}
