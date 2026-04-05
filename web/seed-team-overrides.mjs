import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Load .env.local
const envContent = readFileSync('.env.local', 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const sql = neon(process.env.k10_DATABASE_URL)

// CSS property → token path mapping (from seed.ts)
const CSS_TO_PATH = {
  '--bg':             'color.background.base',
  '--bg-surface':     'color.background.surface',
  '--bg-panel':       'color.background.panel',
  '--bg-elevated':    'color.background.elevated',
  '--border':         'color.border.default',
  '--border-subtle':  'color.border.subtle',
  '--border-accent':  'color.border.accent',
  '--k10-red':        'color.brand.red',
  '--k10-red-mid':    'color.brand.red-mid',
  '--k10-red-dark':   'color.brand.red-dark',
  '--red':            'color.brand.red',       // alias — skip to avoid dupe
  '--text':           'color.text.web-primary',
  '--text-primary':   'color.text.primary',
  '--text-secondary': 'color.text.secondary',
  '--text-dim':       'color.text.dim',
  '--text-muted':     'color.text.muted',
}

// Skip --red (alias for --k10-red, same token path)
const SKIP_CSS = ['--red']

function makePalette(brand, brandDark, brandDeep, hue) {
  const r = parseInt(brand.slice(1, 3), 16)
  const g = parseInt(brand.slice(3, 5), 16)
  const b = parseInt(brand.slice(5, 7), 16)
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
      '--text':          '#111111',
      '--text-primary':  'hsla(0, 0%, 5%, 1.0)',
      '--text-secondary': 'rgba(0, 0, 0, 0.65)',
      '--text-dim':       'rgba(0, 0, 0, 0.48)',
      '--text-muted':     'rgba(0, 0, 0, 0.36)',
    },
  }
}

const TEAMS = {
  mclaren:        makePalette('#FF7A00', '#cc6200', '#7a3a00', 25),
  ferrari:        makePalette('#DC0000', '#a80000', '#600000', 0),
  'red-bull':     makePalette('#1E41FF', '#1530cc', '#0a1a80', 230),
  mercedes:       makePalette('#00B89F', '#008f7a', '#005548', 170),
  'aston-martin': makePalette('#007A4D', '#005c3a', '#003822', 155),
  alpine:         makePalette('#0093CC', '#00729e', '#004460', 200),
  williams:       makePalette('#005AFF', '#0048cc', '#002b80', 220),
  rb:             makePalette('#6692FF', '#4d74cc', '#2e4680', 222),
  haas:           makePalette('#B6BABD', '#8e9194', '#5a5c5e', 210),
  'kick-sauber':  makePalette('#52E252', '#3eb83e', '#256e25', 130),
  cadillac:       makePalette('#C4A635', '#9e8528', '#5e4f18', 45),
  audi:           makePalette('#BB0A30', '#900824', '#580516', 350),
}

async function run() {
  let total = 0

  for (const [slug, palettes] of Object.entries(TEAMS)) {
    for (const [themeId, vars] of [['dark', palettes.dark], ['light', palettes.light]]) {
      for (const [cssProp, value] of Object.entries(vars)) {
        if (SKIP_CSS.includes(cssProp)) continue
        const tokenPath = CSS_TO_PATH[cssProp]
        if (!tokenPath) {
          console.warn(`  No token path for ${cssProp}, skipping`)
          continue
        }

        // Upsert
        const existing = await sql`
          SELECT id FROM theme_overrides
          WHERE set_slug = ${slug} AND theme_id = ${themeId} AND token_path = ${tokenPath}
          LIMIT 1
        `

        if (existing.length > 0) {
          await sql`
            UPDATE theme_overrides SET value = ${value}, updated_at = now()
            WHERE id = ${existing[0].id}
          `
        } else {
          await sql`
            INSERT INTO theme_overrides (set_slug, theme_id, token_path, value)
            VALUES (${slug}, ${themeId}, ${tokenPath}, ${value})
          `
        }
        total++
      }
    }
    console.log(`  ✓ ${slug}: dark + light overrides saved`)
  }

  console.log(`\nDone — ${total} overrides upserted across ${Object.keys(TEAMS).length} teams`)
}

run().catch(err => { console.error('FATAL:', err); process.exit(1) })
