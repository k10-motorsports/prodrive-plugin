'use client'

import Link from 'next/link'
import { ArrowLeft, Trophy, Gauge, MapPin, Car } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface SiblingCar {
  carModel: string
  totalRaces: number
  avgPosition: number | null
  wins: number
  avgIncidents: number
  imageUrl: string | null
}

interface CarDetailClientProps {
  carModel: string
  carImageUrl: string | null
  brandLogoSrc: string | null
  brandColor: string | null
  brandName: string | null
  stats: {
    totalRaces: number
    totalLaps: number
    avgPosition: number | null
    bestPosition: number | null
    avgIncidents: number
    totalIncidents: number
    wins: number
    podiums: number
    cleanRaces: number
  }
  positionHistory: Array<{ date: string; position: number; incidents: number; trackName: string }>
  irHistory: Array<{ date: string; iRating: number; delta: number }>
  tracksUsed: Array<{ track: string; count: number }>
  recentSessions: Array<{
    id: string; trackName: string; finishPosition: number | null
    incidentCount: number; sessionType: string; date: string; irDelta: number | null
  }>
  narrativeSummary: string
  siblingCars?: SiblingCar[]
  brandStats?: {
    totalRaces: number
    totalCars: number
    avgPosition: number | null
    wins: number
    podiums: number
    avgIncidents: number
  } | null
  manufacturer?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CarDetailClient(props: CarDetailClientProps) {
  const {
    carModel, carImageUrl, brandLogoSrc, brandColor, brandName,
    stats, positionHistory, irHistory, tracksUsed, recentSessions, narrativeSummary,
    siblingCars = [], brandStats = null, manufacturer = null,
  } = props

  const allCars = [
    { model: carModel, races: stats.totalRaces, current: true },
    ...siblingCars.map(s => ({ model: s.carModel, races: s.totalRaces, current: false })),
  ]

  return (
    <main className="min-h-screen bg-[var(--bg)]">

      {/* ── Car Selector Nav (above hero) ─────────────────────────────────── */}
      {siblingCars.length > 0 && (
        <div className="bg-[var(--bg-panel)] border-b" style={{ borderColor: brandColor ? `${brandColor}30` : 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
              {/* Brand badge */}
              <div className="flex items-center gap-2 pr-3 mr-1 border-r flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                {brandLogoSrc && (
                  <img src={brandLogoSrc} alt={brandName || ''} className="h-5 w-auto object-contain" />
                )}
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  {manufacturer || brandName}
                </span>
              </div>

              {/* Car tabs */}
              {allCars.map(c => (
                <Link
                  key={c.model}
                  href={c.current ? '#' : `/drive/car/${encodeURIComponent(c.model)}`}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    c.current
                      ? 'text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5'
                  }`}
                  style={c.current ? {
                    background: brandColor ? `${brandColor}25` : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${brandColor || 'var(--border-accent)'}`,
                  } : {
                    border: '1px solid transparent',
                  }}
                >
                  {c.model}
                  <span className="text-xs opacity-50">{c.races}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[var(--bg-panel)]">
        {carImageUrl && (
          <img src={carImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-panel)] via-[var(--bg-panel)]/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg)] to-transparent pointer-events-none" />

        <div className="relative z-10 px-6 pt-4 pb-8 max-w-6xl mx-auto">
          <Link href="/drive/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-6">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {brandLogoSrc && (
                  <div
                    className="flex items-center px-3 py-2 rounded"
                    style={{
                      background: brandColor ? `${brandColor}22` : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${brandColor ? brandColor + '44' : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    <img src={brandLogoSrc} alt={brandName || ''} className="h-8 w-auto object-contain" />
                  </div>
                )}
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-[var(--text)]" style={{ fontFamily: 'var(--ff-display)' }}>
                  {carModel}
                </h1>
              </div>
              {brandName && (
                <div className="text-sm text-[var(--text-muted)] mt-1">{brandName}</div>
              )}
              <p className="text-sm text-[var(--text-dim)] mt-3 max-w-xl">{narrativeSummary}</p>
            </div>

            {/* Win/Podium summary */}
            <div className="flex items-center gap-6 flex-shrink-0">
              {stats.wins > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-black text-yellow-400" style={{ fontFamily: 'var(--ff-display)' }}>{stats.wins}</div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Win{stats.wins !== 1 ? 's' : ''}</div>
                </div>
              )}
              {stats.podiums > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-black text-amber-400" style={{ fontFamily: 'var(--ff-display)' }}>{stats.podiums}</div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Podium{stats.podiums !== 1 ? 's' : ''}</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-3xl font-black text-[var(--text)]" style={{ fontFamily: 'var(--ff-display)' }}>{stats.totalRaces}</div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Race{stats.totalRaces !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Races', value: stats.totalRaces, color: 'text-[var(--text)]' },
            { label: 'Laps', value: stats.totalLaps, color: 'text-[var(--text)]' },
            { label: 'Avg Pos', value: stats.avgPosition ? `P${stats.avgPosition.toFixed(1)}` : '—', color: 'text-[var(--text)]' },
            { label: 'Best', value: stats.bestPosition ? `P${stats.bestPosition}` : '—', color: 'text-emerald-400' },
            { label: 'Wins', value: stats.wins, color: 'text-yellow-400' },
            { label: 'Podiums', value: stats.podiums, color: 'text-amber-400' },
            { label: 'Avg Inc', value: stats.avgIncidents.toFixed(1), color: stats.avgIncidents <= 3 ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'Clean', value: stats.cleanRaces, color: 'text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3">
              <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Brand Aggregate Strip */}
        {brandStats && siblingCars.length > 0 && (
          <div
            className="rounded-lg border px-5 py-3 flex items-center gap-6 flex-wrap"
            style={{
              background: brandColor ? `${brandColor}08` : 'var(--bg-elevated)',
              borderColor: brandColor ? `${brandColor}25` : 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 mr-auto">
              {brandLogoSrc && <img src={brandLogoSrc} alt="" className="h-4 w-auto object-contain" />}
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                All {manufacturer || brandName}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {brandStats.totalCars} car{brandStats.totalCars !== 1 ? 's' : ''} · {brandStats.totalRaces} races
              </span>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <span className="text-[var(--text-muted)]">Avg <strong className="text-[var(--text)]">P{brandStats.avgPosition?.toFixed(1) || '—'}</strong></span>
              <span className="text-[var(--text-muted)]">Wins <strong className="text-yellow-400">{brandStats.wins}</strong></span>
              <span className="text-[var(--text-muted)]">Podiums <strong className="text-amber-400">{brandStats.podiums}</strong></span>
              <span className="text-[var(--text-muted)]">Inc <strong className={brandStats.avgIncidents <= 3 ? 'text-emerald-400' : 'text-amber-400'}>{brandStats.avgIncidents.toFixed(1)}</strong></span>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {positionHistory.length > 1 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
              <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Trophy size={16} className="text-[var(--border-accent)]" /> Position History
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={positionHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={formatDate} tickLine={false} axisLine={false} />
                  <YAxis reversed domain={[1, 'auto']} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v: any) => formatDate(v)}
                    formatter={(v: any, name: any) => [name === 'position' ? `P${v}` : `${v}x`, name === 'position' ? 'Finish' : 'Incidents']}
                  />
                  {stats.avgPosition && <ReferenceLine y={stats.avgPosition} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />}
                  <Line type="monotone" dataKey="position" stroke={brandColor || '#e53935'} strokeWidth={2} dot={{ fill: brandColor || '#e53935', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {irHistory.length > 1 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
              <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Gauge size={16} className="text-[var(--border-accent)]" /> iRating in This Car
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={irHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickFormatter={formatDate} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v: any) => formatDate(v)}
                    formatter={(v: any) => [v >= 0 ? `+${v}` : v, 'iR Delta']}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <Bar dataKey="delta" radius={[3, 3, 0, 0]} fill="#42a5f5">
                    {irHistory.map((entry, idx) => (
                      <rect key={idx} fill={entry.delta >= 0 ? '#4caf50' : '#f44336'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tracks driven in this car */}
        {tracksUsed.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-[var(--border-accent)]" /> Tracks Driven
            </h3>
            <div className="space-y-2">
              {tracksUsed.map(({ track, count }) => (
                <div key={track} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-panel)]">
                  <Link href={`/drive/track/${encodeURIComponent(track)}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors font-medium">
                    {track}
                  </Link>
                  <span className="text-xs text-[var(--text-muted)]">{count} race{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Races */}
        {recentSessions.length > 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-4">Recent Races</h3>
            <div className="space-y-2">
              {recentSessions.map(s => {
                const pos = s.finishPosition
                const isDNF = !pos || pos === 0
                return (
                  <Link
                    key={s.id}
                    href={`/drive/race/${s.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded bg-[var(--bg-panel)] hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-sm w-10 ${isDNF ? 'text-purple-400' : pos === 1 ? 'text-yellow-400' : pos! <= 3 ? 'text-amber-400' : 'text-[var(--text)]'}`} style={{ fontFamily: 'var(--ff-display)' }}>
                        {isDNF ? 'DNF' : `P${pos}`}
                      </span>
                      <span className="text-sm text-[var(--text-dim)]">{s.trackName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span>{s.incidentCount}x</span>
                      {s.irDelta !== null && (
                        <span className={s.irDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.irDelta >= 0 ? '+' : ''}{s.irDelta} iR
                        </span>
                      )}
                      <span>{formatDate(s.date)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
