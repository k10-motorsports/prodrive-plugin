'use client'

import Link from 'next/link'
import IRatingSparkline from './IRatingSparkline'

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

interface BrandInfo {
  logoSvg: string | null
  logoPng: string | null
  brandColorHex: string | null
  manufacturerName: string
}

export default function RaceCard({
  session,
  practiceSession,
  qualifyingSession,
  trackSvgPath,
  carImageUrl,
  trackImageUrl,
  trackLogoSvg,
  trackDisplayName,
  brandInfo,
  iRatingHistory,
}: {
  session: RaceSession
  practiceSession?: RaceSession
  qualifyingSession?: RaceSession
  trackSvgPath: string | null
  carImageUrl: string | null
  trackImageUrl: string | null
  trackLogoSvg: string | null
  trackDisplayName: string | null
  brandInfo: BrandInfo | null
  iRatingHistory: number[]
}) {
  const meta = (session.metadata || {}) as Record<string, any>
  const pos = session.finishPosition
  const isDNF = !pos || pos === 0
  const incidents = session.incidentCount ?? 0
  const bestLap = meta.bestLapTime
  const gameName = meta.gameName || 'iRacing'
  const fieldSize: number | null = meta.fieldSize ?? null

  const sessionTypeLower = (session.sessionType || session.category || '').toLowerCase()
  const isPractice = sessionTypeLower.includes('practice')

  // Practice best lap (from practiceSession metadata)
  const practiceMeta = (practiceSession?.metadata || {}) as Record<string, any>
  const practiceBestLap = practiceMeta.bestLapTime

  // Qualifying best lap + position
  const qualifyingMeta = (qualifyingSession?.metadata || {}) as Record<string, any>
  const qualifyingBestLap = qualifyingMeta.bestLapTime
  const qualifyingPosition = qualifyingSession?.finishPosition

  const formatLap = (t: number | undefined | null): string => {
    if (!t || t <= 0) return '—'
    const m = Math.floor(t / 60)
    const sec = t - m * 60
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(3)
  }

  const lapStr         = formatLap(bestLap)
  const practiceLapStr = formatLap(practiceBestLap)
  const qualifyingLapStr = formatLap(qualifyingBestLap)

  const date = new Date(session.createdAt)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Session label (humanised)
  const sessionLabel = (session.sessionType || session.category || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()

  // Position badge colors
  let posColor = 'var(--text-dim)'
  if (!isPractice) {
    if (isDNF)          posColor = 'hsl(270,60%,72%)'
    else if (pos === 1) posColor = 'hsl(45,90%,62%)'
    else if (pos === 2) posColor = 'hsl(0,0%,78%)'
    else if (pos === 3) posColor = 'hsl(30,65%,58%)'
    else if (pos && pos <= 10) posColor = 'hsl(142,60%,58%)'
  }

  const getGameBadgeText = (name: string): string => {
    const n = name.toLowerCase()
    if (n === 'iracing') return 'iRacing'
    if (n === 'acc' || n.includes('assetto corsa')) return 'ACC'
    if (n === 'raceroom') return 'RaceRoom'
    if (n.includes('rfactor')) return 'rFactor'
    if (n.includes('automobilista') || n === 'ams') return 'AMS'
    return name
  }

  const getGameLogoUrl = (name: string): string | null => {
    const n = name.toLowerCase()
    if (n === 'iracing') return '/_demo/images/logos/iracing.svg'
    return null
  }

  const gameLogoUrl = getGameLogoUrl(gameName)
  const gameLabel   = getGameBadgeText(gameName)

  // Brand logo source (prefer SVG, fallback to PNG data URI)
  const brandLogoSrc = brandInfo?.logoSvg
    ? `data:image/svg+xml,${encodeURIComponent(brandInfo.logoSvg)}`
    : brandInfo?.logoPng
      ? `data:image/png;base64,${brandInfo.logoPng}`
      : null
  const brandColor = brandInfo?.brandColorHex || null

  // Track SVG stroke: always use the active theme token (--k10-red slot, overridden per team)
  const trackStroke = 'var(--border-accent)'

  // Track display label
  const trackLabel = trackDisplayName || session.trackName || 'Unknown Track'

  return (
    <Link
      href={`/drive/race/${session.id}`}
      className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-elevated)] hover:border-[var(--border-accent)] transition-colors flex flex-col cursor-pointer"
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative h-40 bg-[var(--bg-panel)] overflow-hidden flex-shrink-0">

        {/* Layer 1: track photo background */}
        {trackImageUrl && (
          <img
            src={trackImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
          />
        )}

        {/* Layer 2: car photo fallback if no track image */}
        {!trackImageUrl && carImageUrl && (
          <img
            src={carImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
        )}

        {/* Layer 3: track SVG outline — centered, constrained, colored by brand */}
        {trackSvgPath && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg
              viewBox="0 0 100 100"
              className="w-4/5 h-4/5"
              preserveAspectRatio="xMidYMid meet"
            >
              <path
                d={trackSvgPath}
                fill="none"
                stroke={trackStroke}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Layer 4: bottom gradient — always dark so chips remain legible */}
        <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none card-header-gradient" />

        {/* Game logo chip — top left */}
        <div
          className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}
        >
          {gameLogoUrl ? (
            <img src={gameLogoUrl} alt={gameLabel} className="h-3.5 w-auto object-contain" />
          ) : (
            <span className="text-xs font-bold leading-none text-[var(--text-secondary)]">{gameLabel}</span>
          )}
        </div>

        {/* Brand chip — bottom left, sits on dark gradient */}
        {brandInfo && (
          <div
            className="brand-chip absolute bottom-0 left-0 m-3 flex items-center gap-2 px-2.5 py-1.5"
            style={{
              '--chip-bg': brandColor ? `${brandColor}55` : 'rgba(0,0,0,0.55)',
              '--chip-border': brandColor ? `${brandColor}99` : 'var(--border)',
              background: 'var(--chip-bg)',
              border: '1px solid var(--chip-border)',
              backdropFilter: 'blur(6px)',
              borderRadius: 'var(--corner-r-sm)',
            } as React.CSSProperties}
          >
            {brandLogoSrc ? (
              <img src={brandLogoSrc} alt={brandInfo.manufacturerName} className="h-12 w-auto object-contain flex-shrink-0" />
            ) : brandColor ? (
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: brandColor }} />
            ) : null}
          </div>
        )}
      </div>

      {/* ── Card body ──────────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-grow">

        {/* Track name / car model (left) + position badge (right) */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
              {trackLogoSvg && (
                <img
                  src={`data:image/svg+xml,${encodeURIComponent(trackLogoSvg)}`}
                  alt=""
                  className="w-4 h-4 flex-shrink-0"
                />
              )}
              <h3 className="font-bold text-[var(--text)] truncate leading-tight hover:text-[var(--border-accent)] transition-colors">
                {trackLabel}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-dim)] truncate hover:text-[var(--text-secondary)] transition-colors">
              {session.carModel || 'Unknown Car'}
            </p>
          </div>

          {/* Position badge */}
          {!isPractice && (
            <div className="flex flex-col items-end shrink-0 leading-none" style={{ color: posColor }}>
              <div className="flex items-end">
                {isDNF ? (
                  <span className="text-lg font-black tracking-tight" style={{ fontFamily: 'var(--ff-display)' }}>DNF</span>
                ) : (
                  <>
                    <span className="text-base font-bold mr-0.5 mb-0.5 opacity-70" style={{ fontFamily: 'var(--ff-display)' }}>P</span>
                    <span className="text-6xl font-black tracking-tight leading-none" style={{ fontFamily: 'var(--ff-display)' }}>{pos}</span>
                  </>
                )}
              </div>
              {fieldSize && !isDNF && (
                <span className="text-xs font-semibold mt-0.5 opacity-60">of {fieldSize}</span>
              )}
            </div>
          )}
        </div>

        {/* Pre-race sessions (practice + qualifying) */}
        {(practiceSession || qualifyingSession) && (
          <div className="mb-3 space-y-1.5">
            {practiceSession && (
              <div
                className="px-2.5 py-2"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--corner-r-sm)',
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] uppercase tracking-wide text-xs font-semibold">Practice</span>
                  <span className="font-mono text-[var(--text-dim)]">{practiceLapStr}</span>
                </div>
                {(practiceSession.incidentCount ?? 0) > 0 && (
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {practiceSession.incidentCount}× incidents
                  </div>
                )}
              </div>
            )}
            {qualifyingSession && (
              <div
                className="px-2.5 py-2"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid hsla(45,60%,50%,0.15)',
                  borderRadius: 'var(--corner-r-sm)',
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)] uppercase tracking-wide text-xs font-semibold">Qualifying</span>
                  <div className="flex items-center gap-2">
                    {qualifyingPosition && qualifyingPosition > 0 && (
                      <span className="font-bold text-amber-400" style={{ fontFamily: 'var(--ff-display)' }}>P{qualifyingPosition}</span>
                    )}
                    <span className="font-mono text-[var(--text-dim)]">{qualifyingLapStr}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spacer pushes sparkline + footer to bottom */}
        <div className="flex-grow" />

        {/* iRating sparkline */}
        {iRatingHistory.length > 1 && (
          <div className="mb-3">
            <IRatingSparkline values={iRatingHistory} />
          </div>
        )}

        {/* Footer: date / session label / race lap */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>
            {dateStr}
            {sessionLabel && (
              <span className="opacity-50"> · {sessionLabel}</span>
            )}
          </span>
          {lapStr !== '—' && (
            <span className="font-mono text-[var(--text-dim)]">{lapStr}</span>
          )}
        </div>

        {incidents > 0 && (
          <div className="mt-1 text-xs text-[var(--text-muted)]">{incidents}× incidents</div>
        )}
      </div>
    </Link>
  )
}
