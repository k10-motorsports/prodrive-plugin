'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * ThemeSetEffects — injects CSS variable overrides for the active theme set.
 * Reads overrides from the DB via API (not hardcoded palettes), so edits
 * in the token editor are reflected immediately after save.
 *
 * Listens for:
 *   - `theme-set-change` (from ThemeSetSelector) — switches active set
 *   - `theme-overrides-updated` (from TokenEditor) — refetches after save
 */

interface Override {
  themeId: string
  tokenPath: string
  value: string
}

interface DesignToken {
  path: string
  cssProperty: string
}

export default function ThemeSetEffects() {
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark')
  const [activeSet, setActiveSet] = useState('default')
  const [overrides, setOverrides] = useState<Override[]>([])
  const [tokenMap, setTokenMap] = useState<Map<string, string>>(new Map()) // path → cssProperty

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

  // Fetch overrides from DB
  const fetchOverrides = useCallback(async (slug: string) => {
    if (slug === 'default') {
      setOverrides([])
      setTokenMap(new Map())
      return
    }
    try {
      const res = await fetch(`/api/admin/tokens?set=${slug}`)
      if (!res.ok) return
      const data = await res.json()

      // Build path → cssProperty map from tokens
      const map = new Map<string, string>()
      if (data.tokens) {
        data.tokens.forEach((t: DesignToken) => map.set(t.path, t.cssProperty))
      }
      setTokenMap(map)
      setOverrides(data.overrides || [])
    } catch {
      // Silently fail — the page still works without overrides
    }
  }, [])

  // Fetch when set changes
  useEffect(() => {
    fetchOverrides(activeSet)
  }, [activeSet, fetchOverrides])

  // Refetch when TokenEditor saves
  useEffect(() => {
    const onUpdated = () => {
      fetchOverrides(activeSet)
    }
    window.addEventListener('theme-overrides-updated', onUpdated)
    return () => window.removeEventListener('theme-overrides-updated', onUpdated)
  }, [activeSet, fetchOverrides])

  // Inject CSS overrides
  useEffect(() => {
    const id = 'theme-set-effects'
    let el = document.getElementById(id) as HTMLStyleElement | null

    if (activeSet === 'default' || overrides.length === 0) {
      if (el) el.remove()
      return
    }

    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }

    // Filter overrides for the current theme (dark or light)
    // For dark: use dark overrides
    // For light: merge dark overrides (as base) + light overrides on top
    const darkOverrides = new Map<string, string>()
    const lightOverrides = new Map<string, string>()
    overrides.forEach((o) => {
      if (o.themeId === 'dark') darkOverrides.set(o.tokenPath, o.value)
      if (o.themeId === 'light') lightOverrides.set(o.tokenPath, o.value)
    })

    const activeOverrides = currentTheme === 'light' ? lightOverrides : darkOverrides
    const selector = currentTheme === 'light' ? '[data-theme="light"]' : ':root'

    const vars = Array.from(activeOverrides.entries())
      .map(([path, value]) => {
        const cssProperty = tokenMap.get(path)
        if (!cssProperty) return ''
        return `  ${cssProperty}: ${value} !important;`
      })
      .filter(Boolean)
      .join('\n')

    if (!vars) {
      if (el) el.remove()
      return
    }

    el.textContent = `${selector} {\n${vars}\n}`

    return () => {
      if (el) el.remove()
    }
  }, [currentTheme, activeSet, overrides, tokenMap])

  return null
}
