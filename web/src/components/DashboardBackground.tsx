'use client'

import { useEffect, useState, useCallback } from 'react'

const SET_COOKIE = 'racecor-theme-set'

interface BackgroundData {
  url: string
  photographer: string
  photographerUrl: string
}

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : ''
}

function getTheme(): string {
  return document.documentElement.getAttribute('data-theme') || 'dark'
}

export default function DashboardBackground() {
  const [bg, setBg] = useState<BackgroundData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [theme, setTheme] = useState<string>('dark')

  const fetchBackground = useCallback((brandOverride?: string, themeOverride?: string) => {
    const currentTheme = themeOverride || getTheme()
    setTheme(currentTheme)
    const brand = brandOverride || readCookie(SET_COOKIE) || ''

    if (!brand || brand === 'default') {
      setBg(null)
      setLoaded(false)
      return
    }

    const params = new URLSearchParams({ theme: currentTheme, brand })

    fetch(`/api/unsplash/background?${params}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.url) {
          setBg(data)
          setLoaded(false)
          const img = new Image()
          img.onload = () => setLoaded(true)
          img.src = data.url
        }
      })
      .catch(() => {})
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchBackground()
  }, [fetchBackground])

  // Listen for theme set changes (brand switch)
  useEffect(() => {
    const handler = (e: Event) => {
      const slug = (e as CustomEvent).detail?.slug
      fetchBackground(slug)
    }
    window.addEventListener('theme-set-change', handler)
    return () => window.removeEventListener('theme-set-change', handler)
  }, [fetchBackground])

  // Watch for dark/light theme toggle via data-theme attribute on <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = getTheme()
      if (newTheme !== theme) {
        fetchBackground(undefined, newTheme)
      }
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [fetchBackground, theme])

  if (!bg) return null

  const opacity = loaded
    ? (theme === 'light' ? 0.15 : 0.25)
    : 0

  return (
    <>
      {/* Blurred background image */}
      <div
        style={{
          position: 'fixed',
          inset: '-20px',
          backgroundImage: `url('${bg.url}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(16px)',
          opacity,
          transition: 'opacity 1s ease',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Unsplash attribution */}
      {loaded && (
        <div
          style={{
            position: 'fixed',
            bottom: 8,
            right: 12,
            fontSize: 10,
            color: 'var(--text-muted)',
            opacity: 0.5,
            zIndex: 50,
            pointerEvents: 'auto',
          }}
        >
          Photo by{' '}
          <a
            href={`${bg.photographerUrl}?utm_source=racecor&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline' }}
          >
            {bg.photographer}
          </a>
          {' / '}
          <a
            href="https://unsplash.com?utm_source=racecor&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline' }}
          >
            Unsplash
          </a>
        </div>
      )}
    </>
  )
}
