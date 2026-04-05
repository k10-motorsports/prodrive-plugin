'use client'

import { useState, useEffect, useCallback } from 'react'
import { Track, MissingTrack, SearchFilterBar, GameBadge } from '../components'

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

function TrackCard({ track, onDelete, deleting, onUpdate }: {
  track: Track
  onDelete: (trackId: string) => void
  deleting: string | null
  onUpdate: () => void
}) {
  const [displayName, setDisplayName] = useState(track.displayName || '')
  const [sectorCount, setSectorCount] = useState(track.sectorCount || 3)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingSectors, setSavingSectors] = useState(false)

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

  const toggleSectors = async () => {
    const newCount = sectorCount === 3 ? 7 : 3
    setSavingSectors(true)
    try {
      const res = await fetch('/api/admin/tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.trackId, sectorCount: newCount }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSectorCount(newCount)
      onUpdate()
    } catch {
      alert('Failed to update sector count')
    } finally {
      setSavingSectors(false)
    }
  }

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-surface)] hover:border-[var(--border-accent)] transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold text-[var(--text)] truncate">{track.trackName}</h3>
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
        <label className="text-[14px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Display Name</label>
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
              className="px-2 py-1.5 text-[14px] font-medium uppercase tracking-wide bg-[var(--k10-red)] text-white rounded hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              {saving ? '...' : 'Save'}
            </button>
          )}
          {saved && <span className="text-[14px] text-[var(--green)] self-center shrink-0">Saved</span>}
        </div>
      </div>

      {/* Expanded sectors toggle */}
      <div className="mb-3">
        <label className="text-[14px] uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Expanded Sectors</label>
        <button
          onClick={toggleSectors}
          disabled={savingSectors}
          className="flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <div className={`relative w-10 h-5 rounded-full transition-colors ${sectorCount === 7 ? 'bg-[var(--k10-red)]' : 'bg-[var(--bg-panel)] border border-[var(--border)]'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sectorCount === 7 ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-[var(--text-dim)] font-mono">
            {savingSectors ? '...' : sectorCount}
          </span>
        </button>
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

export default function TracksSection() {
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
      {/* Header — full width above both columns */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide uppercase text-[var(--text)]">
            Track Maps
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Upload CSV track data and manage SVG track maps for the overlay.
          </p>
        </div>
        <span className="text-sm text-[var(--text-dim)]">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}{missing.length > 0 && ` · ${missing.length} missing`}
        </span>
      </div>

      {loading && <p className="text-[var(--text-muted)] text-sm mb-4">Loading...</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* Two-column layout: Upload (narrow left) | Track list (wide right) */}
      <div className="flex gap-6 items-start">
        {/* Left: Upload interface (1/3 width) */}
        <div
          className="w-4/12 min-w-0 sticky top-6"
        >
          <UploadForm onUploaded={fetchTracks} />

          {/* Missing tracks */}
          {missing.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-3">
                Missing Track Maps ({missing.length})
              </h2>
              <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                      <th className="text-left px-3 py-2">Track</th>
                      <th className="text-left px-3 py-2">Games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map(t => (
                      <tr key={t.trackId} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)] transition-colors">
                        <td className="px-3 py-2">
                          <span className="text-[var(--text)] font-medium text-xs block">{t.name}</span>
                          <span className="text-[var(--text-dim)] font-mono text-[10px]">{t.trackId}</span>
                        </td>
                        <td className="px-3 py-2">
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

        {/* Right: Track list (2/3 width) */}
        <div className="w-8/12 min-w-0">
          <SearchFilterBar search={search} onSearch={setSearch} game={game} onGame={setGame} sort={sort} onSort={setSort} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map(track => (
              <TrackCard key={track.id} track={track} onDelete={deleteTrack} deleting={deleting} onUpdate={fetchTracks} />
            ))}
          </div>

          {!loading && tracks.length === 0 && (
            <p className="text-[var(--text-muted)] text-sm text-center py-8">No track maps match your filters.</p>
          )}
        </div>
      </div>
    </div>
  )
}
