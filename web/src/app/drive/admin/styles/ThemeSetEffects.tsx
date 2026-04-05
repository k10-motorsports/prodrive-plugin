'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * ThemeSetEffects — loads the built CSS for the active theme set via a
 * dynamic <link> tag.  After a rebuild the TokenEditor dispatches
 * `theme-css-rebuilt` with the new blob URL and we swap the link immediately.
 *
 * This replaces the old approach of injecting inline CSS overrides.
 * The single <link> carries every token for the set (dark + light).
 */

export default function ThemeSetEffects() {
  const [activeSet, setActiveSet] = useState('default')
  const [cssUrl, setCssUrl] = useState<string | null>(null)

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

  // Fetch the current built CSS URL for this set
  const fetchCssUrl = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/admin/tokens/css-url?set=${slug}`)
      if (!res.ok) { setCssUrl(null); return }
      const data = await res.json()
      setCssUrl(data.url || null)
    } catch {
      setCssUrl(null)
    }
  }, [])

  // Fetch on set change
  useEffect(() => {
    fetchCssUrl(activeSet)
  }, [activeSet, fetchCssUrl])

  // Listen for rebuilds — TokenEditor sends the new URL directly
  useEffect(() => {
    const onRebuilt = (e: Event) => {
      const detail = (e as CustomEvent).detail
      // Only apply if the rebuilt set matches our active set
      if (detail?.setSlug === activeSet && detail?.cssUrl) {
        setCssUrl(detail.cssUrl)
      } else if (detail?.setSlug === activeSet) {
        // Refetch if no URL provided
        fetchCssUrl(activeSet)
      }
    }
    window.addEventListener('theme-css-rebuilt', onRebuilt)
    return () => window.removeEventListener('theme-css-rebuilt', onRebuilt)
  }, [activeSet, fetchCssUrl])

  // Inject/update <link> tag
  useEffect(() => {
    const id = 'theme-set-css'
    let link = document.getElementById(id) as HTMLLinkElement | null

    if (!cssUrl) {
      if (link) link.remove()
      return
    }

    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    // Cache-bust to force reload after rebuild
    link.href = cssUrl.includes('?') ? cssUrl + '&t=' + Date.now() : cssUrl + '?t=' + Date.now()
  }, [cssUrl])

  return null
}
