import { cookies } from 'next/headers'

export const THEME_COOKIE = 'racecor-theme'
export const DEFAULT_THEME = 'dark'

export const THEME_SET_COOKIE = 'racecor-theme-set'
export const DEFAULT_THEME_SET = 'default'

/**
 * Read dark/light preference from cookie (server-side).
 */
export async function getThemeFromCookie(): Promise<string> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(THEME_COOKIE)?.value || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Read the active theme set slug from cookie (server-side).
 * Theme sets (kick-sauber, mclaren, etc.) load team-specific blob CSS.
 */
export async function getThemeSetFromCookie(): Promise<string> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(THEME_SET_COOKIE)?.value || DEFAULT_THEME_SET
  } catch {
    return DEFAULT_THEME_SET
  }
}
