'use client'

import { useState, useEffect } from 'react'

const THEME_COOKIE = 'racecor-theme'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>('dark')

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark'
    setTheme(current)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`
  }

  return (
    <button
      onClick={toggleTheme}
      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md border transition-colors"
      style={{
        borderColor: 'var(--border)',
        color: 'var(--text-secondary)',
        background: 'var(--bg-panel)',
      }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? '☀ Light' : '● Dark'}
    </button>
  )
}
