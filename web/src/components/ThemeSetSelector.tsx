'use client'

import { useState, useEffect, useRef } from 'react'

interface ThemeSet {
  slug: string
  name: string
}

const SET_COOKIE = 'racecor-theme-set'

export default function ThemeSetSelector() {
  const [sets, setSets] = useState<ThemeSet[]>([])
  const [activeSlug, setActiveSlug] = useState<string>('default')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`${SET_COOKIE}=([^;]+)`))
    if (match) setActiveSlug(match[1])

    fetch('/api/admin/theme-sets')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sets) {
          // Sort: default first, then alphabetical by name
          const sorted = [...data.sets].sort((a: ThemeSet, b: ThemeSet) => {
            if (a.slug === 'default') return -1
            if (b.slug === 'default') return 1
            return a.name.localeCompare(b.name)
          })
          setSets(sorted)
        }
      })
      .catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleSelect = (slug: string) => {
    setActiveSlug(slug)
    setOpen(false)
    document.cookie = `${SET_COOKIE}=${slug};path=/;max-age=31536000;SameSite=Lax`
    document.documentElement.dataset.set = slug   // instant CSS token switch
    window.dispatchEvent(new CustomEvent('theme-set-change', { detail: { slug } }))
    // Reload so the server loads the correct team blob CSS
    window.location.reload()
  }

  if (sets.length === 0) return null

  const activeName = sets.find((s) => s.slug === activeSlug)?.name || 'Default'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md border transition-colors cursor-pointer"
        style={{
          borderColor: open ? 'var(--border-accent)' : 'var(--border)',
          color: activeSlug === 'default' ? 'var(--text-secondary)' : 'var(--k10-red)',
          background: 'var(--bg-panel)',
          minWidth: 120,
        }}
        title="Theme set"
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{activeName}</span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            flexShrink: 0,
          }}
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 180,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            zIndex: 100,
            padding: '4px 0',
          }}
        >
          {sets.map((s) => {
            const isActive = s.slug === activeSlug
            return (
              <button
                key={s.slug}
                onClick={() => handleSelect(s.slug)}
                className="w-full text-left px-3 py-2 text-xs font-medium tracking-wide transition-colors"
                style={{
                  display: 'block',
                  color: isActive ? 'var(--k10-red)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-elevated)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-surface)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {s.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
