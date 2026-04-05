'use client'

import { useState, useEffect } from 'react'

/**
 * ThemeSetEffects — loads built CSS for the active theme set via a <link>
 * pointed at /api/tokens/css/web?set=<slug>.  That endpoint builds CSS
 * directly from the DB on every request, so changes are always fresh.
 *
 * After a rebuild (theme-css-rebuilt event), we cache-bust the <link> href
 * so the browser re-fetches immediately.
 */

export default function ThemeSetEffects() {
  const [activeSet, setActiveSet] = useState('default')
  const [bustKey, setBustKey] = useState(Date.now())

  // Read cookie + watch for set changes
  useEffect(() => {
    const onSetChange = (e: Event) => {
      const slug = (e as CustomEvent).detail?.slug || 'default'
      setActiveSet(slug)
      setBustKey(Date.now())
    }
    window.addEventListener('theme-set-change', onSetChange)
    const match = document.cookie.match(/racecor-theme-set=([^;]+)/)
    if (match) setActiveSet(match[1])
    return () => window.removeEventListener('theme-set-change', onSetChange)
  }, [])

  // Cache-bust after rebuild
  useEffect(() => {
    const onRebuilt = () => setBustKey(Date.now())
    window.addEventListener('theme-css-rebuilt', onRebuilt)
    return () => window.removeEventListener('theme-css-rebuilt', onRebuilt)
  }, [])

  // Manage the <link> tag
  useEffect(() => {
    const id = 'theme-set-css'
    let link = document.getElementById(id) as HTMLLinkElement | null

    if (!link) {
      link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }

    link.href = `/api/tokens/css/web?set=${activeSet}&t=${bustKey}`
  }, [activeSet, bustKey])

  return null
}
