'use client'

import { ArrowLeft, Clock, Flag, MapPin } from 'lucide-react'
import Link from 'next/link'

interface RaceDetailHeroProps {
  trackName: string
  trackDisplayName: string | null
  carModel: string
  finishPosition: number | null
  fieldSize: number | null
  sessionType: string
  date: string
  gameName: string
  incidentCount: number
  bestLapTime: number | null
  completedLaps: number
  trackSvgPath: string | null
  trackImageUrl: string | null
  carImageUrl: string | null
  trackLogoSvg: string | null
  brandLogoSrc: string | null
  brandColor: string | null
  brandName: string | null
  trackLocation: { country: string; flag: string; city: string } | null
  overallVerdict: 'excellent' | 'good' | 'mixed' | 'tough' | 'learning'
  headline: string
  subheadline: string
  irDelta: number | null
  srDelta: number | null
  qualifyingPosition: number | null
  qualifyingBestLap: number | null
}

const verdictConfig = {
  excellent: { glow: 'hsl(45,90%,50%)', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  good:      { glow: 'hsl(142,60%,50%)', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  mixed:     { glow: 'hsl(213,80%,50%)', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  tough:     { glow: 'hsl(0,80%,50%)', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  learning:  { glow: 'hsl(270,60%,55%)', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
}

function formatLapTime(t: number | null): string {
  if (!t || t <= 0) return '—'
  const m = Math.floor(t / 60)
  const sec = t - m * 60
  return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(3)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function RaceDetailHero(props: RaceDetailHeroProps) {
  const {
    trackName, trackDisplayName, carModel, finishPosition, fieldSize,
    sessionType, date, gameName, incidentCount, bestLapTime, completedLaps,
    trackSvgPath, trackImageUrl, carImageUrl, trackLogoSvg,
    brandLogoSrc, brandColor, brandName, trackLocation,
    overallVerdict, headline, subheadline, irDelta, srDelta,
    qualifyingPosition, qualifyingBestLap,
  } = props

  const pos = finishPosition
  const isDNF = !pos || pos === 0
  const isPractice = (sessionType || '').toLowerCase().includes('practice')
  const verdict = verdictConfig[overallVerdict]

  // Position badge colors
  let posColor = 'var(--text-dim)'
  if (!isPractice) {
    if (isDNF)          posColor = 'hsl(270,60%,72%)'
    else if (pos === 1) posColor = 'hsl(45,90%,62%)'
    else if (pos === 2) posColor = 'hsl(0,0%,78%)'
    else if (pos === 3) posColor = 'hsl(30,65%,58%)'
    else if (pos && pos <= 10) posColor = 'hsl(142,60%,58%)'
  }

  const trackLabel = trackDisplayName || trackName || 'Unknown Track'

  const dateStr = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const timeStr = new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="relative overflow-hidden bg-[var(--bg-panel)]">
      {/* ── Layered Background ─────────────────────────────────────────── */}

      {/* Layer 1: Track photo */}
      {trackImageUrl && (
        <img
          src={trackImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
        />
      )}

      {/* Layer 2: Car photo fallback */}
      {!trackImageUrl && carImageUrl && (
        <img
          src={carImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
        />
      )}

      {/* Layer 3: Track SVG — large, prominent */}
      {trackSvgPath && (
        <div className="absolute inset-0 flex items-center justify-end pointer-events-none pr-8 lg:pr-16">
          <svg
            viewBox="0 0 100 100"
            className="w-[400px] h-[400px] lg:w-[520px] lg:h-[520px] opacity-40"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Outer glow */}
            <path
              d={trackSvgPath}
              fill="none"
              stroke={brandColor || 'var(--border-accent)'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.15"
            />
            {/* Main stroke */}
            <path
              d={trackSvgPath}
              fill="none"
              stroke={brandColor || 'var(--border-accent)'}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Layer 4: Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-panel)] via-[var(--bg-panel)]/80 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg)] to-transparent pointer-events-none" />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 pt-4 pb-8 max-w-6xl mx-auto">
        {/* Back link */}
        <Link
          href="/drive/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          {/* Left: Race identity */}
          <div className="flex-1 min-w-0">
            {/* Game + Session type chips */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {gameName}
              </span>
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {(sessionType || '').replace(/([a-z])([A-Z])/g, '$1 $2')}
              </span>
            </div>

            {/* Track name + logo (links to track detail) */}
            <Link
              href={`/drive/track/${encodeURIComponent(trackName)}`}
              className="flex items-center gap-3 mb-1 group"
            >
              {trackLogoSvg && (
                <img
                  src={`data:image/svg+xml,${encodeURIComponent(trackLogoSvg)}`}
                  alt=""
                  className="w-8 h-8 flex-shrink-0"
                />
              )}
              <h1
                className="text-3xl lg:text-4xl font-black tracking-tight text-[var(--text)] group-hover:text-[var(--border-accent)] transition-colors"
                style={{ fontFamily: 'var(--ff-display)' }}
              >
                {trackLabel}
              </h1>
            </Link>

            {/* Location + date row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)] mt-2">
              {trackLocation && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {trackLocation.city}, {trackLocation.country} {trackLocation.flag}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {dateStr} at {timeStr}
              </span>
            </div>

            {/* Car + brand */}
            <div className="flex items-center gap-2 mt-3">
              {brandLogoSrc && (
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded"
                  style={{
                    background: brandColor ? `${brandColor}22` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${brandColor ? brandColor + '44' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <img src={brandLogoSrc} alt={brandName || ''} className="h-6 w-auto object-contain" />
                </div>
              )}
              <Link href={`/drive/car/${encodeURIComponent(carModel)}`} className="text-sm text-[var(--text-secondary)] font-medium hover:text-[var(--text)] transition-colors">
                {carModel}
              </Link>
            </div>

            {/* Qualifying context */}
            {(qualifyingPosition || qualifyingBestLap) && (
              <div
                className="mt-3 inline-flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{
                  background: 'hsla(45,60%,50%,0.08)',
                  border: '1px solid hsla(45,60%,50%,0.2)',
                }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/70">Qualifying</span>
                {qualifyingPosition && qualifyingPosition > 0 && (
                  <span className="text-sm font-bold text-amber-300" style={{ fontFamily: 'var(--ff-display)' }}>
                    P{qualifyingPosition}
                  </span>
                )}
                {qualifyingBestLap && qualifyingBestLap > 0 && (
                  <span className="text-sm font-mono text-[var(--text-dim)]">
                    {formatLapTime(qualifyingBestLap)}
                  </span>
                )}
                {qualifyingPosition && finishPosition && finishPosition > 0 && qualifyingPosition > 0 && (
                  <span className={`text-xs font-semibold ${finishPosition < qualifyingPosition ? 'text-emerald-400' : finishPosition > qualifyingPosition ? 'text-rose-400' : 'text-[var(--text-muted)]'}`}>
                    {finishPosition < qualifyingPosition
                      ? `+${qualifyingPosition - finishPosition} places gained`
                      : finishPosition > qualifyingPosition
                        ? `${finishPosition - qualifyingPosition} places lost`
                        : 'held position'}
                  </span>
                )}
              </div>
            )}

            {/* Headline summary */}
            <div className="mt-5">
              <h2
                className="text-xl font-bold text-[var(--text)]"
                style={{ fontFamily: 'var(--ff-display)' }}
              >
                {headline}
              </h2>
              <p className="text-sm text-[var(--text-dim)] mt-1 max-w-xl">{subheadline}</p>
            </div>
          </div>

          {/* Right: Position badge + key stats */}
          <div className="flex flex-col items-end gap-4 flex-shrink-0">
            {/* Position badge */}
            {!isPractice && (
              <div className="flex flex-col items-end" style={{ color: posColor }}>
                {isDNF ? (
                  <span className="text-4xl font-black" style={{ fontFamily: 'var(--ff-display)' }}>DNF</span>
                ) : (
                  <div className="flex items-end">
                    <span className="text-xl font-bold mr-1 mb-1 opacity-70" style={{ fontFamily: 'var(--ff-display)' }}>P</span>
                    <span className="text-7xl lg:text-8xl font-black leading-none tracking-tight" style={{ fontFamily: 'var(--ff-display)' }}>{pos}</span>
                  </div>
                )}
                {fieldSize && !isDNF && (
                  <span className="text-sm font-semibold mt-1 opacity-60">of {fieldSize}</span>
                )}
              </div>
            )}

            {/* Stat chips row */}
            <div className="flex items-center gap-3">
              {bestLapTime && bestLapTime > 0 && (
                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Best Lap</div>
                  <div className="text-lg font-bold text-[var(--text)] tabular-nums" style={{ fontFamily: 'var(--ff-mono)' }}>
                    {formatLapTime(bestLapTime)}
                  </div>
                </div>
              )}
              <div className="text-right">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Laps</div>
                <div className="text-lg font-bold text-[var(--text)]">{completedLaps}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Incidents</div>
                <div className={`text-lg font-bold ${incidentCount === 0 ? 'text-emerald-400' : incidentCount >= 6 ? 'text-rose-400' : 'text-[var(--text)]'}`}>
                  {incidentCount}x
                </div>
              </div>
              {irDelta !== null && !isPractice && (
                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">iRating</div>
                  <div className={`text-lg font-bold ${irDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {irDelta >= 0 ? '+' : ''}{irDelta}
                  </div>
                </div>
              )}
              {srDelta !== null && !isPractice && (
                <div className="text-right">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">SR</div>
                  <div className={`text-lg font-bold ${srDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {srDelta >= 0 ? '+' : ''}{srDelta.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
