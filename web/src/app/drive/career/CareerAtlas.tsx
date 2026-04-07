'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { Car } from 'lucide-react'

interface RaceSession {
  id: string
  userId: string
  carModel: string
  manufacturer: string
  category: string
  gameName: string
  trackName: string | null
  sessionType: string | null
  finishPosition: number | null
  incidentCount: number | null
  metadata: Record<string, any> | null
  createdAt: Date | string
}

interface RatingHistoryEntry {
  id: string
  userId: string
  category: string
  iRating: number
  safetyRating: number
  license: string
  prevIRating: number | null
  prevSafetyRating: number | null
  prevLicense: string | null
  sessionType: string | null
  trackName: string | null
  carModel: string | null
  createdAt: Date | string
}

interface DriverRating {
  id: string
  userId: string
  category: string
  iRating: number
  safetyRating: number
  license: string
  updatedAt: Date | string
}

function formatDuration(startDate: Date, endDate: Date): string {
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months !== 1 ? 's' : ''}`
  }

  const years = Math.floor(diffDays / 365)
  const remainingMonths = Math.floor((diffDays % 365) / 30)
  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`
  }
  return `${years} year${years !== 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
}

function formatDate(dateStr: string | Date): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getGameBadgeColor(gameName: string): { bg: string; text: string; badge: string } {
  const normalized = gameName.toLowerCase()
  if (normalized === 'iracing') {
    return { bg: 'hsla(213,90%,50%,0.15)', text: 'hsl(213,90%,60%)', badge: 'iR' }
  }
  if (normalized === 'acc' || normalized === 'assetto corsa competizione') {
    return { bg: 'hsla(0,90%,50%,0.15)', text: 'hsl(0,90%,60%)', badge: 'ACC' }
  }
  if (normalized === 'lmu' || normalized === 'lemans unlimited') {
    return { bg: 'hsla(142,50%,45%,0.15)', text: 'hsl(142,60%,55%)', badge: 'LMU' }
  }
  return { bg: 'hsla(270,50%,50%,0.15)', text: 'hsl(270,60%,70%)', badge: gameName.substring(0, 3).toUpperCase() }
}

function getPositionColor(position: number | null): { bg: string; text: string; label: string } {
  if (!position || position === 0) {
    return { bg: 'hsla(270,50%,40%,0.3)', text: 'hsl(270,60%,70%)', label: 'DNF' }
  }
  if (position === 1) {
    return { bg: 'hsla(45,90%,50%,0.2)', text: 'hsl(45,90%,60%)', label: `P${position}` }
  }
  if (position === 2) {
    return { bg: 'hsla(0,0%,75%,0.15)', text: 'hsl(0,0%,75%)', label: `P${position}` }
  }
  if (position === 3) {
    return { bg: 'hsla(30,60%,45%,0.2)', text: 'hsl(30,60%,55%)', label: `P${position}` }
  }
  if (position <= 10) {
    return { bg: 'hsla(142,50%,45%,0.15)', text: 'hsl(142,60%,55%)', label: `P${position}` }
  }
  return { bg: 'hsla(0,0%,100%,0.08)', text: 'hsla(0,0%,100%,0.5)', label: `P${position}` }
}

export default function CareerAtlas({
  sessions,
  ratingHistory,
  currentRatings,
}: {
  sessions: RaceSession[]
  ratingHistory: RatingHistoryEntry[]
  currentRatings: DriverRating[]
}) {
  const stats = useMemo(() => {
    const totalRaces = sessions.length
    const totalLaps = sessions.reduce((sum, s) => {
      const meta = s.metadata as Record<string, any> || {}
      return sum + (meta.completedLaps || 0)
    }, 0)

    const uniqueGames = new Set(sessions.map(s => s.gameName))
    const gamesCount = uniqueGames.size

    const uniqueTracks = new Set(sessions.map(s => s.trackName).filter(Boolean))
    const tracksCount = uniqueTracks.size

    const uniqueCars = new Set(sessions.map(s => s.carModel).filter(Boolean))
    const carsCount = uniqueCars.size

    const currentIRating = ratingHistory.length > 0 ? ratingHistory[0].iRating : null

    const careerStart = sessions.length > 0
      ? new Date(sessions[sessions.length - 1].createdAt)
      : null
    const careerEnd = sessions.length > 0
      ? new Date(sessions[0].createdAt)
      : null
    const careerSpan = careerStart && careerEnd
      ? formatDuration(careerStart, careerEnd)
      : null

    return {
      totalRaces,
      totalLaps,
      currentIRating,
      careerSpan,
      gamesCount,
      tracksCount,
      carsCount,
    }
  }, [sessions, ratingHistory])

  const ratingChartData = useMemo(() => {
    if (ratingHistory.length === 0) return []
    return [...ratingHistory].reverse().map((entry) => ({
      date: formatDate(entry.createdAt),
      iRating: entry.iRating,
      trackName: entry.trackName || 'Unknown',
      carModel: entry.carModel || 'Unknown',
    }))
  }, [ratingHistory])

  const ratingMilestones = useMemo(() => {
    if (ratingChartData.length === 0) return []
    const minRating = Math.min(...ratingChartData.map(d => d.iRating))
    const maxRating = Math.max(...ratingChartData.map(d => d.iRating))

    const milestones = [1000, 1500, 2000, 2500, 3000]
    return milestones.filter(m => m >= minRating && m <= maxRating)
  }, [ratingChartData])

  const gameDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    sessions.forEach(s => {
      counts[s.gameName] = (counts[s.gameName] || 0) + 1
    })
    return Object.entries(counts).map(([name, count]) => ({
      name,
      value: count,
    }))
  }, [sessions])

  const gameColors: Record<string, string> = {
    'iRacing': '#1e88e5',
    'ACC': '#e53935',
    'LMU': '#43a047',
  }

  const sessionsByMonth = useMemo(() => {
    const grouped: Record<string, RaceSession[]> = {}
    sessions.forEach(s => {
      const date = new Date(s.createdAt)
      const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(s)
    })
    return grouped
  }, [sessions])

  if (sessions.length === 0) {
    return (
      <main className="min-h-screen">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <a href="/drive/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">
            &larr; Back to Dashboard
          </a>
        </header>
        <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[60vh]">
          <Car size={48} className="text-[var(--text-muted)] mb-4" />
          <p className="text-lg font-semibold text-[var(--text-secondary)] mb-1">Your racing career starts with your next session</p>
          <p className="text-sm text-[var(--text-dim)]">Complete races with data sync enabled to see your career progression</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <a href="/drive/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">
          &larr; Back to Dashboard
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Career Summary Bar */}
        <section className="mb-12">
          <h1 className="text-3xl font-bold mb-6" style={{ fontFamily: 'var(--ff-display)' }}>Career Atlas</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Total Races</div>
              <div className="text-2xl font-black">{stats.totalRaces}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Total Laps</div>
              <div className="text-2xl font-black">{stats.totalLaps}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">iRating</div>
              <div className="text-2xl font-black">{stats.currentIRating ?? '—'}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Career Span</div>
              <div className="text-xl font-black">{stats.careerSpan || '—'}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Games</div>
              <div className="text-2xl font-black">{stats.gamesCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Tracks</div>
              <div className="text-2xl font-black">{stats.tracksCount}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Unique Cars</div>
              <div className="text-2xl font-black">{stats.carsCount}</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* iRating Timeline */}
          <section className="lg:col-span-2">
            <h2 className="text-lg font-bold mb-4 text-[var(--text-secondary)]">iRating Timeline</h2>
            {ratingChartData.length > 0 ? (
              <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={ratingChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorIRating" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e53935" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#e53935" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                      }}
                      formatter={(value) => [`${value}`, 'iRating']}
                    />
                    {ratingMilestones.map((milestone) => (
                      <ReferenceLine
                        key={milestone}
                        y={milestone}
                        stroke="rgba(255,255,255,0.15)"
                        strokeDasharray="3 3"
                        label={{
                          value: milestone.toString(),
                          position: 'right',
                          fill: 'rgba(255,255,255,0.35)',
                          fontSize: 11,
                        }}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="iRating"
                      stroke="#e53935"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIRating)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
                <p className="text-sm text-[var(--text-dim)]">Complete some races to see your iRating progression</p>
              </div>
            )}
          </section>

          {/* Game Distribution */}
          <section>
            <h2 className="text-lg font-bold mb-4 text-[var(--text-secondary)]">Game Distribution</h2>
            {gameDistribution.length > 1 ? (
              <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={gameDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {gameDistribution.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={gameColors[entry.name] || '#7c6cf0'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                      }}
                      formatter={(value) => [`${value} race${value !== 1 ? 's' : ''}`, 'Count']}
                    />
                    <Legend
                      wrapperStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}
                      formatter={(value) => {
                        const game = gameDistribution.find(g => g.name === value)
                        return game ? `${game.name} (${game.value})` : value
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] font-semibold mb-2">
                  {gameDistribution[0]?.name}
                </div>
                <div className="text-3xl font-black text-[var(--k10-red)]">
                  {gameDistribution[0]?.value}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">race{gameDistribution[0]?.value !== 1 ? 's' : ''}</div>
              </div>
            )}
          </section>
        </div>

        {/* Race Timeline */}
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-6 text-[var(--text-secondary)]">Race Timeline</h2>
          <div className="space-y-8">
            {Object.entries(sessionsByMonth).map(([month, monthSessions]) => (
              <div key={month}>
                <div className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-3">
                  <div className="w-1 h-4 bg-[var(--k10-red)] rounded-full"></div>
                  {month}
                </div>
                <div className="space-y-2 ml-3">
                  {monthSessions.map((session) => {
                    const meta = session.metadata as Record<string, any> || {}
                    const gameBadge = getGameBadgeColor(session.gameName)
                    const posBadge = getPositionColor(session.finishPosition)
                    const incidents = session.incidentCount ?? 0

                    let iRatingDelta: { value: number; color: string } | null = null
                    if (meta.preRaceIRating && ratingHistory.length > 0) {
                      const raceTime = new Date(session.createdAt)
                      const matchingRating = ratingHistory.find(r => {
                        const rTime = new Date(r.createdAt)
                        return Math.abs(rTime.getTime() - raceTime.getTime()) < 60 * 60 * 1000
                      })
                      if (matchingRating) {
                        const delta = matchingRating.iRating - meta.preRaceIRating
                        iRatingDelta = {
                          value: delta,
                          color: delta >= 0 ? 'hsl(142,60%,55%)' : 'hsl(0,90%,60%)',
                        }
                      }
                    }

                    return (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors"
                      >
                        <div className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0">
                          {formatDate(session.createdAt)}
                        </div>

                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[var(--text-secondary)] truncate">
                              {session.trackName || 'Unknown Track'}
                            </span>
                            <span className="text-xs text-[var(--text-dim)] truncate">
                              {session.carModel || 'Unknown Car'}
                            </span>
                          </div>
                        </div>

                        <div
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold flex-shrink-0"
                          style={{ background: gameBadge.bg, color: gameBadge.text }}
                        >
                          {gameBadge.badge}
                        </div>

                        <div
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-bold flex-shrink-0"
                          style={{ background: posBadge.bg, color: posBadge.text }}
                        >
                          {posBadge.label}
                        </div>

                        {iRatingDelta && (
                          <div
                            className="text-xs font-semibold flex-shrink-0"
                            style={{ color: iRatingDelta.color }}
                          >
                            {iRatingDelta.value >= 0 ? '+' : ''}{iRatingDelta.value}
                          </div>
                        )}

                        {incidents > 0 && (
                          <div className="text-xs text-[var(--text-muted)] flex-shrink-0">
                            {incidents}x
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-[var(--border)] text-center">
          <a href="/drive/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">
            &larr; Back to Dashboard
          </a>
        </footer>
      </div>
    </main>
  )
}
