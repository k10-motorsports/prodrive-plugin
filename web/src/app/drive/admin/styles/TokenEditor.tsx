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

type Tab = 'colors' | 'typography' | 'spacing' | 'timing'

// Helper to detect if a value is a valid hex color
function isHexColor(value: string): boolean {
  return /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{8})$/.test(value)
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
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
}) {
  const isHex = isHexColor(effectiveValue)

  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <ColorSwatch value={effectiveValue} />
        <span className="text-xs text-[var(--text-muted)]">{effectiveValue}</span>
      </div>
      {isExpanded && (
        <div className="mt-3 p-3 bg-[var(--bg-panel)] rounded-md border border-[var(--border)]">
          {isHex && (
            <div className="mb-3">
              <HexColorPicker color={effectiveValue} onChange={onUpdate} />
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
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
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
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
}) {
  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <FontPreview value={effectiveValue} />
        <span className="text-xs text-[var(--text-muted)] truncate">{effectiveValue}</span>
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
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
}) {
  const weights = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <WeightPreview value={effectiveValue} />
        <span className="text-xs text-[var(--text-muted)]">{effectiveValue}</span>
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
}: {
  token: DesignToken
  effectiveValue: string
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (value: string) => void
}) {
  return (
    <>
      <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        <TimingPreview value={effectiveValue} />
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

  // Fetch tokens on mount
  useEffect(() => {
    fetchTokens()
  }, [])

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

    styleEl.textContent = `:root {\n${overrides}\n}`

    return () => {
      if (styleEl) styleEl.textContent = ''
    }
  }, [drafts, tokens])

  const fetchTokens = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/tokens')
      if (!res.ok) throw new Error('Failed to fetch tokens')
      const data = await res.json()
      setTokens(data.tokens)
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
      // If value matches original, remove draft
      if (token && token.value === value) {
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
      // 1. Save token values
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

      // 2. Trigger build
      const buildRes = await fetch('/api/admin/tokens/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: 'dark' }),
      })
      if (!buildRes.ok) throw new Error('Build failed')

      const buildData = await buildRes.json()

      setDrafts(new Map())
      setSuccess(
        `Saved ${tokenUpdates.length} token${tokenUpdates.length > 1 ? 's' : ''} and built CSS successfully.`
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

  // Get effective value (draft or original)
  const getEffectiveValue = (token: DesignToken) => {
    return drafts.get(token.path) ?? token.value
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-wide uppercase text-[var(--text)]">
            Token Editor
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Edit design tokens — changes preview live and deploy to both web and overlay.
          </p>
        </div>
        {drafts.size > 0 && (
          <div className="flex items-center gap-3">
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
          </div>
        )}
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

      {/* Live Preview Panel */}
      <PreviewPanel />
    </div>
  )
}
