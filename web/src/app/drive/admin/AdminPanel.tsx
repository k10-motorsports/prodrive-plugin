'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ──

interface Track {
  id: string
  trackId: string
  trackName: string
  displayName: string | null
  svgPath: string
  pointCount: number
  gameName: string | null
  trackLengthKm: number | null
  createdAt: string
  updatedAt: string
}

interface MissingTrack {
  trackId: string
  name: string
  games: string[]
}

interface LogoEntry {
  id: string
  brandKey: string
  brandName: string
  brandColorHex: string | null
  hasSvg: boolean
  hasPng: boolean
  createdAt: string
  updatedAt: string
}

interface MissingBrand {
  brandKey: string
  brandName: string
  country: string
  defaultColor: string
  games: string[]
}

interface User {
  id: string
  discordId: string
  discordUsername: string
  discordDisplayName: string | null
  discordAvatar: string | null
  email: string | null
  createdAt: string
  updatedAt: string
  activeTokens: number
}

interface ConnectionLog {
  id: string
  timestamp: string
  operation: string
  status: 'success' | 'failure'
  duration: number
  errorDetails: string | null
}

interface LogsResponse {
  success: boolean
  logs: ConnectionLog[]
  stats: { total: number; successful: number; failed: number; avgDuration: number }
}

// ── Shared Components ──

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors cursor-pointer border-b-2 -mb-[1px] ${
        active
          ? 'text-[var(--k10-red)] border-[var(--k10-red)]'
          : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-dim)]'
      }`}
    >
      {children}
    </button>
  )
}

function SearchFilterBar({ search, onSearch, game, onGame, sort, onSort, sortOptions }: {
  search: string; onSearch: (v: string) => void
  game: string; onGame: (v: string) => void
  sort: string; onSort: (v: string) => void
  sortOptions?: { value: string; label: string }[]
}) {
  const sorts = sortOptions || [
    { value: 'name-asc', label: 'A → Z' },
    { value: 'name-desc', label: 'Z → A' },
    { value: 'recent', label: 'Recently Added' },
  ]
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <input
        type="text"
        placeholder="Search by name..."
        value={search}
        onChange={e => onSearch(e.target.value)}
        className="flex-1 min-w-[200px] bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]"
      />
      <select
        value={game}
        onChange={e => onGame(e.target.value)}
        className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--k10-red)]"
      >
        <option value="">All Games</option>
        <option value="iracing">iRacing</option>
        <option value="lmu">Le Mans Ultimate</option>
        <option value="acc">ACC</option>
      </select>
      <select
        value={sort}
        onChange={e => onSort(e.target.value)}
        className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--k10-red)]"
      >
        {sorts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  )
}

function GameBadge({ game }: { game: string }) {
  const colors: Record<string, string> = {
    iracing: 'bg-blue-500/20 text-blue-400',
    lmu: 'bg-amber-500/20 text-amber-400',
    acc: 'bg-green-500/20 text-green-400',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${colors[game] || 'bg-gray-500/20 text-gray-400'}`}>
      {game}
    </span>
  )
}

// ── Main Component ──

export default function AdminPanel() {
  const [tab, setTab] = useState<'tracks' | 'logos' | 'users' | 'logs'>('tracks')

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-1 mb-8 border-b border-[var(--border)]">
        <TabButton active={tab === 'tracks'} onClick={() => setTab('tracks')}>Track Maps</TabButton>
        <TabButton active={tab === 'logos'} onClick={() => setTab('logos')}>Car Logos</TabButton>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
        <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>Logs</TabButton>
      </div>
      {tab === 'tracks' && <TracksSection />}
      {tab === 'logos' && <LogosSection />}
      {tab === 'users' && <UsersSection />}
      {tab === 'logs' && <LogsSection />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CAR LOGOS SECTION
// ═══════════════════════════════════════════════════════════════

function LogosSection() {
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

  const deleteLogo = async (brandKey: string) => {
    if (!confirm(`Delete "${brandKey}" logo? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/logos?brandKey=${encodeURIComponent(brandKey)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      fetchLogos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div>
      <LogoUploadForm onUploaded={fetchLogos} />

      <div className="mt-8">
        <SearchFilterBar search={search} onSearch={setSearch} game={game} onGame={setGame} sort={sort} onSort={setSort} />
      </div>

      <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">
        Uploaded Logos ({logos.length})
      </h2>

      {loading && <p className="text-[var(--text-muted)] text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {logos.map(logo => (
          <LogoCard key={logo.id} logo={logo} onDelete={deleteLogo} onUpdate={fetchLogos} />
        ))}
      </div>

      {!loading && logos.length === 0 && (
        <p className="text-[var(--text-muted)] text-sm text-center py-6">No logos uploaded yet.</p>
      )}

      {/* Missing logos */}
      {missing.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">
            Missing Logos ({missing.length})
          </h2>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Brand</th>
                  <th className="text-left px-4 py-3">Key</th>
                  <th className="text-left px-4 py-3">Color</th>
                  <th className="text-left px-4 py-3">Games</th>
                </tr>
              </thead>
              <tbody>
                {missing.map(b => (
                  <tr key={b.brandKey} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text)] font-medium">{b.brandName}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)] font-mono text-xs">{b.brandKey}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-sm border border-white/20" style={{ background: b.defaultColor }} />
                        <span className="text-xs text-[var(--text-muted)] font-mono">{b.defaultColor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {b.games.map(g => <GameBadge key={g} game={g} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function LogoCard({ logo, onDelete, onUpdate }: { logo: LogoEntry; onDelete: (k: string) => void; onUpdate: () => void }) {
  const [editingColor, setEditingColor] = useState(false)
  const [color, setColor] = useState(logo.brandColorHex || '')
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
      setEditingColor(false)
      onUpdate()
    } catch {
      alert('Failed to save color')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-surface)] hover:border-[var(--border-accent)] transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--text)] truncate">{logo.brandName}</h3>
          <p className="text-[10px] text-[var(--text-muted)] font-mono">{logo.brandKey}</p>
        </div>
        <button
          onClick={() => onDelete(logo.brandKey)}
          className="text-[10px] text-red-400 hover:text-red-300 transition-colors cursor-pointer shrink-0 ml-2"
        >
          Delete
        </button>
      </div>

      {/* Logo preview with brand color bg */}
      <div
        className="rounded border border-[var(--border-subtle)] p-3 mb-2 flex items-center justify-center h-16"
        style={{ background: logo.brandColorHex || 'var(--bg-panel)' }}
      >
        <span className="text-white text-xs font-bold uppercase tracking-wider opacity-60">
          {logo.hasSvg ? 'SVG' : ''}{logo.hasSvg && logo.hasPng ? ' + ' : ''}{logo.hasPng ? 'PNG' : ''}
        </span>
      </div>

      {/* Color editor */}
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-sm border border-white/20 shrink-0 cursor-pointer"
          style={{ background: color || '#333' }}
          onClick={() => setEditingColor(!editingColor)}
        />
        {editingColor ? (
          <div className="flex gap-1 flex-1">
            <input
              type="color"
              value={color || '#333333'}
              onChange={e => setColor(e.target.value.toUpperCase())}
              className="w-6 h-6 p-0 border-0 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#FF0000"
              className="flex-1 min-w-0 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 text-[10px] text-[var(--text)] font-mono"
            />
            <button
              onClick={saveColor}
              disabled={saving}
              className="px-1.5 py-0.5 text-[10px] bg-[var(--k10-red)] text-white rounded cursor-pointer disabled:opacity-50"
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)] font-mono cursor-pointer" onClick={() => setEditingColor(true)}>
            {color || 'No color set — click to add'}
          </span>
        )}
      </div>

      <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-2">
        <span>{new Date(logo.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

function LogoUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [brandKey, setBrandKey] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandColorHex, setBrandColorHex] = useState('')
  const [logoSvg, setLogoSvg] = useState('')
  const [logoPng, setLogoPng] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleFile = (file: File) => {
    setFileName(file.name)
    const baseName = file.name.replace(/\.(svg|png)$/i, '').replace(/[-_]/g, ' ')
    if (!brandName) setBrandName(baseName.charAt(0).toUpperCase() + baseName.slice(1))
    if (!brandKey) setBrandKey(baseName.toLowerCase().replace(/\s+/g, ''))

    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const reader = new FileReader()
      reader.onload = (ev) => setLogoSvg(ev.target?.result as string || '')
      reader.readAsText(file)
    } else if (file.type === 'image/png' || file.name.endsWith('.png')) {
      if (file.size > 2 * 1024 * 1024) {
        setResult({ ok: false, message: 'PNG must be under 2MB' })
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = (ev.target?.result as string || '').split(',')[1] || ''
        setLogoPng(base64)
      }
      reader.readAsDataURL(file)
    } else {
      setResult({ ok: false, message: 'Only SVG and PNG files are supported' })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const submit = async () => {
    if (!brandKey || !brandName || (!logoSvg && !logoPng)) return
    setUploading(true)
    setResult(null)
    try {
      const body: Record<string, string> = { brandKey, brandName }
      if (logoSvg) body.logoSvg = logoSvg
      if (logoPng) body.logoPng = logoPng
      if (brandColorHex) body.brandColorHex = brandColorHex

      const res = await fetch('/api/admin/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult({ ok: true, message: `${data.status}: ${data.brandKey}` })
      setBrandKey('')
      setBrandName('')
      setBrandColorHex('')
      setLogoSvg('')
      setLogoPng('')
      setFileName('')
      onUploaded()
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--bg-surface)]">
      <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">Upload Car Logo</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="brand key (e.g. ferrari)"
          value={brandKey}
          onChange={e => setBrandKey(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]"
        />
        <input
          type="text"
          placeholder="Brand Name"
          value={brandName}
          onChange={e => setBrandName(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]"
        />
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={brandColorHex || '#333333'}
            onChange={e => setBrandColorHex(e.target.value.toUpperCase())}
            className="w-9 h-9 p-0 border border-[var(--border-subtle)] rounded cursor-pointer"
          />
          <input
            type="text"
            placeholder="#FF0000"
            value={brandColorHex}
            onChange={e => setBrandColorHex(e.target.value)}
            className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]"
          />
          {brandColorHex && (
            <div className="w-9 h-9 rounded border border-white/20 shrink-0" style={{ background: brandColorHex }} />
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center mb-4 hover:border-[var(--k10-red)] transition-colors cursor-pointer"
        onClick={() => document.getElementById('logo-file-input')?.click()}
      >
        <input id="logo-file-input" type="file" accept=".svg,.png,image/svg+xml,image/png" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
        {fileName ? (
          <p className="text-sm text-[var(--text)]">{fileName} <span className="text-[var(--text-muted)]">({logoSvg ? 'SVG' : 'PNG'})</span></p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Drop an SVG or PNG logo here, or click to browse</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={uploading || !brandKey || !brandName || (!logoSvg && !logoPng)}
          className="px-4 py-2 bg-[var(--k10-red)] text-white text-sm font-medium rounded hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload Logo'}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? 'text-[var(--green)]' : 'text-red-400'}`}>
            {result.message}
          </span>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TRACKS SECTION (upgraded with search, filter, sort, missing)
// ═══════════════════════════════════════════════════════════════

function TracksSection() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [missing, setMissing] = useState<MissingTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [game, setGame] = useState('')
  const [sort, setSort] = useState('name-asc')

  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (game) params.set('game', game)
      if (sort) params.set('sort', sort)
      const res = await fetch(`/api/admin/tracks?${params}`)
      if (!res.ok) throw new Error('Failed to fetch tracks')
      const data = await res.json()
      setTracks(data.tracks)
      setMissing(data.missing || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [search, game, sort])

  useEffect(() => { fetchTracks() }, [fetchTracks])

  const deleteTrack = async (trackId: string) => {
    if (!confirm(`Delete "${trackId}"? This cannot be undone.`)) return
    setDeleting(trackId)
    try {
      const res = await fetch(`/api/admin/tracks?trackId=${encodeURIComponent(trackId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      fetchTracks()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <UploadForm onUploaded={fetchTracks} />

      <div className="mt-8">
        <SearchFilterBar search={search} onSearch={setSearch} game={game} onGame={setGame} sort={sort} onSort={setSort} />
      </div>

      <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">
        Track Maps ({tracks.length})
      </h2>

      {loading && <p className="text-[var(--text-muted)] text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map(track => (
          <TrackCard key={track.id} track={track} onDelete={deleteTrack} deleting={deleting} onUpdate={fetchTracks} />
        ))}
      </div>

      {!loading && tracks.length === 0 && (
        <p className="text-[var(--text-muted)] text-sm text-center py-8">No track maps match your filters.</p>
      )}

      {/* Missing tracks */}
      {missing.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">
            Missing Track Maps ({missing.length})
          </h2>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Track</th>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Games</th>
                </tr>
              </thead>
              <tbody>
                {missing.map(t => (
                  <tr key={t.trackId} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text)] font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-[var(--text-dim)] font-mono text-xs">{t.trackId}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {t.games.map(g => <GameBadge key={g} game={g} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Track Card ──

function TrackCard({ track, onDelete, deleting, onUpdate }: {
  track: Track
  onDelete: (trackId: string) => void
  deleting: string | null
  onUpdate: () => void
}) {
  const [displayName, setDisplayName] = useState(track.displayName || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isDirty = displayName !== (track.displayName || '')

  const saveDisplayName = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.trackId, displayName: displayName || null }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      onUpdate()
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert('Failed to save display name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-surface)] hover:border-[var(--border-accent)] transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--text)] truncate">{track.trackName}</h3>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[var(--text-muted)] truncate">{track.trackId}</p>
            {track.gameName && <GameBadge game={track.gameName} />}
          </div>
        </div>
        <button
          onClick={() => onDelete(track.trackId)}
          disabled={deleting === track.trackId}
          className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer shrink-0 ml-2 disabled:opacity-50"
        >
          {deleting === track.trackId ? '...' : 'Delete'}
        </button>
      </div>

      {/* Display name editor */}
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Display Name</label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={track.trackName}
            className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)] min-w-0"
          />
          {isDirty && (
            <button
              onClick={saveDisplayName}
              disabled={saving}
              className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide bg-[var(--k10-red)] text-white rounded hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {saving ? '...' : 'Save'}
            </button>
          )}
          {saved && <span className="text-[10px] text-[var(--green)] self-center shrink-0">Saved</span>}
        </div>
      </div>

      {/* SVG Preview */}
      <div className="bg-[var(--bg-panel)] rounded border border-[var(--border-subtle)] p-2 mb-3 flex items-center justify-center aspect-square">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path
            d={track.svgPath}
            fill="none"
            stroke="var(--k10-red)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{track.pointCount} pts</span>
        <span>{new Date(track.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

// ── Track Upload Form ──

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [trackId, setTrackId] = useState('')
  const [trackName, setTrackName] = useState('')
  const [gameName, setGameName] = useState('iracing')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    if (!trackName) {
      const name = file.name.replace(/\.csv$/i, '').replace(/[-_]/g, ' ')
      setTrackName(name)
      if (!trackId) setTrackId(name.toLowerCase().trim())
    }
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '')
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    setFileName(file.name)
    if (!trackName) {
      const name = file.name.replace(/\.csv$/i, '').replace(/[-_]/g, ' ')
      setTrackName(name)
      if (!trackId) setTrackId(name.toLowerCase().trim())
    }
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '')
    reader.readAsText(file)
  }

  const submit = async () => {
    if (!trackId || !trackName || !csvText) return
    setUploading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, trackName, rawCsv: csvText, gameName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResult({ ok: true, message: `${data.status}: ${data.trackId} (${data.pointCount} points)` })
      setTrackId('')
      setTrackName('')
      setCsvText('')
      setFileName('')
      onUploaded()
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--bg-surface)]">
      <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">Upload Track CSV</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <input type="text" placeholder="track id (e.g. sebring international)" value={trackId} onChange={e => setTrackId(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]" />
        <input type="text" placeholder="Track Name" value={trackName} onChange={e => setTrackName(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]" />
        <select value={gameName} onChange={e => setGameName(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--k10-red)]">
          <option value="iracing">iRacing</option>
          <option value="lmu">Le Mans Ultimate</option>
          <option value="acc">ACC</option>
        </select>
      </div>

      <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}
        className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center mb-4 hover:border-[var(--k10-red)] transition-colors cursor-pointer"
        onClick={() => document.getElementById('csv-file-input')?.click()}>
        <input id="csv-file-input" type="file" accept=".csv" onChange={handleFile} className="hidden" />
        {fileName ? (
          <p className="text-sm text-[var(--text)]">{fileName} <span className="text-[var(--text-muted)]">({csvText.split('\n').length} lines)</span></p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Drop a CSV file here or click to browse</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={uploading || !trackId || !trackName || !csvText}
          className="px-4 py-2 bg-[var(--k10-red)] text-white text-sm font-medium rounded hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
          {uploading ? 'Uploading...' : 'Upload & Generate SVG'}
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? 'text-[var(--green)]' : 'text-red-400'}`}>{result.message}</span>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// USERS SECTION
// ═══════════════════════════════════════════════════════════════

function UsersSection() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4">
        Registered Users ({users.length})
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Read-only view. To remove users, manage access through Discord moderation.
      </p>

      {loading && <p className="text-[var(--text-muted)] text-sm">Loading...</p>}

      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Discord ID</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-center px-4 py-3">Tokens</th>
              <th className="text-right px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {user.discordAvatar && user.discordId ? (
                      <img src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=32`} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-panel)]" />
                    )}
                    <div>
                      <div className="text-[var(--text)] font-medium">{user.discordDisplayName || user.discordUsername}</div>
                      <div className="text-xs text-[var(--text-muted)]">@{user.discordUsername}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--text-dim)] font-mono text-xs">{user.discordId}</td>
                <td className="px-4 py-3 text-[var(--text-dim)]">{user.email || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${user.activeTokens > 0 ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'bg-[var(--bg-panel)] text-[var(--text-muted)]'}`}>
                    {user.activeTokens}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--text-muted)]">{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && users.length === 0 && (
        <p className="text-[var(--text-muted)] text-sm text-center py-8">No registered users.</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// LOGS SECTION
// ═══════════════════════════════════════════════════════════════

function LogsSection() {
  const [logs, setLogs] = useState<ConnectionLog[]>([])
  const [stats, setStats] = useState<{ total: number; successful: number; failed: number; avgDuration: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/logs')
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data: LogsResponse = await res.json()
      setLogs(data.logs)
      setStats(data.stats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)]">API & Database Logs</h2>
        <button onClick={fetchLogs} className="px-3 py-1.5 text-sm bg-[var(--k10-red)] text-white rounded hover:brightness-110 transition-all cursor-pointer">Refresh</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Success" value={stats.successful} color="green" />
          <StatCard label="Failed" value={stats.failed} color={stats.failed > 0 ? 'red' : 'muted'} />
          <StatCard label="Avg Duration" value={`${stats.avgDuration}ms`} />
        </div>
      )}

      {loading && <p className="text-[var(--text-muted)] text-sm">Loading logs...</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Operation</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Duration (ms)</th>
                <th className="text-left px-4 py-3">Error Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text)] font-mono">{log.operation}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.status === 'success' ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'bg-red-500/20 text-red-400'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">{log.duration}</td>
                  <td className="px-4 py-3 text-xs text-red-400">{log.errorDetails || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && logs.length === 0 && (
        <p className="text-[var(--text-muted)] text-sm text-center py-8">No connection logs yet.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'green' | 'red' | 'muted' }) {
  const colorClass = color === 'green' ? 'text-[var(--green)]' : color === 'red' ? 'text-red-400' : 'text-[var(--text-dim)]'
  return (
    <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-surface)]">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
