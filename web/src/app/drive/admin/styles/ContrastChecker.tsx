'use client'

interface DesignToken {
  id: string
  path: string
  value: string
  kind: string
  cssProperty: string
  description: string | null
  wcag: string | null
  platforms: string
  category: string
  sortOrder: number
}

interface ContrastResult {
  name: string
  fgColor: string
  bgColor: string
  ratio: number
  grade: 'AAA' | 'AA' | 'AA-large' | 'FAIL'
}

interface RGB {
  r: number
  g: number
  b: number
  a: number
}

// Parse any CSS color to RGB {r, g, b, a}
function parseColor(color: string): RGB | null {
  const trimmed = color.trim()

  // Handle hex colors: #RGB, #RRGGBB, #RRGGBBAA
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    let r: number, g: number, b: number, a: number = 1

    if (hex.length === 3) {
      // #RGB
      r = parseInt(hex[0] + hex[0], 16)
      g = parseInt(hex[1] + hex[1], 16)
      b = parseInt(hex[2] + hex[2], 16)
    } else if (hex.length === 6) {
      // #RRGGBB
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    } else if (hex.length === 8) {
      // #RRGGBBAA
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
      a = parseInt(hex.slice(6, 8), 16) / 255
    } else {
      return null
    }

    return { r, g, b, a }
  }

  // Handle rgb() and rgba()
  const rgbMatch = trimmed.match(
    /rgba?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)/
  )
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10)
    const g = parseInt(rgbMatch[2], 10)
    const b = parseInt(rgbMatch[3], 10)
    const a = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    return { r, g, b, a }
  }

  // Handle hsl() and hsla()
  const hslMatch = trimmed.match(
    /hsla?\s*\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)/
  )
  if (hslMatch) {
    const h = parseFloat(hslMatch[1])
    const s = parseFloat(hslMatch[2])
    const l = parseFloat(hslMatch[3])
    const a = hslMatch[4] ? parseFloat(hslMatch[4]) : 1
    const { r, g, b } = hslToRgb(h, s, l)
    return { r, g, b, a }
  }

  return null
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  }
}

// Relative luminance per WCAG 2.1
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

// Contrast ratio
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Grade the ratio
function gradeContrast(ratio: number): 'AAA' | 'AA' | 'AA-large' | 'FAIL' {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-large'
  return 'FAIL'
}

interface ContrastCheckerProps {
  tokens: DesignToken[]
  drafts: Map<string, string>
}

export default function ContrastChecker({ tokens, drafts }: ContrastCheckerProps) {
  // Get effective value (draft or original)
  const getEffectiveValue = (token: DesignToken) => {
    return drafts.get(token.path) ?? token.value
  }

  // Find background token
  const bgToken = tokens.find((t) => t.cssProperty === '--bg')
  const bgColor = bgToken ? getEffectiveValue(bgToken) : '#ffffff'
  const bgRgb = parseColor(bgColor)

  if (!bgRgb) {
    return (
      <div className="mt-6 p-4 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          Could not parse background color. WCAG checker unavailable.
        </p>
      </div>
    )
  }

  // Find all text and semantic color tokens
  const colorTokens = tokens.filter(
    (t) => t.kind === 'color' && ['text', 'semantic', 'brand'].includes(t.category)
  )

  // Calculate contrast for each
  const results: ContrastResult[] = colorTokens
    .map((token) => {
      const value = getEffectiveValue(token)
      const fgRgb = parseColor(value)
      if (!fgRgb) return null

      const l1 = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b)
      const l2 = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b)
      const ratio = contrastRatio(l1, l2)
      const grade = gradeContrast(ratio)

      return {
        name: token.cssProperty,
        fgColor: value,
        bgColor: bgColor,
        ratio: parseFloat(ratio.toFixed(2)),
        grade,
      }
    })
    .filter((r) => r !== null) as ContrastResult[]

  // Sort by grade (AAA first, then AA, then AA-large, then FAIL)
  const gradeOrder: Record<string, number> = { AAA: 0, AA: 1, 'AA-large': 2, FAIL: 3 }
  results.sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade])

  const getGradeBgColor = (grade: string) => {
    switch (grade) {
      case 'AAA':
        return 'bg-green-900/30'
      case 'AA':
        return 'bg-blue-900/30'
      case 'AA-large':
        return 'bg-amber-900/30'
      case 'FAIL':
        return 'bg-red-900/30'
      default:
        return ''
    }
  }

  const getGradeTextColor = (grade: string) => {
    switch (grade) {
      case 'AAA':
        return 'text-green-400'
      case 'AA':
        return 'text-blue-400'
      case 'AA-large':
        return 'text-amber-400'
      case 'FAIL':
        return 'text-red-400'
      default:
        return ''
    }
  }

  return (
    <div className="mt-6 p-4 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text)] mb-3">
        WCAG Contrast Audit
      </h3>

      {results.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No color tokens to audit.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">
                  Token
                </th>
                <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">
                  Color
                </th>
                <th className="text-right py-2 px-3 font-semibold text-[var(--text-muted)]">
                  Ratio
                </th>
                <th className="text-left py-2 px-3 font-semibold text-[var(--text-muted)]">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.name}
                  className={`border-b border-[var(--border)] ${getGradeBgColor(result.grade)}`}
                >
                  <td className="py-2 px-3">
                    <span className="font-mono text-[var(--text)]">{result.name}</span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border border-[var(--border)]"
                        style={{ backgroundColor: result.fgColor }}
                        title={result.fgColor}
                      />
                      <span className="text-[var(--text-muted)]">{result.fgColor}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="font-mono font-semibold text-[var(--text)]">
                      {result.ratio}:1
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`font-bold uppercase ${getGradeTextColor(result.grade)}`}>
                      {result.grade === 'AAA' && '✓ AAA'}
                      {result.grade === 'AA' && '✓ AA'}
                      {result.grade === 'AA-large' && '⚠ AA-lg'}
                      {result.grade === 'FAIL' && '✗ FAIL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-xs text-[var(--text-muted)] space-y-1">
        <p>
          <span className="font-semibold">Background:</span> {bgColor}
        </p>
        <p>
          <span className="font-semibold">Standards:</span> AAA = 7:1+, AA = 4.5:1+, AA-large = 3:1+
        </p>
      </div>
    </div>
  )
}
