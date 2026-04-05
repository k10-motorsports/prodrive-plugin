'use client'

import { useState, useEffect } from 'react'

/**
 * Live theme set preview — injects CSS overrides + livery background + frosted header.
 * Per-team palettes derived from official brand colors (car_logos DB) and livery analysis.
 *
 * Design rules (see .claude/skills/livery-theme/SKILL.md):
 *   - Dark --bg: always #000000; --bg-panel: team-hue tinted ~7% lightness
 *   - Light --bg: always #ffffff; --bg-panel: team-hue warm tint
 *   - Brand color from DB; borders use brand at low alpha; text warm-shifted
 */

// ── Palette type ──
type Palette = Record<string, string>

// ── Helper: generate dark + light palette from brand color + hue ──
function makePalette(brand: string, brandDark: string, brandDeep: string, hue: number): { dark: Palette; light: Palette } {
  // Parse brand hex to RGB for rgba() usage
  const r = parseInt(brand.slice(1, 3), 16)
  const g = parseInt(brand.slice(3, 5), 16)
  const b = parseInt(brand.slice(5, 7), 16)

  // Darken brand for light mode (reduce brightness ~15%)
  const lr = Math.round(r * 0.85)
  const lg = Math.round(g * 0.85)
  const lb = Math.round(b * 0.85)
  const brandOnLight = `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`

  return {
    dark: {
      '--bg':            '#000000',
      '--bg-surface':    `hsla(${hue}, 14%, 6%, 0.92)`,
      '--bg-panel':      `hsla(${hue}, 18%, 7%, 0.95)`,
      '--bg-elevated':   `hsla(${hue}, 12%, 9%, 0.90)`,
      '--border':        `rgba(${r}, ${g}, ${b}, 0.16)`,
      '--border-subtle': `rgba(${r}, ${g}, ${b}, 0.07)`,
      '--border-accent': `rgba(${r}, ${g}, ${b}, 0.40)`,
      '--k10-red':       brand,
      '--k10-red-mid':   brandDark,
      '--k10-red-dark':  brandDeep,
      '--red':           brand,
      '--text':          `hsl(${hue}, 20%, 93%)`,
      '--text-primary':  `hsla(${hue}, 30%, 96%, 1.0)`,
      '--text-secondary': `hsla(${hue}, 15%, 88%, 0.72)`,
      '--text-dim':       `hsla(${hue}, 12%, 82%, 0.55)`,
      '--text-muted':     `hsla(${hue}, 10%, 78%, 0.42)`,
    },
    light: {
      '--bg':            '#ffffff',
      '--bg-surface':    'rgba(255, 255, 255, 0.95)',
      '--bg-panel':      `hsla(${hue}, 30%, 96%, 0.95)`,
      '--bg-elevated':   'rgba(255, 255, 255, 1.0)',
      '--border':        'rgba(0, 0, 0, 0.10)',
      '--border-subtle': 'rgba(0, 0, 0, 0.05)',
      '--border-accent': `rgba(${r}, ${g}, ${b}, 0.38)`,
      '--k10-red':       brandOnLight,
      '--k10-red-mid':   brandDark,
      '--k10-red-dark':  brandDeep,
      '--red':           brandOnLight,
      '--text':          '#111111',
      '--text-primary':  'hsla(0, 0%, 5%, 1.0)',
      '--text-secondary': 'rgba(0, 0, 0, 0.65)',
      '--text-dim':       'rgba(0, 0, 0, 0.48)',
      '--text-muted':     'rgba(0, 0, 0, 0.36)',
    },
  }
}

// ── Team Palettes ──
// Brand colors from car_logos DB or official F1 sources.
// Hue extracted from livery image analysis.

// McLaren — #FF7A00 papaya, hue 25
const MCLAREN = makePalette('#FF7A00', '#cc6200', '#7a3a00', 25)

// Ferrari — #DC0000 rosso corsa, hue 0
const FERRARI = makePalette('#DC0000', '#a80000', '#600000', 0)

// Red Bull — #1E41FF dark blue, hue 230
const RED_BULL = makePalette('#1E41FF', '#1530cc', '#0a1a80', 230)

// Mercedes — #00B89F teal, hue 170
const MERCEDES = makePalette('#00B89F', '#008f7a', '#005548', 170)

// Aston Martin — #007A4D british racing green, hue 155
const ASTON_MARTIN = makePalette('#007A4D', '#005c3a', '#003822', 155)

// Alpine — #0093CC french blue, hue 200
const ALPINE = makePalette('#0093CC', '#00729e', '#004460', 200)

// Williams — #005AFF blue, hue 220
const WILLIAMS = makePalette('#005AFF', '#0048cc', '#002b80', 220)

// RB (VCARB) — #6692FF soft blue, hue 222
const RB = makePalette('#6692FF', '#4d74cc', '#2e4680', 222)

// Haas — #B6BABD silver, hue 210
const HAAS = makePalette('#B6BABD', '#8e9194', '#5a5c5e', 210)

// Kick Sauber — #52E252 green, hue 130
const KICK_SAUBER = makePalette('#52E252', '#3eb83e', '#256e25', 130)

// Cadillac — #808080 neutral grey + gold accent from livery, hue 45
const CADILLAC = makePalette('#C4A635', '#9e8528', '#5e4f18', 45)

// Audi — #BB0A30 red, hue 350 (black/silver/red livery)
const AUDI = makePalette('#BB0A30', '#900824', '#580516', 350)

// ── Registry ──
const PALETTES: Record<string, { dark: Palette; light: Palette }> = {
  mclaren: MCLAREN,
  ferrari: FERRARI,
  'red-bull': RED_BULL,
  mercedes: MERCEDES,
  'aston-martin': ASTON_MARTIN,
  alpine: ALPINE,
  williams: WILLIAMS,
  rb: RB,
  haas: HAAS,
  'kick-sauber': KICK_SAUBER,
  cadillac: CADILLAC,
  audi: AUDI,
}

const LIVERY_IMAGES: Record<string, string> = {
  mclaren: '/liveries/mclaren.webp',
  ferrari: '/liveries/ferrari.webp',
  'red-bull': '/liveries/red-bull.webp',
  mercedes: '/liveries/mercedes.webp',
  'aston-martin': '/liveries/aston-martin.webp',
  alpine: '/liveries/alpine.webp',
  williams: '/liveries/williams.webp',
  rb: '/liveries/racing-bulls.webp',
  haas: '/liveries/haas.webp',
  'kick-sauber': '/liveries/audi.webp',
  cadillac: '/liveries/cadillac.webp',
  audi: '/liveries/audi.webp',
}

export default function ThemePreview() {
  const [active, setActive] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark')
  const [activeSet, setActiveSet] = useState('default')

  // Watch dark/light toggle
  useEffect(() => {
    const check = () => {
      const t = document.documentElement.getAttribute('data-theme')
      setCurrentTheme(t === 'light' ? 'light' : 'dark')
    }
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true })
    return () => obs.disconnect()
  }, [])

  // Watch set selector
  useEffect(() => {
    const onSetChange = (e: Event) => {
      setActiveSet((e as CustomEvent).detail?.slug || 'default')
    }
    window.addEventListener('theme-set-change', onSetChange)
    const match = document.cookie.match(/racecor-theme-set=([^;]+)/)
    if (match) setActiveSet(match[1])
    return () => window.removeEventListener('theme-set-change', onSetChange)
  }, [])

  // Inject/remove preview styles
  useEffect(() => {
    const id = 'theme-set-preview'
    let el = document.getElementById(id) as HTMLStyleElement | null

    if (!active || activeSet === 'default') {
      if (el) el.remove()
      return
    }

    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }

    const p = PALETTES[activeSet]
    if (!p) {
      if (el) el.remove()
      return
    }

    const palette = currentTheme === 'light' ? p.light : p.dark
    const selector = currentTheme === 'light' ? '[data-theme="light"]' : ':root'
    const brandColor = palette['--k10-red']

    const vars = Object.entries(palette)
      .map(([k, v]) => `  ${k}: ${v} !important;`)
      .join('\n')

    const liveryUrl = LIVERY_IMAGES[activeSet]
    const liveryBg = liveryUrl
      ? currentTheme === 'light'
        ? `body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    background: url('${liveryUrl}') center/cover no-repeat fixed;
    filter: blur(80px) saturate(1.6) brightness(1.1);
    opacity: 0.15;
    pointer-events: none;
  }`
        : `body::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    background: url('${liveryUrl}') center/cover no-repeat fixed;
    filter: blur(80px) saturate(1.4) brightness(0.35);
    opacity: 0.40;
    pointer-events: none;
  }`
      : ''

    // Parse brand for frosted header border
    const brandRgb = brandColor.startsWith('#')
      ? `${parseInt(brandColor.slice(1,3),16)}, ${parseInt(brandColor.slice(3,5),16)}, ${parseInt(brandColor.slice(5,7),16)}`
      : '255, 255, 255'

    const frostedHeader = `
  header {
    position: sticky !important;
    top: 0 !important;
    z-index: 50 !important;
    backdrop-filter: blur(24px) saturate(1.6) !important;
    -webkit-backdrop-filter: blur(24px) saturate(1.6) !important;
    background: ${currentTheme === 'light'
      ? 'rgba(255, 255, 255, 0.82)'
      : 'rgba(0, 0, 0, 0.75)'} !important;
    border-bottom-color: ${currentTheme === 'light'
      ? 'rgba(0, 0, 0, 0.08)'
      : `rgba(${brandRgb}, 0.14)`} !important;
  }
  nav {
    position: sticky !important;
    top: 57px !important;
    z-index: 49 !important;
    backdrop-filter: blur(16px) saturate(1.4) !important;
    -webkit-backdrop-filter: blur(16px) saturate(1.4) !important;
    background: ${currentTheme === 'light'
      ? 'rgba(255, 255, 255, 0.88)'
      : 'rgba(0, 0, 0, 0.82)'} !important;
  }`

    el.textContent = `
${selector} {
${vars}
}
${liveryBg}
${frostedHeader}
`

    return () => {
      if (el) el.remove()
    }
  }, [active, currentTheme, activeSet])

  // Only show the button when a non-default set is selected
  if (activeSet === 'default') return null

  // Use the active set's brand color for button styling
  const brandHex = PALETTES[activeSet]?.dark['--k10-red'] || 'var(--k10-red)'
  const brandR = brandHex.startsWith('#') ? parseInt(brandHex.slice(1,3),16) : 229
  const brandG = brandHex.startsWith('#') ? parseInt(brandHex.slice(3,5),16) : 57
  const brandB = brandHex.startsWith('#') ? parseInt(brandHex.slice(5,7),16) : 53

  return (
    <button
      onClick={() => setActive(!active)}
      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md border transition-all"
      style={{
        borderColor: active ? brandHex : 'var(--border)',
        color: active ? brandHex : 'var(--text-secondary)',
        background: active ? `rgba(${brandR}, ${brandG}, ${brandB}, 0.10)` : 'var(--bg-panel)',
        boxShadow: active ? `0 0 12px rgba(${brandR}, ${brandG}, ${brandB}, 0.15)` : 'none',
      }}
      title={active ? 'Disable theme preview' : 'Preview active theme set'}
    >
      {active ? '■ Preview' : '▶ Preview'}
    </button>
  )
}
