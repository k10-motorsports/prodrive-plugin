'use client'

import { ReactNode } from 'react'

// ── Types ──

export interface Track {
  id: string
  trackId: string
  trackName: string
  displayName: string | null
  svgPath: string
  pointCount: number
  gameName: string | null
  trackLengthKm: number | null
  sectorCount: number
  logoSvg: string | null
  logoPngDataUri: string | null
  createdAt: string
  updatedAt: string
}

export interface MissingTrack {
  trackId: string
  name: string
  games: string[]
}

export interface LogoEntry {
  id: string
  brandKey: string
  brandName: string
  brandColorHex: string | null
  logoSvg: string | null
  hasPng: boolean
  games?: string[]
  createdAt: string
  updatedAt: string
}

export interface MissingBrand {
  brandKey: string
  brandName: string
  country: string
  defaultColor: string
  games: string[]
}

export interface User {
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

export interface ConnectionLog {
  id: string
  timestamp: string
  operation: string
  status: 'success' | 'failure'
  duration: number
  errorDetails: string | null
}

export interface LogsResponse {
  success: boolean
  logs: ConnectionLog[]
  stats: { total: number; successful: number; failed: number; avgDuration: number }
}

// ── SearchFilterBar ──

export function SearchFilterBar({ search, onSearch, game, onGame, sort, onSort, sortOptions }: {
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

// ── GameBadge ──

export function GameBadge({ game }: { game: string }) {
  const colors: Record<string, string> = {
    iracing: 'bg-blue-500/20 text-blue-400',
    acc: 'bg-green-500/20 text-green-400',
  }
  return (
    <span className={`text-[14px] px-1.5 py-0.5 rounded font-medium uppercase ${colors[game] || 'bg-gray-500/20 text-gray-400'}`}>
      {game}
    </span>
  )
}

// ── StatCard ──

export function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'green' | 'red' | 'muted' }) {
  const colorClass = color === 'green' ? 'text-[var(--green)]' : color === 'red' ? 'text-red-400' : 'text-[var(--text-dim)]'
  return (
    <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-surface)]">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
