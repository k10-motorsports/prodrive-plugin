'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, Target, AlertTriangle, Flame, Shield, Zap, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { resolveIRacingTrackId } from '@/data/iracing-track-map'
import { useElectron } from '@/hooks/useElectron'

// ── Types ─────────────────────────────────────────────────────────────────────

export type StrategyType = 'pitlane' | 'conservative' | 'careful' | 'form' | 'steady'

export interface RaceSuggestion {
  seriesName: string
  trackName: string
  trackConfig?: string
  license: string
  official: boolean
  fixed: boolean
  score: number
  strategy: StrategyType
  commentary: string
  startsAtUtc: string
  carClassNames?: string[]
  seasonId?: number
  seriesId?: number
}

export interface BrandInfo {
  logoSvg: string | null
  logoPng: string | null
  brandColorHex: string | null
  manufacturerName: string
}

export interface RaceLookups {
  trackMapLookup: Record<string, string>
  trackLogoLookup: Record<string, string>
  trackImageLookup: Record<string, string | null>
  trackDisplayNameLookup: Record<string, string>
  carImageLookup: Record<string, string | null>
  brandLogoLookup: Record<string, BrandInfo>
}

interface NextRaceIdeasProps {
  suggestions: RaceSuggestion[]
  lookups: RaceLookups
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCORE_COLOR: Record<string, string> = {
  high: '#43a047',
  lime: '#7cb342',
  amber: '#ffb300',
  orange: '#ff7043',
}

function getScoreColor(score: number): string {
  if (score >= 80) return SCORE_COLOR.high
  if (score >= 60) return SCORE_COLOR.lime
  if (score >= 40) return SCORE_COLOR.amber
  return SCORE_COLOR.orange
}

const STRATEGY_COLOR: Record<StrategyType, string> = {
  pitlane: '#e53935',
  conservative: '#ffb300',
  careful: '#ff9800',
  form: '#43a047',
  steady: '#78909c',
}

const STRATEGY_ICON: Record<StrategyType, React.ReactNode> = {
  pitlane: <Shield size={14} />,
  conservative: <Target size={14} />,
  careful: <AlertTriangle size={14} />,
  form: <Flame size={14} />,
  steady: <Zap size={14} />,
}

const STRATEGY_LABEL: Record<StrategyType, string> = {
  pitlane: 'Pitlane',
  conservative: 'Conservative',
  careful: 'Careful',
  form: 'On Form',
  steady: 'Steady',
}

// ── Time formatting ───────────────────────────────────────────────────────────

function formatTimeUntilStart(startsAtUtc: string): string {
  const now = Date.now()
  const startTime = new Date(startsAtUtc).getTime()
  const diffMs = startTime - now

  if (diffMs <= 0) return 'Started'

  const totalMinutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Resolve an iRacing track name to all possible lookup keys.
 * Tries: lowercased original name, then resolved Pro Drive trackId.
 */
function trackKeys(trackName: string, configName?: string): string[] {
  const keys = [trackName.toLowerCase()]
  const resolved = resolveIRacingTrackId(trackName, configName)
  if (resolved && resolved !== trackName.toLowerCase()) {
    keys.push(resolved)
  }
  return keys
}

function lookupTrackMap(lookups: RaceLookups, trackName: string, trackConfig?: string): string | null {
  for (const key of trackKeys(trackName, trackConfig ?? undefined)) {
    if (lookups.trackMapLookup[key]) return lookups.trackMapLookup[key]
  }
  return null
}

function lookupTrackLogo(lookups: RaceLookups, trackName: string, trackConfig?: string): string | null {
  for (const key of trackKeys(trackName, trackConfig ?? undefined)) {
    if (lookups.trackLogoLookup[key]) return lookups.trackLogoLookup[key]
  }
  return null
}

function lookupTrackDisplayName(lookups: RaceLookups, trackName: string, trackConfig?: string): string | null {
  for (const key of trackKeys(trackName, trackConfig ?? undefined)) {
    if (lookups.trackDisplayNameLookup[key]) return lookups.trackDisplayNameLookup[key]
  }
  return null
}

function lookupTrackImage(lookups: RaceLookups, trackName: string, trackConfig?: string): string | null {
  // Try exact name first (both cased and lowered), then resolved trackId
  if (lookups.trackImageLookup[trackName]) return lookups.trackImageLookup[trackName]
  for (const key of trackKeys(trackName, trackConfig ?? undefined)) {
    if (lookups.trackImageLookup[key]) return lookups.trackImageLookup[key]
  }
  return null
}

function lookupCarImage(lookups: RaceLookups, carClassNames: string[]): string | null {
  for (const name of carClassNames) {
    const img = lookups.carImageLookup[name]
    if (img) return img
  }
  return null
}

function lookupBrand(lookups: RaceLookups, carClassNames: string[]): BrandInfo | null {
  for (const name of carClassNames) {
    const brand = lookups.brandLogoLookup[name]
    if (brand) return brand
  }
  return null
}

function lookupAllBrands(lookups: RaceLookups, carClassNames: string[]): BrandInfo[] {
  const brands: BrandInfo[] = []
  const seen = new Set<string>()
  for (const name of carClassNames) {
    const brand = lookups.brandLogoLookup[name]
    if (brand && !seen.has(brand.manufacturerName)) {
      seen.add(brand.manufacturerName)
      brands.push(brand)
    }
  }
  return brands
}

// ── Hero Card ─────────────────────────────────────────────────────────────────

function HeroRaceCard({
  suggestion,
  lookups,
  showRegister,
}: {
  suggestion: RaceSuggestion
  lookups: RaceLookups
  showRegister: boolean
}) {
  const accentColor = getScoreColor(suggestion.score)
  const strategyColor = STRATEGY_COLOR[suggestion.strategy]
  const strategyIcon = STRATEGY_ICON[suggestion.strategy]
  const strategyLabel = STRATEGY_LABEL[suggestion.strategy]
  const timeUntilStart = formatTimeUntilStart(suggestion.startsAtUtc)
  const carClassNames = suggestion.carClassNames ?? []

  const trackSvgPath = lookupTrackMap(lookups, suggestion.trackName, suggestion.trackConfig)
  const trackLogoSvg = lookupTrackLogo(lookups, suggestion.trackName, suggestion.trackConfig)
  const trackDisplayName = lookupTrackDisplayName(lookups, suggestion.trackName, suggestion.trackConfig)
  const trackImage = lookupTrackImage(lookups, suggestion.trackName, suggestion.trackConfig)
  const carImage = lookupCarImage(lookups, carClassNames)
  const allBrands = lookupAllBrands(lookups, carClassNames)
  // Primary brand for accent color fallback
  const brandInfo = allBrands[0] ?? null
  const brandColor = brandInfo?.brandColorHex || null

  const trackDisplay = suggestion.trackConfig
    ? `${trackDisplayName || suggestion.trackName} — ${suggestion.trackConfig}`
    : (trackDisplayName || suggestion.trackName)

  const suggestionHref = `/drive/suggestion?track=${encodeURIComponent(suggestion.trackName)}${suggestion.seriesName ? `&series=${encodeURIComponent(suggestion.seriesName)}` : ''}${carClassNames.length > 0 ? `&cars=${encodeURIComponent(carClassNames.join(','))}` : ''}`

  return (
    <Link
      href={suggestionHref}
      className="relative rounded-lg overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--border-accent)] transition-colors flex flex-col cursor-pointer"
    >
      {/* ── Hero image area ─ same layered pattern as RaceCard ─────────── */}
      <div className="relative h-48 bg-[var(--bg-panel)] overflow-hidden flex-shrink-0">

        {/* Layer 1: track photo background */}
        {trackImage && (
          <img
            src={trackImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
          />
        )}

        {/* Layer 2: car photo fallback if no track image */}
        {!trackImage && carImage && (
          <img
            src={carImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
        )}

        {/* Layer 3: track SVG outline — centered, colored by brand accent */}
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
                stroke="var(--border-accent)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Layer 4: bottom gradient for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none card-header-gradient" />

        {/* Time chip — top left */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5"
          style={{
            background: `${accentColor}cc`,
            borderRadius: 'var(--corner-r-sm)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Clock size={14} color="#fff" />
          <span className="text-sm font-bold leading-none text-white tracking-wide">
            {timeUntilStart}
          </span>
        </div>

        {/* Score chip — top right */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)' }}
        >
          <span className="text-xs font-medium leading-none text-white/60">Match</span>
          <span className="text-sm font-bold leading-none" style={{ color: accentColor }}>
            {suggestion.score}
          </span>
        </div>

        {/* Brand chips — bottom left, one per car class brand */}
        {allBrands.length > 0 && (
          <div className="absolute bottom-0 left-0 m-3 flex items-center gap-1.5">
            {allBrands.map((brand) => {
              const color = brand.brandColorHex
              const src = brand.logoSvg
                ? `data:image/svg+xml,${encodeURIComponent(brand.logoSvg)}`
                : brand.logoPng
                  ? `data:image/png;base64,${brand.logoPng}`
                  : null
              return (
                <div
                  key={brand.manufacturerName}
                  className="brand-chip flex items-center gap-1.5 px-2 py-1.5"
                  style={{
                    background: color ? `${color}55` : 'rgba(0,0,0,0.55)',
                    border: `1px solid ${color ? `${color}99` : 'var(--border)'}`,
                    backdropFilter: 'blur(6px)',
                    borderRadius: 'var(--corner-r-sm)',
                  } as React.CSSProperties}
                >
                  {src ? (
                    <img src={src} alt={brand.manufacturerName} className="h-8 w-auto object-contain flex-shrink-0" />
                  ) : color ? (
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {/* Car image — bottom right, clipped */}
        {carImage && trackImage && (
          <div className="absolute bottom-2 right-3 pointer-events-none">
            <img
              src={carImage}
              alt=""
              className="h-14 w-auto object-contain opacity-70 drop-shadow-lg"
            />
          </div>
        )}
      </div>

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div className="p-5 flex flex-col gap-3">

        {/* Track name + logo */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0 mb-1">
              {trackLogoSvg && (
                <img
                  src={`data:image/svg+xml,${encodeURIComponent(trackLogoSvg)}`}
                  alt=""
                  className="w-5 h-5 flex-shrink-0"
                />
              )}
              <h3 className="text-xl font-bold text-[var(--text)] truncate leading-tight" style={{ fontFamily: 'var(--ff-display)' }}>
                {trackDisplay}
              </h3>
            </div>
            <p className="text-base text-[var(--text-dim)] truncate">
              {suggestion.seriesName}
            </p>
          </div>
        </div>

        {/* Meta row: license + tags + car classes */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm px-2 py-0.5 rounded leading-none font-semibold"
            style={{ color: '#fff', background: accentColor, opacity: 0.8 }}
          >
            {suggestion.license}
          </span>
          {suggestion.official && (
            <span
              className="text-sm px-2 py-0.5 rounded leading-none"
              style={{ color: '#fff', background: accentColor, opacity: 0.6 }}
            >
              Official
            </span>
          )}
          {suggestion.fixed && (
            <span
              className="text-sm px-2 py-0.5 rounded leading-none"
              style={{ color: '#fff', background: accentColor, opacity: 0.6 }}
            >
              Fixed
            </span>
          )}
          {carClassNames.length > 0 && (
            <span className="text-sm text-[var(--text-muted)] leading-none ml-auto">
              {carClassNames.join(' · ')}
            </span>
          )}
        </div>

        {/* Strategy + commentary */}
        <div className="flex items-start gap-2.5">
          <div
            className="flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-full leading-none shrink-0"
            style={{ color: '#fff', background: strategyColor }}
          >
            {strategyIcon}
            {strategyLabel}
          </div>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2">
            {suggestion.commentary}
          </p>
        </div>

        {/* Register & Join — only in Electron on Windows */}
        {showRegister && suggestion.seasonId && (
          <a
            href={`https://members.iracing.com/membersite/member/SeriesSchedule.do?season=${suggestion.seasonId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110"
            style={{
              background: accentColor,
              color: '#fff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
            Register &amp; Join
          </a>
        )}
      </div>
    </Link>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default function NextRaceIdeas({ suggestions, lookups }: NextRaceIdeasProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const { isElectron, isWindows } = useElectron()
  const showRegister = isElectron && isWindows

  if (suggestions.length === 0) return null

  const current = suggestions[activeIndex]
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < suggestions.length - 1

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-[var(--text-secondary)]" />
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]" style={{ fontFamily: 'var(--ff-display)' }}>
          Next Race Ideas
        </h3>
      </div>

      {/* Hero card */}
      <HeroRaceCard suggestion={current} lookups={lookups} showRegister={showRegister} />

      {/* Pagination controls */}
      {suggestions.length > 1 && (
        <div className="flex items-center justify-between">
          {/* Page dots */}
          <div className="flex items-center gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={`${s.seriesName}-${s.trackName}-${i}`}
                onClick={() => setActiveIndex(i)}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === activeIndex ? 20 : 6,
                  height: 6,
                  background: i === activeIndex
                    ? getScoreColor(s.score)
                    : 'var(--border)',
                }}
                aria-label={`Show race ${i + 1}: ${s.seriesName}`}
              />
            ))}
          </div>

          {/* Prev / Next arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
              disabled={!hasPrev}
              className="p-1 rounded-md transition-colors"
              style={{
                color: hasPrev ? 'var(--text-secondary)' : 'var(--text-muted)',
                opacity: hasPrev ? 1 : 0.4,
                background: hasPrev ? 'var(--bg-elevated)' : 'transparent',
              }}
              aria-label="Previous suggestion"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[var(--text-muted)] tabular-nums px-1">
              {activeIndex + 1}/{suggestions.length}
            </span>
            <button
              onClick={() => setActiveIndex(i => Math.min(suggestions.length - 1, i + 1))}
              disabled={!hasNext}
              className="p-1 rounded-md transition-colors"
              style={{
                color: hasNext ? 'var(--text-secondary)' : 'var(--text-muted)',
                opacity: hasNext ? 1 : 0.4,
                background: hasNext ? 'var(--bg-elevated)' : 'transparent',
              }}
              aria-label="Next suggestion"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
