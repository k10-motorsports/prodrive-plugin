// K10 Motorsports / RaceCor.io — Shared constants

// Product brand (plugin + overlay + product site)
export const RACECOR_NAME = 'RaceCor.io'
export const RACECOR_DESCRIPTION = 'Broadcast-grade sim racing HUD with real-time telemetry, race strategy, AI commentary, WebGL visual effects, and HomeKit smart lighting. Built for iRacing.'

// Organization brand (parent company / YouTube channel)
export const K10_NAME = 'K10 Motorsports'
export const K10_DESCRIPTION = 'Sim racing content, tools, and technology from K10 Motorsports.'

// Legacy alias — existing code references SITE_NAME
export const SITE_NAME = RACECOR_NAME
export const SITE_DESCRIPTION = RACECOR_DESCRIPTION

// Domain config — derived from environment so dev/prod URLs are automatic
const isDev = process.env.NODE_ENV === 'development'
const protocol = isDev ? 'http' : 'https'
const port = isDev ? ':3000' : ''

// RaceCor.io domains
const racecorDomain = isDev ? 'dev.racecor.io' : 'racecor.io'
export const SITE_URL = `${protocol}://${racecorDomain}${port}`
export const DRIVE_URL = `${protocol}://prodrive.${racecorDomain}${port}`

// K10 Motorsports domains
const k10Domain = isDev ? 'dev.k10motorsports.racing' : 'k10motorsports.racing'
export const K10_URL = `${protocol}://${k10Domain}${port}`

// iRacing license classes and their rating categories
export const LICENSE_CLASSES = ['R', 'D', 'C', 'B', 'A', 'P'] as const
export type LicenseClass = typeof LICENSE_CLASSES[number]

export const LICENSE_LABELS: Record<LicenseClass, string> = {
  R: 'Rookie', D: 'Class D', C: 'Class C', B: 'Class B', A: 'Class A', P: 'Pro',
}

export const LICENSE_COLORS: Record<LicenseClass, string> = {
  R: '#e53935', D: '#fb8c00', C: '#ffb300', B: '#43a047', A: '#1e88e5', P: '#6c5ce7',
}

// iRacing rating categories (each has its own iRating + SR)
export const RATING_CATEGORIES = ['road', 'oval', 'dirt_road', 'dirt_oval', 'sports_car'] as const
export type RatingCategory = typeof RATING_CATEGORIES[number]

export const CATEGORY_LABELS: Record<RatingCategory, string> = {
  road: 'Road', oval: 'Oval', dirt_road: 'Dirt Road', dirt_oval: 'Dirt Oval', sports_car: 'Sports Car',
}

// Brand palette (matches dashboard CSS variables + logomark colors)
export const COLORS = {
  bg: '#0a0a14',
  surface: 'rgba(16, 16, 32, 0.90)',
  elevated: 'rgba(24, 24, 48, 0.85)',
  border: 'rgba(255, 255, 255, 0.14)',
  text: '#e8e8f0',
  textSecondary: 'rgba(255, 255, 255, 0.69)',
  textDim: 'rgba(255, 255, 255, 0.55)',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  // K10 logomark three-tone reds
  k10Red: '#e53935',
  k10RedMid: '#b02020',
  k10RedDark: '#700010',
  // Semantic
  green: '#43a047',
  blue: '#1e88e5',
  amber: '#ffb300',
  purple: '#7c6cf0',
  cyan: '#00acc1',
} as const
