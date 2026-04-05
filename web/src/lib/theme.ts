import { cookies } from 'next/headers'

export const THEME_COOKIE = 'racecor-theme'
export const DEFAULT_THEME = 'dark'

/**
 * Read theme preference from cookie (server-side).
 */
export async function getThemeFromCookie(): Promise<string> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(THEME_COOKIE)?.value || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}
