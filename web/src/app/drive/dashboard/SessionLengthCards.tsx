'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Zap } from 'lucide-react'

interface SessionData {
  finishPosition: number | null
  incidentCount: number | null
  metadata: Record<string, any> | null
}

interface Props {
  sessions: SessionData[]
}

interface Bucket {
  label: string
  sessions: number
  avgPosition: number | null
  podiumRate: number
  avgIncidents: number
}

function getBucket(completedLaps: number | null | undefined): 0 | 1 | 2 {
  if (!completedLaps) return 0
  if (completedLaps < 15) return 0
  if (completedLaps <= 30) return 1
  return 2
}

export default function SessionLengthCards({ sessions }: Props) {
  const buckets = useMemo(() => {
    const labels = ['Short', 'Medium', 'Long']
    const positions: number[][] = [[], [], []]
    const incidents: number[][] = [[], [], []]

    for (const s of sessions) {
      const laps = s.metadata?.completedLaps ?? s.metadata?.totalLaps ?? null
      const idx = getBucket(laps)
      if (s.finishPosition != null) positions[idx].push(s.finishPosition)
      incidents[idx].push(s.incidentCount ?? 0)
    }

    return labels.map((label, i): Bucket => {
      const pos = positions[i]
      const inc = incidents[i]
      const count = Math.max(pos.length, inc.length)
      return {
        label,
        sessions: count,
        avgPosition: pos.length > 0 ? pos.reduce((a, b) => a + b, 0) / pos.length : null,
        podiumRate: pos.length > 0 ? pos.filter(p => p >= 1 && p <= 3).length / pos.length : 0,
        avgIncidents: inc.length > 0 ? inc.reduce((a, b) => a + b, 0) / inc.length : 0,
      }
    })
  }, [sessions])

  const maxSessions = Math.max(...buckets.map(b => b.sessions))
  const hasData = sessions.length >= 5

  if (!hasData) {
    return (
      <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full flex flex-col items-center justify-center min-h-[200px]">
        <Zap size={24} className="text-[var(--text-muted)] mb-2 opacity-50" />
        <p className="text-sm text-[var(--text-muted)] text-center">
          Complete 5+ races to see session length stats
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] mb-3">
        <Zap size={24} className="text-[var(--border-accent)]" />
        Session Length
      </div>

      {/* Stacked cards */}
      <div className="flex flex-col gap-2 flex-1">
        {buckets.map((bucket) => {
          const isTop = bucket.sessions === maxSessions && bucket.sessions > 0
          return (
            <div
              key={bucket.label}
              className={`rounded-xl p-3 border transition flex-1 ${
                isTop
                  ? 'border-[var(--k10-red)] bg-[var(--bg-elevated)]'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-[var(--text-secondary)]">
                  {bucket.label}
                </span>
                <span className="text-sm text-[var(--text-muted)]">
                  {bucket.sessions} race{bucket.sessions !== 1 ? 's' : ''}
                </span>
              </div>
              {bucket.sessions > 0 ? (
                <div className="flex items-center gap-4 text-sm">
                  {bucket.avgPosition != null && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Pos</div>
                      <div className="text-lg font-bold text-[var(--text-dim)]">P{bucket.avgPosition.toFixed(1)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Podium</div>
                    <div className="text-lg font-bold text-green-500">{(bucket.podiumRate * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Inc</div>
                    <div className="text-lg font-bold text-[var(--text-dim)]">{bucket.avgIncidents.toFixed(1)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">No data yet</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer link */}
      <Link
        href="/drive/when"
        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors text-right mt-2"
      >
        View full analysis &rarr;
      </Link>
    </div>
  )
}
