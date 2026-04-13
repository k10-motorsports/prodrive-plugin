'use client'

import Link from 'next/link'
import { ArrowLeft, MapPin, Trophy, Shield, Gauge, Car, Flag } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SuggestionDetailClientProps {
  trackName: string
  trackDisplayName: string | null
  trackSvgPath: string | null
  trackLogoSvg: string | null
  trackImageUrl: string | null
  trackLocation: { country: string; flag: string; city: string } | null
  seriesName: string | null
  carClassNames: string[]
  trackData: {
    totalRaces: number
    totalLaps: number
    avgPosition: number | null
    bestPosition: number | null
    avgIncidents: number
    wins: number
    podiums: number
    mastery: {
      score: number
      tier: 'bronze' | 'silver' | 'gold' | 'diamond'
      trend: 'improving' | 'declining' | 'stable' | 'new'
    } | null
  }
  seriesData: {
    totalRaces: number
    avgPosition: number | null
    bestPosition: number | null
    avgIncidents: number
    wins: number
    podiums: number
    tracks: Array<{ name: string; count: number }>
  }
  carData: Array<{
    name: string
    totalRaces: number
    avgPosition: number | null
    bestPosition: number | null
    wins: number
    avgIncidents: number
  }>
  carBrandInfo: Array<{
    name: string
    logoSrc: string | null
    brandColor: string | null
    brandName: string | null
  }>
}

const TIER_CONFIG: Record<string, { color: string; label: string }> = {
  bronze: { color: '#cd7f32', label: 'Bronze' },
  silver: { color: '#c0c0c0', label: 'Silver' },
  gold: { color: '#ffd700', label: 'Gold' },
  diamond: { color: '#b9f2ff', label: 'Diamond' },
}

const TREND_LABEL: Record<string, string> = {
  improving: '↑ Improving',
  declining: '↓ Declining',
  stable: '→ Stable',
  new: '● New',
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums ${highlight ? 'text-[var(--border-accent)]' : 'text-[var(--text)]'}`}
        style={{ fontFamily: 'var(--ff-display)' }}
      >
        {value}
      </div>
    </div>
  )
}

function EmptyState({ entity }: { entity: string }) {
  return (
    <div className="text-center py-6 text-[var(--text-muted)] text-sm">
      No {entity} history yet — this will be your first time!
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SuggestionDetailClient(props: SuggestionDetailClientProps) {
  const {
    trackName, trackDisplayName, trackSvgPath, trackLogoSvg,
    trackImageUrl, trackLocation, seriesName, carClassNames,
    trackData, seriesData, carData, carBrandInfo,
  } = props

  const trackLabel = trackDisplayName || trackName
  const tier = trackData.mastery ? TIER_CONFIG[trackData.mastery.tier] : null

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[var(--bg-panel)]">
        {/* Background layers */}
        {trackImageUrl && (
          <img
            src={trackImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
        )}
        {trackSvgPath && (
          <div className="absolute inset-0 flex items-center justify-end pointer-events-none pr-8 lg:pr-16">
            <svg
              viewBox="0 0 100 100"
              className="w-[350px] h-[350px] lg:w-[450px] lg:h-[450px] opacity-30"
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
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-panel)] via-[var(--bg-panel)]/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--bg)] to-transparent pointer-events-none" />

        <div className="relative z-10 px-6 pt-4 pb-8 max-w-6xl mx-auto">
          <Link
            href="/drive/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Race Preview
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            {trackLogoSvg && (
              <img
                src={`data:image/svg+xml,${encodeURIComponent(trackLogoSvg)}`}
                alt=""
                className="w-8 h-8 flex-shrink-0"
              />
            )}
            <Link
              href={`/drive/track/${encodeURIComponent(trackName)}`}
              className="group"
            >
              <h1
                className="text-3xl lg:text-4xl font-black tracking-tight text-[var(--text)] group-hover:text-[var(--border-accent)] transition-colors"
                style={{ fontFamily: 'var(--ff-display)' }}
              >
                {trackLabel}
              </h1>
            </Link>
          </div>

          {trackLocation && (
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] mb-3">
              <MapPin size={14} />
              {trackLocation.city}, {trackLocation.country} {trackLocation.flag}
            </div>
          )}

          {seriesName && (
            <p className="text-base text-[var(--text-dim)] mb-3">{seriesName}</p>
          )}

          {/* Car brand chips */}
          {carBrandInfo.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {carBrandInfo.map(car => (
                <Link
                  key={car.name}
                  href={`/drive/car/${encodeURIComponent(car.name)}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded transition-colors hover:brightness-125"
                  style={{
                    background: car.brandColor ? `${car.brandColor}22` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${car.brandColor ? car.brandColor + '44' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {car.logoSrc && (
                    <img src={car.logoSrc} alt={car.brandName || ''} className="h-6 w-auto object-contain" />
                  )}
                  <span className="text-sm text-[var(--text-secondary)] font-medium">{car.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Track Experience */}
        <section
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
        >
          <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
              <MapPin size={16} className="text-[var(--border-accent)]" />
              Your Track Experience
            </h2>
            {tier && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ color: tier.color, background: `${tier.color}20`, border: `1px solid ${tier.color}40` }}
              >
                {tier.label} Mastery
              </span>
            )}
          </div>
          <div className="px-5 py-5">
            {trackData.totalRaces === 0 ? (
              <EmptyState entity="track" />
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-4">
                  <StatBox label="Races" value={String(trackData.totalRaces)} />
                  <StatBox label="Laps" value={String(trackData.totalLaps)} />
                  <StatBox label="Avg Pos" value={trackData.avgPosition ? `P${trackData.avgPosition.toFixed(1)}` : '—'} />
                  <StatBox label="Best" value={trackData.bestPosition ? `P${trackData.bestPosition}` : '—'} highlight />
                  <StatBox label="Wins" value={String(trackData.wins)} highlight={trackData.wins > 0} />
                  <StatBox label="Avg Inc" value={trackData.avgIncidents.toFixed(1)} />
                </div>
                {trackData.mastery && (
                  <div className="flex items-center gap-4 text-sm text-[var(--text-muted)] border-t border-[var(--border)] pt-3">
                    <span>Mastery Score: <strong style={{ color: tier?.color }}>{trackData.mastery.score}</strong></span>
                    <span>{TREND_LABEL[trackData.mastery.trend]}</span>
                  </div>
                )}
                <div className="mt-3">
                  <Link
                    href={`/drive/track/${encodeURIComponent(trackName)}`}
                    className="text-xs text-[var(--border-accent)] hover:underline"
                  >
                    View full track detail →
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Series Experience */}
        {seriesName && (
          <section
            className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
          >
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
                <Flag size={16} className="text-[var(--border-accent)]" />
                Your Series Experience — {seriesName}
              </h2>
            </div>
            <div className="px-5 py-5">
              {seriesData.totalRaces === 0 ? (
                <EmptyState entity="series" />
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-4">
                    <StatBox label="Races" value={String(seriesData.totalRaces)} />
                    <StatBox label="Avg Pos" value={seriesData.avgPosition ? `P${seriesData.avgPosition.toFixed(1)}` : '—'} />
                    <StatBox label="Best" value={seriesData.bestPosition ? `P${seriesData.bestPosition}` : '—'} highlight />
                    <StatBox label="Wins" value={String(seriesData.wins)} highlight={seriesData.wins > 0} />
                    <StatBox label="Podiums" value={String(seriesData.podiums)} />
                    <StatBox label="Avg Inc" value={seriesData.avgIncidents.toFixed(1)} />
                  </div>
                  {seriesData.tracks.length > 0 && (
                    <div className="border-t border-[var(--border)] pt-3">
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
                        Tracks raced in this series
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {seriesData.tracks.slice(0, 8).map(t => (
                          <Link
                            key={t.name}
                            href={`/drive/track/${encodeURIComponent(t.name)}`}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] transition-colors"
                          >
                            {t.name} <span className="text-[var(--text-muted)]">×{t.count}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Car Experience */}
        {carClassNames.length > 0 && (
          <section
            className="rounded-xl border overflow-hidden"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
          >
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
                <Car size={16} className="text-[var(--border-accent)]" />
                Your Car Experience
              </h2>
            </div>
            <div className="px-5 py-5 space-y-4">
              {carData.length === 0 || carData.every(c => c.totalRaces === 0) ? (
                <EmptyState entity="car" />
              ) : (
                carData.map((car, i) => {
                  const brand = carBrandInfo[i]
                  if (car.totalRaces === 0) return null
                  return (
                    <div
                      key={car.name}
                      className="rounded-lg border p-4"
                      style={{
                        borderColor: brand?.brandColor ? `${brand.brandColor}44` : 'var(--border)',
                        background: brand?.brandColor ? `${brand.brandColor}08` : 'var(--bg-panel)',
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {brand?.logoSrc && (
                          <img src={brand.logoSrc} alt="" className="h-8 w-auto object-contain" />
                        )}
                        <Link
                          href={`/drive/car/${encodeURIComponent(car.name)}`}
                          className="text-base font-bold text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                        >
                          {car.name}
                        </Link>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        <StatBox label="Races" value={String(car.totalRaces)} />
                        <StatBox label="Avg Pos" value={car.avgPosition ? `P${car.avgPosition.toFixed(1)}` : '—'} />
                        <StatBox label="Best" value={car.bestPosition ? `P${car.bestPosition}` : '—'} highlight />
                        <StatBox label="Wins" value={String(car.wins)} highlight={car.wins > 0} />
                        <StatBox label="Avg Inc" value={car.avgIncidents.toFixed(1)} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
