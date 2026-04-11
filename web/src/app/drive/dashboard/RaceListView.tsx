'use client'

import { useMemo } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface RaceSession {
  id: string
  carModel: string
  manufacturer: string | null
  trackName: string | null
  finishPosition: number | null
  incidentCount: number | null
  sessionType: string | null
  category: string
  metadata: Record<string, any> | null
  createdAt: Date
}

interface DisplayCard {
  session: RaceSession
  practiceSession?: RaceSession
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

function getGameBadgeColor(gameName: string): { bg: string; text: string; badge: string } {
  const n = gameName.toLowerCase()
  if (n === 'iracing') return { bg: 'hsla(213,90%,50%,0.15)', text: 'hsl(213,90%,60%)', badge: 'iR' }
  if (n === 'acc' || n === 'assetto corsa competizione') return { bg: 'hsla(0,90%,50%,0.15)', text: 'hsl(0,90%,60%)', badge: 'ACC' }
  if (n === 'lmu' || n === 'lemans unlimited') return { bg: 'hsla(142,50%,45%,0.15)', text: 'hsl(142,60%,55%)', badge: 'LMU' }
  return { bg: 'hsla(270,50%,50%,0.15)', text: 'hsl(270,60%,70%)', badge: gameName.substring(0, 3).toUpperCase() }
}

function getPositionColor(position: number | null): { bg: string; text: string; label: string } {
  if (!position || position === 0) return { bg: 'hsla(270,50%,40%,0.3)', text: 'hsl(270,60%,70%)', label: 'DNF' }
  if (position === 1) return { bg: 'hsla(45,90%,50%,0.2)', text: 'hsl(45,90%,60%)', label: `P${position}` }
  if (position === 2) return { bg: 'hsla(0,0%,75%,0.15)', text: 'hsl(0,0%,75%)', label: `P${position}` }
  if (position === 3) return { bg: 'hsla(30,60%,45%,0.2)', text: 'hsl(30,60%,55%)', label: `P${position}` }
  if (position <= 10) return { bg: 'hsla(142,50%,45%,0.15)', text: 'hsl(142,60%,55%)', label: `P${position}` }
  return { bg: 'hsla(0,0%,100%,0.08)', text: 'hsla(0,0%,100%,0.5)', label: `P${position}` }
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatLapTime(seconds: number | undefined | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return m > 0 ? `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}` : `${s}s`
}

const isPractice = (s: RaceSession) =>
  (s.sessionType || s.category || '').toLowerCase().includes('practice')

// ── Grid column template ──────────────────────────────────────────────────────
// Date | Track+Car | Lap | Game | Pos | iR Δ | Inc | +P
const GRID_COLS = '48px 1fr 72px 36px 44px 48px 28px 20px'

// ── Component ──────────────────────────────────────────────────────────────────

export default function RaceListView({ cards }: { cards: DisplayCard[] }) {
  const grouped = useMemo(() => {
    const map: Record<string, DisplayCard[]> = {}
    for (const card of cards) {
      const date = new Date(card.session.createdAt)
      const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!map[key]) map[key] = []
      map[key].push(card)
    }
    return map
  }, [cards])

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([month, monthCards]) => (
        <div key={month}>
          {/* Month header */}
          <div className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-3">
            <div className="w-1 h-4 bg-[var(--k10-red)] rounded-full" />
            {month}
          </div>

          {/* Rows */}
          <div className="space-y-1.5 ml-3">
            {monthCards.map(({ session, practiceSession }) => {
              const meta = (session.metadata || {}) as Record<string, any>
              const gameName = meta.gameName || 'iRacing'
              const gameBadge = getGameBadgeColor(gameName)
              const posBadge = getPositionColor(session.finishPosition)
              const incidents = session.incidentCount ?? 0
              const practice = isPractice(session)
              const bestLap = formatLapTime(meta.bestLapTime)
              const fieldSize = meta.fieldSize as number | undefined

              const preIR = meta.preRaceIRating as number | undefined
              const postIR = meta.postRaceIRating as number | undefined
              let irDelta: number | null = null
              if (preIR != null && postIR != null) {
                irDelta = postIR - preIR
              }

              return (
                <div
                  key={session.id}
                  className="grid items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--text-muted)] transition-colors"
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  {/* Col 1 — Date */}
                  <div className="text-xs text-[var(--text-muted)] tabular-nums">
                    {formatDate(session.createdAt)}
                  </div>

                  {/* Col 2 — Track + Car (flexible) */}
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-secondary)] truncate">
                      {session.trackName || 'Unknown Track'}
                    </span>
                    <span className="text-xs text-[var(--text-dim)] truncate hidden sm:inline">
                      {session.carModel || 'Unknown Car'}
                    </span>
                  </div>

                  {/* Col 3 — Best lap */}
                  <div className="text-xs text-[var(--text-dim)] tabular-nums text-right" style={{ fontFamily: 'var(--ff-mono)' }}>
                    {bestLap || ''}
                  </div>

                  {/* Col 4 — Game badge */}
                  <div className="flex justify-center">
                    <span
                      className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: gameBadge.bg, color: gameBadge.text }}
                    >
                      {gameBadge.badge}
                    </span>
                  </div>

                  {/* Col 5 — Position / Practice label */}
                  <div className="flex justify-center">
                    {!practice ? (
                      <span
                        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: posBadge.bg, color: posBadge.text }}
                      >
                        {posBadge.label}
                        {fieldSize ? <span className="font-normal opacity-60 ml-0.5">/{fieldSize}</span> : null}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">
                        Prac
                      </span>
                    )}
                  </div>

                  {/* Col 6 — iRating delta */}
                  <div
                    className="text-xs font-bold tabular-nums text-right"
                    style={{
                      color: irDelta != null && !practice
                        ? (irDelta >= 0 ? 'hsl(142,60%,55%)' : 'hsl(0,90%,60%)')
                        : 'transparent',
                    }}
                  >
                    {irDelta != null && !practice
                      ? `${irDelta >= 0 ? '+' : ''}${irDelta}`
                      : ''}
                  </div>

                  {/* Col 7 — Incidents */}
                  <div className="text-[10px] text-[var(--text-muted)] tabular-nums text-right">
                    {incidents > 0 ? `${incidents}x` : ''}
                  </div>

                  {/* Col 8 — Linked practice indicator */}
                  <div className="text-[10px] text-[var(--text-muted)] text-center" title={practiceSession ? 'Includes linked practice session' : ''}>
                    {practiceSession ? '+P' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
