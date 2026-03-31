'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──

interface Track {
  id: string
  trackId: string
  trackName: string
  svgPath: string
  pointCount: number
  gameName: string | null
  trackLengthKm: number | null
  createdAt: string
  updatedAt: string
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

// ── Main Component ──

export default function AdminPanel() {
  const [tab, setTab] = useState<'tracks' | 'users'>('tracks')

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex gap-1 mb-8 border-b border-[var(--border)]">
        <TabButton active={tab === 'tracks'} onClick={() => setTab('tracks')}>Track Maps</TabButton>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
      </div>
      {tab === 'tracks' ? <TracksSection /> : <UsersSection />}
    </div>
  )
}

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

// ── Tracks Section ──

function TracksSection() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tracks')
      if (!res.ok) throw new Error('Failed to fetch tracks')
      const data = await res.json()
      setTracks(data.tracks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTracks() }, [fetchTracks])

  const deleteTrack = async (trackId: string) => {
    if (!confirm(`Delete "${trackId}"? This cannot be undone.`)) return
    setDeleting(trackId)
    try {
      const res = await fetch(`/api/admin/tracks?trackId=${encodeURIComponent(trackId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setTracks(prev => prev.filter(t => t.trackId !== trackId))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <UploadForm onUploaded={fetchTracks} />

      <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text-secondary)] mb-4 mt-8">
        Track Maps ({tracks.length})
      </h2>

      {loading && <p className="text-[var(--text-muted)] text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map(track => (
          <div
            key={track.id}
            className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-surface)] hover:border-[var(--border-accent)] transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--text)] truncate">{track.trackName}</h3>
                <p className="text-xs text-[var(--text-muted)] truncate">{track.trackId}</p>
              </div>
              <button
                onClick={() => deleteTrack(track.trackId)}
                disabled={deleting === track.trackId}
                className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer shrink-0 ml-2 disabled:opacity-50"
              >
                {deleting === track.trackId ? '...' : 'Delete'}
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
              <span>{track.gameName}</span>
              <span>{new Date(track.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>

      {!loading && tracks.length === 0 && (
        <p className="text-[var(--text-muted)] text-sm text-center py-8">No track maps in the database.</p>
      )}
    </div>
  )
}

// ── Upload Form ──

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
    // Auto-fill track name from filename if empty
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
        <input
          type="text"
          placeholder="track id (e.g. sebring international)"
          value={trackId}
          onChange={e => setTrackId(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]"
        />
        <input
          type="text"
          placeholder="Track Name"
          value={trackName}
          onChange={e => setTrackName(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--k10-red)]"
        />
        <select
          value={gameName}
          onChange={e => setGameName(e.target.value)}
          className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--k10-red)]"
        >
          <option value="iracing">iRacing</option>
          <option value="lmu">Le Mans Ultimate</option>
          <option value="acc">ACC</option>
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center mb-4 hover:border-[var(--k10-red)] transition-colors cursor-pointer"
        onClick={() => document.getElementById('csv-file-input')?.click()}
      >
        <input id="csv-file-input" type="file" accept=".csv" onChange={handleFile} className="hidden" />
        {fileName ? (
          <p className="text-sm text-[var(--text)]">{fileName} <span className="text-[var(--text-muted)]">({csvText.split('\n').length} lines)</span></p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Drop a CSV file here or click to browse</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={uploading || !trackId || !trackName || !csvText}
          className="px-4 py-2 bg-[var(--k10-red)] text-white text-sm font-medium rounded hover:brightness-110 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload & Generate SVG'}
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

// ── Users Section ──

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
                      <img
                        src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png?size=32`}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
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
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.activeTokens > 0
                      ? 'bg-[var(--green)]/20 text-[var(--green)]'
                      : 'bg-[var(--bg-panel)] text-[var(--text-muted)]'
                  }`}>
                    {user.activeTokens}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
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
