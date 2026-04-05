'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { HexColorPicker } from 'react-colorful'
import ContrastChecker from './ContrastChecker'
import PreviewPanel from './PreviewPanel'

// Types matching the API response
interface DesignToken {
  id: string
  path: string
  value: string
  kind: string
  cssProperty: string
  description: string | null
  wcag: string | null
  platforms: string
  category: string
  sortOrder: number
}

interface ThemeOverride {
  id: string
  setSlug?: string
  themeId: string
  tokenPath: string
  value: string
  createdAt: string
  updatedAt: string
}

interface ThemeSet {
  slug: string
  name: string
  description: string | null
  liveryImage: string | null
  sortOrder: number
}

type Tab = 'colors' | 'typography' | 'spacing' | 'timing'
type Theme = 'dark' | 'light'

// Helper to detect if a value is a valid hex color
function isHexColor(value: string): boolean {
  return /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/.test(value)
}

// Convert any CSS color string to a 6-digit hex for the color picker.
// Uses a hidden canvas to let the browser parse the color natively.
let _colorCtx: CanvasRenderingContext2D | null = null
function cssColorToHex(value: string): string | null {
  if (typeof document === 'undefined') return null
  if (!_colorCtx) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    _colorCtx = canvas.getContext('2d')
  }
  if (!_colorCtx) return null
  _colorCtx.clearRect(0, 0, 1, 1)
  _colorCtx.fillStyle = '#000000' // reset
  _colorCtx.fillStyle = value     // let browser parse
  _colorCtx.fillRect(0, 0, 1, 1)
  const [r, g, b] = _colorCtx.getImageData(0, 0, 1, 1).data
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Helper to extract numeric value from size strings like "16px"
function parseSizeValue(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : 0
}

// Helper to format size value back to string with unit
function formatSizeValue(num: number, originalValue: string): string {
  const unit = originalValue.replace(/^\d+(?:\.\d+)?/, '') || 'px'
  return `${num}${unit}`
}

// Preview components (from old StyleDictionary)
function ColorSwatch({ value }: { value: string }) {
  return (
    <div
      className="w-8 h-8 rounded-sm border border-[var(--border)]"
      style={{ backgroundColor: value }}
      title={value}
    />
  )
}

function SizePreview({ value }: { value: string }) {
  const px = parseSizeValue(value)
  const height = Math.max(2, Math.min(px / 2, 32))
  return (
    <div
      className="bg-[var(--k10-red)] rounded-sm"
      style={{ width: '32px', height: `${height}px` }}
      title={value}
    />
  )
}

function RadiusPreview({ value }: { value: string }) {
  const px = parseSizeValue(value)
  return (
    <div
      className="w-8 h-8 bg-[var(--k10-red)]"
      style={{ borderRadius: `${px}px` }}
      title={value}
    />
  )
}

function FontPreview({ value }: { value: string }) {
  return (
    <span
      className="text-xs text-[var(--text)]"
      style={{ fontFamily: value }}
      title={value}
    >
      Aa
    </span>
  )
}

function WeightPreview({ value }: { value: string }) {
  return (
    <span
      className="text-xs text-[var(--text)]"
      style={{ fontWeight: parseInt(value, 10) }}
      title={value}
    >
      Bold
    </span>
  )
}

function TimingPreview({ value }: { value: string }) {
  return (
    <span className="text-xs text-[var(--text-muted)]" title={value}>
      {value}
    </span>
  )
}

// Platform badge
function PlatformBadge({ platforms }: { platforms: string }) {
  const plat = platforms.toLowerCase()
  if (plat === 'web') {
    return (
      <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-blue-600 text-white">
        Web
      </span>
    )
  }
  if (plat === 'overlay') {
    return (
      <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-purple-600 text-white">
        Overlay
      </span>
    )
  }
  if (plat === 'both') {
    return (
      <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-green-600 text-white">
        Both
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-gray-600 text-white">
      {platforms}
    </span>
  )
}

// Editors for different token types
function ColorEditor({
  token,
  effectiveValue,
  isExpanded,
  onToggle,
  onUpdate,
  darkBaseValue,
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
  darkBaseValue?: string
}) {
  // Convert any CSS color to hex so the picker always works
  const isHex = isHexColor(effectiveValue)
  const pickerHex = isHex ? effectiveValue : cssColorToHex(effectiveValue)

  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <ColorSwatch value={effectiveValue} />
        <span className="text-xs text-[var(--text-muted)]">{effectiveValue}</span>
        {darkBaseValue && darkBaseValue !== effectiveValue && (
          <span className="text-xs text-[var(--text-dim)]">(dark base: {darkBaseValue})</span>
        )}
      </div>
      {isExpanded && (
        <div className="mt-3 p-3 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
          {pickerHex && (
            <div className="mb-3">
              <HexColorPicker color={pickerHex} onChange={onUpdate} />
            </div>
          )}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Raw value (hex, rgba, hsla):
            </label>
            <input
              type="text"
              value={effectiveValue}
              onChange={(e) => onUpdate(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded"
            />
          </div>
        </div>
      )}
    </>
  )
}

function SizeEditor({
  token,
  effectiveValue,
  isExpanded,
  onToggle,
  onUpdate,
  darkBaseValue,
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
  darkBaseValue?: string
}) {
  const numValue = parseSizeValue(effectiveValue)
  const maxValue = token.kind === 'radius' ? 24 : token.kind === 'font' ? 96 : 50
  const previewComponent =
    token.kind === 'radius' ? (
      <RadiusPreview value={effectiveValue} />
    ) : (
      <SizePreview value={effectiveValue} />
    )

  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        {previewComponent}
        <span className="text-xs text-[var(--text-muted)]">{effectiveValue}</span>
        {darkBaseValue && darkBaseValue !== effectiveValue && (
          <span className="text-xs text-[var(--text-dim)]">(dark base: {darkBaseValue})</span>
        )}
      </div>
      {isExpanded && (
        <div className="mt-3 p-3 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="number"
              value={numValue}
              onChange={(e) => onUpdate(formatSizeValue(parseFloat(e.target.value), effectiveValue))}
              className="w-16 px-2 py-1 text-sm bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded"
            />
            <input
              type="range"
              min="0"
              max={maxValue}
              value={numValue}
              onChange={(e) => onUpdate(formatSizeValue(parseFloat(e.target.value), effectiveValue))}
              className="flex-1 h-1 bg-[var(--border)] rounded appearance-none cursor-pointer"
            />
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Value: {numValue} (max: {maxValue})
          </div>
        </div>
      )}
    </>
  )
}

function FontEditor({
  token,
  effectiveValue,
  isExpanded,
  onToggle,
  onUpdate,
  darkBaseValue,
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
  darkBaseValue?: string
}) {
  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <FontPreview value={effectiveValue} />
        <span className="text-xs text-[var(--text-muted)] truncate">{effectiveValue}</span>
        {darkBaseValue && darkBaseValue !== effectiveValue && (
          <span className="text-xs text-[var(--text-dim)]">(dark base: {darkBaseValue})</span>
        )}
      </div>
      {isExpanded && (
        <div className="mt-3 p-3 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
          <input
            type="text"
            value={effectiveValue}
            onChange={(e) => onUpdate(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded"
            placeholder="e.g., 'Barlow Condensed', sans-serif"
          />
        </div>
      )}
    </>
  )
}

function WeightEditor({
  token,
  effectiveValue,
  isExpanded,
  onToggle,
  onUpdate,
  darkBaseValue,
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
  darkBaseValue?: string
}) {
  const weights = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <WeightPreview value={effectiveValue} />
        <span className="text-xs text-[var(--text-muted)]">{effectiveValue}</span>
        {darkBaseValue && darkBaseValue !== effectiveValue && (
          <span className="text-xs text-[var(--text-dim)]">(dark base: {darkBaseValue})</span>
        )}
      </div>
      {isExpanded && (
        <div className="mt-3 p-3 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
          <select
            value={effectiveValue}
            onChange={(e) => onUpdate(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded"
          >
            {weights.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  )
}

function TimingEditor({
  token,
  effectiveValue,
  isExpanded,
  onToggle,
  onUpdate,
  darkBaseValue,
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
  darkBaseValue?: string
}) {
  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <TimingPreview value={effectiveValue} />
        {darkBaseValue && darkBaseValue !== effectiveValue && (
          <span className="text-xs text-[var(--text-dim)]">(dark base: {darkBaseValue})</span>
        )}
      </div>
      {isExpanded && (
        <div className="mt-3 p-3 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
          <input
            type="text"
            value={effectiveValue}
            onChange={(e) => onUpdate(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded"
            placeholder="e.g., 180ms ease"
          />
        </div>
      )}
    </>
  )
}

// Main component
export default function TokenEditor() {
  const [tokens, setTokens] = useState<DesignToken[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('colors')
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map())
  const [expandedPicker, setExpandedPicker] = useState<string | null>(null)
  const [editingTheme, setEditingTheme] = useState<Theme>('dark')
  const [lightOverrides, setLightOverrides] = useState<Map<string, string>>(new Map())
  const [darkOverrides, setDarkOverrides] = useState<Map<string, string>>(new Map())
  const [themeSets, setThemeSets] = useState<ThemeSet[]>([])
  const [activeSetSlug, setActiveSetSlug] = useState<string>('default')

  // Detect and watch for theme changes
  useEffect(() => {
    const updateTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme') as Theme | null
      setEditingTheme(theme || 'dark')
    }

    updateTheme()

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateTheme()
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })

    return () => {
      observer.disconnect()
    }
  }, [])

  // Listen for theme-set-change from the header selector
  useEffect(() => {
    const onSetChange = (e: Event) => {
      const slug = (e as CustomEvent).detail?.slug
      if (slug && slug !== activeSetSlug) setActiveSetSlug(slug)
    }
    window.addEventListener('theme-set-change', onSetChange)
    // Also read cookie on mount
    const match = document.cookie.match(/racecor-theme-set=([^;]+)/)
    if (match && match[1] !== activeSetSlug) setActiveSetSlug(match[1])

    return () => window.removeEventListener('theme-set-change', onSetChange)
  }, [activeSetSlug])

  // Fetch tokens on mount and when set changes
  useEffect(() => {
    fetchTokens()
  }, [activeSetSlug])

  // Clear drafts when theme or set changes
  useEffect(() => {
    setDrafts(new Map())
    setExpandedPicker(null)
  }, [editingTheme, activeSetSlug])

  // Inject live preview styles
  useEffect(() => {
    let styleEl = document.getElementById('token-preview-styles') as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'token-preview-styles'
      document.head.appendChild(styleEl)
    }

    if (drafts.size === 0) {
      styleEl.textContent = ''
      return
    }

    const overrides = Array.from(drafts.entries())
      .map(([path, value]) => {
        const token = tokens.find((t) => t.path === path)
        if (!token) return ''
        return `  ${token.cssProperty}: ${value};`
      })
      .filter(Boolean)
      .join('\n')

    // Inject as :root for dark theme or [data-theme="light"] for light theme
    const selector = editingTheme === 'dark' ? ':root' : '[data-theme="light"]'
    styleEl.textContent = `${selector} {\n${overrides}\n}`

    return () => {
      if (styleEl) styleEl.textContent = ''
    }
  }, [drafts, tokens, editingTheme])

  const fetchTokens = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/tokens?set=${activeSetSlug}`)
      if (!res.ok) throw new Error('Failed to fetch tokens')
      const data = await res.json()
      setTokens(data.tokens)

      // Parse overrides by theme
      const lightMap = new Map<string, string>()
      const darkMap = new Map<string, string>()
      if (data.overrides && Array.isArray(data.overrides)) {
        data.overrides.forEach((o: ThemeOverride) => {
          if (o.themeId === 'light') lightMap.set(o.tokenPath, o.value)
          if (o.themeId === 'dark') darkMap.set(o.tokenPath, o.value)
        })
      }
      setLightOverrides(lightMap)
      setDarkOverrides(darkMap)

      // Update available theme sets
      if (data.themeSets && Array.isArray(data.themeSets)) {
        setThemeSets(data.themeSets)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const updateDraft = (path: string, value: string) => {
    setDrafts((prev) => {
      const next = new Map(prev)
      const token = tokens.find((t) => t.path === path)
      if (!token) return next

      // Determine the base value to compare against
      let baseValue: string
      if (editingTheme === 'light') {
        baseValue = lightOverrides.get(path) ?? getResolvedDarkValue(token)
      } else {
        baseValue = getResolvedDarkValue(token)
      }

      // If value matches base, remove draft
      if (baseValue === value) {
        next.delete(path)
      } else {
        next.set(path, value)
      }
      return next
    })
  }

  const resetDraft = (path: string) => {
    setDrafts((prev) => {
      const next = new Map(prev)
      next.delete(path)
      return next
    })
  }

  const handleSave = async () => {
    if (drafts.size === 0) return
    setSaving(true)
    setError(null)

    try {
      if (editingTheme === 'dark' && activeSetSlug === 'default') {
        // Default set dark changes → update base design_tokens table directly
        const tokenUpdates = Array.from(drafts.entries()).map(([path, value]) => ({
          path,
          value,
        }))

        const saveRes = await fetch('/api/admin/tokens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: tokenUpdates }),
        })
        if (!saveRes.ok) throw new Error('Failed to save tokens')

        // Update local state
        setTokens((prev) =>
          prev.map((t) => (drafts.has(t.path) ? { ...t, value: drafts.get(t.path)! } : t))
        )
      } else {
        // Non-default set dark, or any set light → save as theme overrides
        const overrideUpdates = Array.from(drafts.entries()).map(([tokenPath, value]) => ({
          tokenPath,
          value,
        }))

        const saveRes = await fetch('/api/admin/themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setSlug: activeSetSlug,
            themeId: editingTheme,
            overrides: overrideUpdates,
          }),
        })
        if (!saveRes.ok) throw new Error('Failed to save theme overrides')

        // Update local overrides
        const setter = editingTheme === 'light' ? setLightOverrides : setDarkOverrides
        setter((prev) => {
          const next = new Map(prev)
          Array.from(drafts.entries()).forEach(([path, value]) => {
            next.set(path, value)
          })
          return next
        })
      }

      // Trigger build for this set
      await handleRebuild()

      setDrafts(new Map())
      const setLabel = themeSets.find((s) => s.slug === activeSetSlug)?.name || activeSetSlug
      setSuccess(
        `Saved ${drafts.size} override${drafts.size > 1 ? 's' : ''} to ${setLabel} / ${editingTheme} and built CSS.`
      )
      setTimeout(() => setSuccess(null), 4000)

      // Refetch tokens to get updated values
      await fetchTokens()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleRebuild = async () => {
    setSaving(true)
    setError(null)

    try {
      const buildRes = await fetch('/api/admin/tokens/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setSlug: activeSetSlug }),
      })
      if (!buildRes.ok) throw new Error('Build failed')

      const buildData = await buildRes.json()
      setSuccess(`CSS rebuilt for "${buildData.setSlug}". ${buildData.builds?.length || 0} platform(s) updated.`)
      setTimeout(() => setSuccess(null), 4000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // Resolved dark value for this set = base token + set dark overrides
  const getResolvedDarkValue = useCallback((token: DesignToken) => {
    return darkOverrides.get(token.path) ?? token.value
  }, [darkOverrides])

  // Get effective value (draft or override or original)
  const getEffectiveValue = (token: DesignToken) => {
    if (drafts.has(token.path)) {
      return drafts.get(token.path)!
    }

    if (editingTheme === 'light') {
      return lightOverrides.get(token.path) ?? getResolvedDarkValue(token)
    }

    // Dark theme: use set's dark override, or base token
    return getResolvedDarkValue(token)
  }

  // Get dark base value for reference when editing light theme
  const getDarkBaseValue = (token: DesignToken) => {
    if (editingTheme === 'light') return getResolvedDarkValue(token)
    // When editing dark for a non-default set, show the global base for reference
    if (activeSetSlug !== 'default') return token.value
    return undefined
  }

  // Filter tokens by tab
  const filteredTokens = useMemo(() => {
    const categoryMap: Record<Tab, string[]> = {
      colors: ['background', 'text', 'border', 'brand', 'semantic', 'flag'],
      typography: ['typography'],
      spacing: ['spacing'],
      timing: ['timing'],
    }

    let filtered = tokens.filter((t) => categoryMap[activeTab].includes(t.category))

    // For spacing tab, also include radius tokens
    if (activeTab === 'spacing') {
      filtered = tokens.filter(
        (t) => categoryMap[activeTab].includes(t.category) || t.kind === 'radius'
      )
    }

    return filtered.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [tokens, activeTab])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[var(--text-muted)]">Loading tokens...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header — spans full width above both columns */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide uppercase text-[var(--text)]">
            Token Editor
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Edit design tokens — changes preview live and deploy to both web and overlay.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {drafts.size > 0 && (
            <>
              <span className="text-sm text-[var(--amber)]">
                {drafts.size} unsaved change{drafts.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[var(--green)] text-white text-sm font-bold uppercase tracking-wider rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Building...' : 'Save & Build'}
              </button>
            </>
          )}
          <button
            onClick={handleRebuild}
            disabled={saving}
            className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] text-sm font-bold uppercase tracking-wider rounded-md hover:border-[var(--border-accent)] transition-colors disabled:opacity-50"
          >
            {saving ? 'Building...' : 'Rebuild CSS'}
          </button>
        </div>
      </div>

      {/* Theme Indicator — full width */}
      <div className="mb-6 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-panel)] flex items-center gap-3">
        <p className="text-sm font-semibold text-[var(--text)]">
          {themeSets.find((s) => s.slug === activeSetSlug)?.name || activeSetSlug}
          {' / '}
          {editingTheme === 'dark' ? 'Dark' : 'Light'}
          {activeSetSlug !== 'default' && editingTheme === 'dark' && (
            <span className="text-xs text-[var(--text-muted)] ml-2 font-normal">
              (dark overrides on top of base tokens)
            </span>
          )}
        </p>
        {editingTheme === 'light' && (
          <p className="text-xs text-[var(--text-muted)]">
            Light values override the resolved dark. Small text shows the dark value for reference.
          </p>
          {editingTheme === 'light' && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Light values override the resolved dark. Small text shows the dark value for reference.
            </p>
          )}
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900 text-red-100 rounded-md border border-red-700">
          <p className="text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-900 text-green-100 rounded-md border border-green-700">
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Two-column layout: Editor (3fr) | Preview (6fr) */}
      <div className="flex gap-6 items-start">
        {/* Left: Token Editor (1/3 width) */}
        <div
          className="w-4/12 min-w-0 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          {/* Tabs */}
          <div className="mb-6 flex gap-2 border-b border-[var(--border)]">
            {(['colors', 'typography', 'spacing', 'timing'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? 'text-[var(--text)] border-b-2 border-[var(--k10-red)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {tab === 'colors' && 'Colors'}
                {tab === 'typography' && 'Typography'}
                {tab === 'spacing' && 'Spacing & Layout'}
                {tab === 'timing' && 'Motion'}
              </button>
            ))}
          </div>

          {/* Tokens Table */}
          {filteredTokens.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-[var(--text-muted)]">No tokens in this category</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTokens.map((token) => (
                <div
                  key={token.id}
                  className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-mono text-[var(--text)] font-semibold">
                          {token.cssProperty}
                        </h3>
                        <PlatformBadge platforms={token.platforms} />
                      </div>
                      {token.description && (
                        <p className="text-xs text-[var(--text-muted)] mb-3">{token.description}</p>
                      )}
                      <div className="mb-3">
                        {token.kind === 'color' && (
                          <ColorEditor
                            token={token}
                            effectiveValue={getEffectiveValue(token)}
                            isExpanded={expandedPicker === token.id}
                            onToggle={() =>
                              setExpandedPicker(expandedPicker === token.id ? null : token.id)
                            }
                            onUpdate={(value) => updateDraft(token.path, value)}
                            darkBaseValue={getDarkBaseValue(token)}
                          />
                        )}
                        {(token.kind === 'size' || token.kind === 'radius') && (
                          <SizeEditor
                            token={token}
                            effectiveValue={getEffectiveValue(token)}
                            isExpanded={expandedPicker === token.id}
                            onToggle={() =>
                              setExpandedPicker(expandedPicker === token.id ? null : token.id)
                            }
                            onUpdate={(value) => updateDraft(token.path, value)}
                            darkBaseValue={getDarkBaseValue(token)}
                          />
                        )}
                        {token.kind === 'font' && (
                          <FontEditor
                            token={token}
                            effectiveValue={getEffectiveValue(token)}
                            isExpanded={expandedPicker === token.id}
                            onToggle={() =>
                              setExpandedPicker(expandedPicker === token.id ? null : token.id)
                            }
                            onUpdate={(value) => updateDraft(token.path, value)}
                            darkBaseValue={getDarkBaseValue(token)}
                          />
                        )}
                        {token.kind === 'weight' && (
                          <WeightEditor
                            token={token}
                            effectiveValue={getEffectiveValue(token)}
                            isExpanded={expandedPicker === token.id}
                            onToggle={() =>
                              setExpandedPicker(expandedPicker === token.id ? null : token.id)
                            }
                            onUpdate={(value) => updateDraft(token.path, value)}
                            darkBaseValue={getDarkBaseValue(token)}
                          />
                        )}
                        {token.kind === 'timing' && (
                          <TimingEditor
                            token={token}
                            effectiveValue={getEffectiveValue(token)}
                            isExpanded={expandedPicker === token.id}
                            onToggle={() =>
                              setExpandedPicker(expandedPicker === token.id ? null : token.id)
                            }
                            onUpdate={(value) => updateDraft(token.path, value)}
                            darkBaseValue={getDarkBaseValue(token)}
                          />
                        )}
                      </div>
                      {token.wcag && (
                        <p className="text-xs text-[var(--text-dim)]">WCAG: {token.wcag}</p>
                      )}
                    </div>
                    {drafts.has(token.path) && (
                      <button
                        onClick={() => resetDraft(token.path)}
                        className="px-3 py-1 text-xs text-[var(--amber)] hover:text-[var(--k10-red)] transition-colors font-semibold uppercase"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* WCAG Contrast (only on colors tab) */}
          {activeTab === 'colors' && <ContrastChecker tokens={tokens} drafts={drafts} />}
        </div>

        {/* Right: Live Preview (2/3 width) */}
        <div
          className="w-8/12 min-w-0 sticky top-6 overflow-y-auto rounded-lg border-2 border-solid border-[var(--border-accent)] bg-[var(--bg-surface)] p-6"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          <PreviewPanel />
        </div>
      </div>
    </div>
  )
}
