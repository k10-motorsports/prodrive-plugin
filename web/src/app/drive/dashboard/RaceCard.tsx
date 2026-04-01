'use client'

import IRatingSparkline from './IRatingSparkline'

interface RaceSession {
  id: string
  carModel: string
  trackName: string | null
  finishPosition: number | null
  incidentCount: number | null
  sessionType: string | null
  category: string
  metadata: Record<string, any> | null
  createdAt: Date
}

export default function RaceCard({
  session,
  trackSvgPath,
  iRatingHistory,
}: {
  session: RaceSession
  trackSvgPath: string | null
  iRatingHistory: number[]
}) {
  const meta = (session.metadata || {}) as Record<string, any>
  const pos = session.finishPosition
  const isDNF = !pos || pos === 0
  const incidents = session.incidentCount ?? 0
  const bestLap = meta.bestLapTime

  // Format lap time
  let lapStr = '—'
  if (bestLap && bestLap > 0) {
    const m = Math.floor(bestLap / 60)
    const sec = bestLap - m * 60
    lapStr = m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(3)
  }

  // Format date
  const date = new Date(session.createdAt)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  // Position badge color
  let posBg = 'hsla(0,0%,100%,0.08)'
  let posColor = 'hsla(0,0%,100%,0.5)'
  if (isDNF) {
    posBg = 'hsla(270,50%,40%,0.3)'
    posColor = 'hsl(270,60%,70%)'
  } else if (pos === 1) {
    posBg = 'hsla(45,90%,50%,0.2)'
    posColor = 'hsl(45,90%,60%)'
  } else if (pos === 2) {
    posBg = 'hsla(0,0%,75%,0.15)'
    posColor = 'hsl(0,0%,75%)'
  } else if (pos === 3) {
    posBg = 'hsla(30,60%,45%,0.2)'
    posColor = 'hsl(30,60%,55%)'
  } else if (pos <= 10) {
    posBg = 'hsla(142,50%,45%,0.15)'
    posColor = 'hsl(142,60%,55%)'
  }

  const sessionLabel = (session.sessionType || session.category || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-white/[0.02] transition-colors">
      {/* Track map outline */}
      <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center opacity-40">
        {trackSvgPath ? (
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <path
              d={trackSvgPath}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <div className="w-10 h-10 rounded-full border border-current opacity-30 flex items-center justify-center text-xs font-bold">
            {(session.trackName || '?')[0]}
          </div>
        )}
      </div>

      {/* Session info */}
      <div className="flex-grow min-w-0">
        <div className="font-semibold text-sm text-[var(--text-secondary)] truncate">
          {session.trackName || 'Unknown Track'}
        </div>
        <div className="text-xs text-[var(--text-dim)] truncate">
          {session.carModel || 'Unknown Car'}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
          <span>{dateStr}</span>
          {sessionLabel && (
            <>
              <span className="opacity-30">·</span>
              <span>{sessionLabel}</span>
            </>
          )}
          {lapStr !== '—' && (
            <>
              <span className="opacity-30">·</span>
              <span className="font-mono">{lapStr}</span>
            </>
          )}
        </div>
      </div>

      {/* Position + incidents */}
      <div className="flex-shrink-0 text-center" style={{ minWidth: '48px' }}>
        <div
          className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-sm font-black"
          style={{ background: posBg, color: posColor }}
        >
          {isDNF ? 'DNF' : 'P' + pos}
        </div>
        {incidents > 0 && (
          <div className="text-xs text-[var(--text-muted)] mt-1">{incidents}x</div>
        )}
      </div>

      {/* iRating sparkline */}
      <div className="flex-shrink-0">
        <IRatingSparkline values={iRatingHistory} />
      </div>
    </div>
  )
}
