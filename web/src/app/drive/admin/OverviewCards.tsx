'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types (minimal, just what we need for previews) ──

interface TrackPreview {
  trackId: string
  trackName: string
  svgPath: string
}

interface LogoPreview {
  brandKey: string
  brandName: string
  brandColorHex: string | null
  logoSvg: string | null
}

interface UserPreview {
  id: string
  discordId: string
  discordAvatar: string | null
  discordDisplayName: string | null
  discordUsername: string
}

interface LogStats {
  total: number
  successful: number
  failed: number
  avgDuration: number
}

// ── Overview Card Shell ──

function OverviewCard({
  href,
  title,
  count,
  description,
  hero,
  children,
}: {
  href: string
  title: string
  count?: number
  description: string
  hero?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] hover:border-[var(--border-accent)] hover:bg-[var(--bg-panel)] transition-all group flex flex-col overflow-hidden"
    >
      {hero}
      <div className="flex items-baseline justify-between mb-1 px-5 pt-4">
        <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--k10-red)] group-hover:brightness-110 transition-colors">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-2xl font-bold text-[var(--text-dim)] tabular-nums">{count}</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-3 px-5">{description}</p>
      {children && <div className="mt-auto px-5 pb-5">{children}</div>}
    </Link>
  )
}

// ── Small Multiples ──

function TrackMultiples({ tracks }: { tracks: TrackPreview[] }) {
  if (tracks.length === 0) return <EmptyRow label="No tracks yet" />
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {tracks.slice(0, 10).map(t => (
        <div
          key={t.trackId}
          className="w-10 h-10 shrink-0 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] flex items-center justify-center"
        >
          <svg viewBox="0 0 100 100" className="w-8 h-8">
            <path
              d={t.svgPath}
              fill="none"
              stroke="var(--k10-red)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ))}
      {tracks.length > 10 && (
        <div className="w-10 h-10 shrink-0 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] flex items-center justify-center">
          <span className="text-[10px] text-[var(--text-muted)] font-mono">+{tracks.length - 10}</span>
        </div>
      )}
    </div>
  )
}

function LogoMultiples({ logos }: { logos: LogoPreview[] }) {
  if (logos.length === 0) return <EmptyRow label="No logos yet" />
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {logos.slice(0, 10).map(l => (
        <div
          key={l.brandKey}
          className="w-10 h-10 shrink-0 rounded-full border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden"
          style={{ background: l.brandColorHex ? `${l.brandColorHex}8C` : 'var(--bg-panel)' }}
        >
          {l.logoSvg ? (
            <div
              className="w-6 h-6 flex items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-5 [&_svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: l.logoSvg }}
            />
          ) : (
            <span className="text-[8px] text-white/40 font-bold uppercase">
              {l.brandName.slice(0, 2)}
            </span>
          )}
        </div>
      ))}
      {logos.length > 10 && (
        <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] flex items-center justify-center">
          <span className="text-[10px] text-[var(--text-muted)] font-mono">+{logos.length - 10}</span>
        </div>
      )}
    </div>
  )
}

function UserMultiples({ users }: { users: UserPreview[] }) {
  if (users.length === 0) return <EmptyRow label="No users yet" />
  return (
    <div className="flex -space-x-1.5 overflow-hidden">
      {users.slice(0, 12).map(u => (
        <div
          key={u.id}
          className="w-9 h-9 shrink-0 rounded-full border-2 border-[var(--bg-surface)] overflow-hidden"
          title={u.discordDisplayName || u.discordUsername}
        >
          {u.discordAvatar && u.discordId ? (
            <img
              src={`https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png?size=64`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[var(--bg-panel)] flex items-center justify-center">
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">
                {(u.discordDisplayName || u.discordUsername || '?').slice(0, 1)}
              </span>
            </div>
          )}
        </div>
      ))}
      {users.length > 12 && (
        <div className="w-9 h-9 shrink-0 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-panel)] flex items-center justify-center">
          <span className="text-[10px] text-[var(--text-muted)] font-mono">+{users.length - 12}</span>
        </div>
      )}
    </div>
  )
}

function LogsMultiples({ stats }: { stats: LogStats | null }) {
  if (!stats || stats.total === 0) return <EmptyRow label="No logs yet" />
  const pct = stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0
  const barW = Math.max(2, pct)
  return (
    <div className="space-y-1.5">
      {/* Success rate bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-[var(--bg-panel)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${barW}%`,
              background: pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--amber)' : '#ef4444',
            }}
          />
        </div>
        <span className="text-xs text-[var(--text-dim)] font-mono tabular-nums w-10 text-right">{pct}%</span>
      </div>
      {/* Stats row */}
      <div className="flex gap-3 text-[10px] text-[var(--text-muted)]">
        <span><strong className="text-[var(--green)]">{stats.successful}</strong> ok</span>
        {stats.failed > 0 && <span><strong className="text-red-400">{stats.failed}</strong> failed</span>}
        <span>{stats.avgDuration}ms avg</span>
      </div>
    </div>
  )
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-[10px] text-[var(--text-muted)] italic">{label}</p>
}

interface HeroData {
  key: string
  name: string
  imageUrl: string
}

function TrackPhotoHero({ hero, svgPath }: { hero: HeroData; svgPath?: string }) {
  return (
    <div className="h-80 relative overflow-hidden bg-[var(--bg-panel)]">
      <img
        src={hero.imageUrl}
        alt={hero.name}
        className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
      />
      {/* Track SVG overlay */}
      {svgPath && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 m-auto w-28 h-28 z-10 drop-shadow-lg opacity-90">
          <path
            d={svgPath}
            fill="none"
            stroke="var(--k10-red)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 h-16" style={{
        background: 'linear-gradient(to top, var(--bg-surface), transparent)',
      }} />
    </div>
  )
}

function BrandPhotoHero({ hero, logoSvg, brandColor }: { hero: HeroData; logoSvg?: string | null; brandColor?: string | null }) {
  return (
    <div className="h-80 relative overflow-hidden bg-[var(--bg-panel)]">
      <img
        src={hero.imageUrl}
        alt={hero.name}
        className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
      />
      {/* Brand color tint */}
      {brandColor && (
        <div className="absolute inset-0 opacity-20" style={{ background: brandColor }} />
      )}
      {/* Logo SVG overlay */}
      {logoSvg ? (
        <div
          className="absolute inset-0 m-auto w-24 h-24 z-10 flex items-center justify-center drop-shadow-lg opacity-90 [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-20 [&_svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
      ) : (
        <span className="absolute inset-0 m-auto w-fit h-fit z-10 text-3xl font-bold text-white/60 uppercase drop-shadow-lg">
          {hero.name}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 h-16" style={{
        background: 'linear-gradient(to top, var(--bg-surface), transparent)',
      }} />
    </div>
  )
}

// ── Main ──

export default function OverviewCards() {
  const [tracks, setTracks] = useState<TrackPreview[]>([])
  const [trackCount, setTrackCount] = useState<number>()
  const [logos, setLogos] = useState<LogoPreview[]>([])
  const [logoCount, setLogoCount] = useState<number>()
  const [missingCount, setMissingCount] = useState(0)
  const [users, setUsers] = useState<UserPreview[]>([])
  const [logStats, setLogStats] = useState<LogStats | null>(null)
  const [trackHero, setTrackHero] = useState<HeroData | null>(null)
  const [brandHero, setBrandHero] = useState<HeroData | null>(null)

  useEffect(() => {
    // Fire all fetches concurrently
    fetch('/api/admin/heroes')
      .then(r => r.json())
      .then(d => {
        if (d.trackHero) setTrackHero(d.trackHero)
        if (d.brandHero) setBrandHero(d.brandHero)
      })
      .catch(() => {})

    fetch('/api/admin/tracks')
      .then(r => r.json())
      .then(d => {
        setTracks(d.tracks || [])
        setTrackCount(d.total ?? (d.tracks || []).length)
      })
      .catch(() => {})

    fetch('/api/admin/logos')
      .then(r => r.json())
      .then(d => {
        setLogos(d.logos || [])
        setLogoCount(d.total ?? (d.logos || []).length)
        setMissingCount((d.missing || []).length)
      })
      .catch(() => {})

    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {})

    fetch('/api/admin/logs')
      .then(r => r.json())
      .then(d => setLogStats(d.stats || null))
      .catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <OverviewCard
        href="/drive/admin/tracks"
        title="Track Maps"
        count={trackCount}
        description="Manage track map SVGs, upload new track data from CSV files"
        hero={trackHero ? <TrackPhotoHero hero={trackHero} svgPath={tracks.find(t => t.trackId.includes(trackHero.key) || trackHero.key.includes(t.trackId))?.svgPath} /> : undefined}
      >
        <TrackMultiples tracks={tracks} />
      </OverviewCard>

      <OverviewCard
        href="/drive/admin/brands"
        title="Car Brands"
        count={logoCount}
        description={missingCount > 0 ? `${missingCount} brands still need logos` : 'Manage car brand logos, colors, and artwork'}
        hero={brandHero ? (() => {
          const match = logos.find(l => l.brandKey === brandHero.key || l.brandName.toLowerCase() === brandHero.name.toLowerCase())
          return <BrandPhotoHero hero={brandHero} logoSvg={match?.logoSvg} brandColor={match?.brandColorHex} />
        })() : undefined}
      >
        <LogoMultiples logos={logos} />
      </OverviewCard>

      <OverviewCard
        href="/drive/admin/users"
        title="Users"
        count={users.length || undefined}
        description="View registered users and their Discord accounts"
      >
        <UserMultiples users={users} />
      </OverviewCard>

      <OverviewCard
        href="/drive/admin/logs"
        title="Logs"
        count={logStats?.total}
        description="Monitor API and database operation logs"
      >
        <LogsMultiples stats={logStats} />
      </OverviewCard>
    </div>
  )
}
