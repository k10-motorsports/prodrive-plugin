'use client'

import { useState, useEffect, useCallback } from 'react'
import { LogoEntry, MissingBrand, SearchFilterBar, GameBadge } from '../components'

function LogoCard({ logo, onDelete, onUpdate }: { logo: LogoEntry; onDelete: (k: string) => void; onUpdate: () => void }) {
  const [color, setColor] = useState(logo.brandColorHex || '')
  const [dirtyColor, setDirtyColor] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveColor = async () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color) && color !== '') return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/logos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: logo.brandKey, brandColorHex: color || null }),
      })
      if (!res.ok) throw new Error('Save failed')
      setDirtyColor(false)
      onUpdate()
    } catch {
      alert('Failed to save color')
    } finally {
      setSaving(false)
    }
  }

  const clearLogo = async () => {
    if (!confirm(`Clear logo for "${logo.brandName}"? The brand will remain in the database but without artwork.`)) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/logos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: logo.brandKey, clearLogo: true }),
      })
      if (!res.ok) throw new Error('Clear failed')
      onUpdate()
    } catch {
      alert('Failed to clear logo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-surface)] hover:border-[var(--border-accent)] transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-[var(--text)] truncate">{logo.brandName}</h3>
          <p className="text-[14px] text-[var(--text-muted)] font-mono">{logo.brandKey}</p>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          {logo.games?.map(g => <GameBadge key={g} game={g} />)}
        </div>
      </div>

      {/* Logo preview with brand color bg */}
      <div
        className="rounded border border-[var(--border-subtle)] p-4 mb-2 flex items-center justify-center h-32"
        style={{ background: logo.brandColorHex ? `${logo.brandColorHex}8C` : 'var(--bg-panel)' }}
      >
        {logo.logoSvg ? (
          <div
            className="h-full w-full flex items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-20 [&_svg]:w-auto"
            dangerouslySetInnerHTML={{ __html: logo.logoSvg }}
          />
        ) : (
          <span className="text-white text-xs font-bold uppercase tracking-wider opacity-60">
            {logo.hasPng ? 'PNG' : 'No logo'}
          </span>
        )}
      </div>

      {/* Color editor — always visible */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="color"
          value={color || '#333333'}
          onChange={e => {
            setColor(e.target.value.toUpperCase())
            setDirtyColor(true)
          }}
          className="w-8 h-8 p-0 border border-white/20 rounded cursor-pointer bg-transparent shrink-0"
        />
        <input
          type="text"
          value={color}
          onChange={e => {
            setColor(e.target.value)
            setDirtyColor(true)
          }}
          placeholder="#FF0000"
          className="flex-1 min-w-0 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text)] font-mono"
        />
        {dirtyColor && (
          <button
            onClick={saveColor}
            disabled={saving}
            className="px-2 py-1 text-xs bg-[var(--k10-red)] text-white rounded cursor-pointer disabled:opacity-50 shrink-0"
          >
            {saving ? '...' : 'Save'}
          </button>
        )}
      </div>

      {/* Clear logo button */}
      <button
        onClick={clearLogo}
        disabled={saving}
        className="w-full text-[14px] text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50 mb-2"
      >
        {saving ? '...' : 'Clear Logo'}
      </button>

      <div className="flex justify-between text-[14px] text-[var(--text-muted)]">
        <span>{new Date(logo.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

function MissingLogoRow({ brand, onUploaded }: { brand: MissingBrand; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputId = `logo-upload-${brand.brandKey}`

  const handleFile = async (file: File) => {
    let logoSvg = ''
    let logoPng = ''

    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      logoSvg = await file.text()
    } else if (file.type === 'image/png' || file.name.endsWith('.png')) {
      if (file.size > 2 * 1024 * 1024) {
        setResult({ ok: false, message: 'PNG must be under 2MB' })
        return
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string || '')
        reader.readAsDataURL(file)
      })
      logoPng = dataUrl.split(',')[1] || ''
    } else {
      setResult({ ok: false, message: 'SVG or PNG only' })
      return
    }

    setUploading(true)
    setResult(null)
    try {
      const body: Record<string, string> = {
        brandKey: brand.brandKey,
        brandName: brand.brandName,
        brandColorHex: brand.defaultColor,
      }
      if (logoSvg) body.logoSvg = logoSvg
      if (logoPng) body.logoPng = logoPng

      const res = await fetch('/api/admin/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult({ ok: true, message: 'Uploaded' })
      onUploaded()
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <tr className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
      <td className="px-3 py-2">
        <div
          className="w-6 h-6 rounded-sm border border-[var(--border)]"
          style={{ background: brand.defaultColor }}
          title={brand.defaultColor}
        />
      </td>
      <td className="px-3 py-2">
        <span className="text-[var(--text)] font-medium text-xs block">{brand.brandName}</span>
        <span className="text-[var(--text-dim)] font-mono text-[10px]">{brand.brandKey}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {brand.games.map(g => <GameBadge key={g} game={g} />)}
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          id={fileInputId}
          type="file"
          accept=".svg,.png,image/svg+xml,image/png"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />
        {result ? (
          <span className={`text-[10px] ${result.ok ? 'text-[var(--green)]' : 'text-red-400'}`}>{result.message}</span>
        ) : (
          <button
            onClick={() => document.getElementById(fileInputId)?.click()}
            disabled={uploading}
            className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide bg-[var(--k10-red)] text-white rounded hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {uploading ? '...' : 'Upload'}
          </button>
        )}
      </td>
    </tr>
  )
}

export default function BrandsSection() {
  const [logos, setLogos] = useState<LogoEntry[]>([])
  const [missing, setMissing] = useState<MissingBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [game, setGame] = useState('')
  const [sort, setSort] = useState('name-asc')

  const fetchLogos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (game) params.set('game', game)
      if (sort) params.set('sort', sort)
      const res = await fetch(`/api/admin/logos?${params}`)
      if (!res.ok) throw new Error('Failed to fetch logos')
      const data = await res.json()
      setLogos(data.logos)
      setMissing(data.missing)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [search, game, sort])

  useEffect(() => { fetchLogos() }, [fetchLogos])

  return (
    <div>
      {/* Header — full width above both columns */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide uppercase text-[var(--text)]">
            Car Brands
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage brand logos and colors for the leaderboard overlay.
          </p>
        </div>
        <span className="text-sm text-[var(--text-dim)]">
          {logos.length} logo{logos.length !== 1 ? 's' : ''}{missing.length > 0 && ` · ${missing.length} missing`}
        </span>
      </div>

      {loading && <p className="text-[var(--text-muted)] text-sm mb-4">Loading...</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Two-column layout: Missing/upload (narrow left) | Uploaded logos (wide right) */}
      <div className="flex gap-6 items-start">
        {/* Left: Missing logos with upload buttons (1/3 width) */}
        <div className="w-4/12 min-w-0 sticky top-6">
          {missing.length > 0 ? (
            <>
              <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-3">
                Missing Logos ({missing.length})
              </h2>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                      <th className="text-left px-3 py-2 w-8"></th>
                      <th className="text-left px-3 py-2">Brand</th>
                      <th className="text-left px-3 py-2">Games</th>
                      <th className="text-left px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map(b => (
                      <MissingLogoRow key={b.brandKey} brand={b} onUploaded={fetchLogos} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--bg-surface)] text-center">
              <p className="text-sm text-[var(--green)] font-semibold uppercase tracking-wider">All logos uploaded</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Every known brand has artwork.</p>
            </div>
          )}
        </div>

        {/* Right: Uploaded logos grid (2/3 width) */}
        <div className="w-8/12 min-w-0">
          <SearchFilterBar search={search} onSearch={setSearch} game={game} onGame={setGame} sort={sort} onSort={setSort} />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {logos.map(logo => (
              <LogoCard key={logo.id} logo={logo} onDelete={() => {}} onUpdate={fetchLogos} />
            ))}
          </div>

          {!loading && logos.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm text-center py-8">No logos uploaded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
