import { THEME_COOKIE, DEFAULT_THEME } from '@/lib/theme'

/**
 * Inline script to set data-theme before first paint.
 * Reads from cookie to avoid flash of wrong theme.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var match = document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
        var theme = match ? match[1] : '${DEFAULT_THEME}';
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {}
    })();
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
