'use client'

import {
  Trophy, Medal, TrendingUp, TrendingDown, ChevronUp, Target, AlertTriangle,
  Shield, ShieldCheck, ShieldAlert, ShieldPlus, Activity, Sparkles, Swords,
  MapPinOff, RotateCcw, Heart, Flame, FastForward, Battery, Star, MapPin, Zap,
} from 'lucide-react'
import type { SummaryPoint, TrackContextReport, RatingImpactReport, ComposureReport } from '@/lib/race-summary'

// ── Icon Resolver ───────────────────────────────────────────────────────────────

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Trophy, Medal, TrendingUp, TrendingDown, ChevronUp, Target, AlertTriangle,
  Shield, ShieldCheck, ShieldAlert, ShieldPlus, Activity, Sparkles, Swords,
  MapPinOff, RotateCcw, Heart, Flame, FastForward, Battery, Star, MapPin, Zap,
}

function SummaryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name]
  if (!Icon) return null
  return <Icon size={18} className={className} />
}

// ── Strengths / Improvements Cards ──────────────────────────────────────────────

function PointCard({ point, variant }: { point: SummaryPoint; variant: 'strength' | 'improvement' }) {
  const isStrength = variant === 'strength'
  return (
    <div
      className="flex gap-3 p-4 rounded-lg border"
      style={{
        background: isStrength ? 'hsla(142,50%,50%,0.06)' : 'hsla(0,60%,50%,0.06)',
        borderColor: isStrength ? 'hsla(142,50%,50%,0.15)' : 'hsla(0,60%,50%,0.15)',
      }}
    >
      <div className="flex-shrink-0 mt-0.5">
        <SummaryIcon name={point.icon} className={isStrength ? 'text-emerald-400' : 'text-rose-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-[var(--text)]">{point.title}</span>
          {point.metric && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded"
              style={{
                background: isStrength ? 'hsla(142,50%,50%,0.15)' : 'hsla(0,60%,50%,0.15)',
                color: isStrength ? 'hsl(142,60%,60%)' : 'hsl(0,70%,65%)',
              }}
            >
              {point.metric}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-dim)] leading-relaxed">{point.detail}</p>
      </div>
    </div>
  )
}

// ── Track Context Section ───────────────────────────────────────────────────────

function TrackContextSection({ ctx }: { ctx: TrackContextReport }) {
  const trendLabels = {
    improving: { text: 'Improving', color: 'text-emerald-400' },
    declining: { text: 'Declining', color: 'text-rose-400' },
    stable: { text: 'Stable', color: 'text-blue-400' },
    first_time: { text: 'First Visit', color: 'text-purple-400' },
  }
  const trendInfo = trendLabels[ctx.positionTrend]

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Track History</h3>
      </div>

      <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-4">{ctx.narrativeLine}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-panel)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">Races Here</div>
          <div className="text-xl font-bold text-[var(--text)]">{ctx.trackRaceCount}</div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">Best Position</div>
          <div className="text-xl font-bold text-[var(--text)]">
            {ctx.historicalBestPosition ? `P${ctx.historicalBestPosition}` : '—'}
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">Avg Position</div>
          <div className="text-xl font-bold text-[var(--text)]">
            {ctx.historicalAvgPosition ? `P${ctx.historicalAvgPosition.toFixed(1)}` : '—'}
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">Trend</div>
          <div className={`text-lg font-bold ${trendInfo.color}`}>{trendInfo.text}</div>
        </div>
      </div>

      {ctx.isPersonalBest && (
        <div
          className="mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{ background: 'hsla(45,90%,50%,0.1)', border: '1px solid hsla(45,90%,50%,0.25)' }}
        >
          <Star size={16} className="text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-300">New personal best at this track!</span>
        </div>
      )}
    </div>
  )
}

// ── Composure Section ───────────────────────────────────────────────────────────

function ComposureSection({ report }: { report: ComposureReport }) {
  const rageColor = report.avgRage < 15 ? 'text-emerald-400' : report.avgRage < 30 ? 'text-blue-400' : report.avgRage < 50 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Composure</h3>
      </div>

      <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-4">{report.verdict}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-panel)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">Avg Rage</div>
          <div className={`text-xl font-bold ${rageColor}`}>{report.avgRage.toFixed(1)}</div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1">Peak Rage</div>
          <div className="text-xl font-bold text-rose-400">{report.peakRage.toFixed(1)}</div>
          {report.peakLap !== null && (
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Lap {report.peakLap}</div>
          )}
        </div>
        {report.calmestStretch && (
          <div className="bg-[var(--bg-panel)] rounded p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Calmest Stretch</div>
            <div className="text-xl font-bold text-emerald-400">
              L{report.calmestStretch.from}–{report.calmestStretch.to}
            </div>
          </div>
        )}
        {report.rageTrigger && (
          <div className="bg-[var(--bg-panel)] rounded p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Main Trigger</div>
            <div className="text-sm font-bold text-amber-400">{report.rageTrigger}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Rating Impact Section ───────────────────────────────────────────────────────

function RatingImpactSection({ impact }: { impact: RatingImpactReport }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Rating Impact</h3>
      </div>

      <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-4">{impact.narrative}</p>

      <div className="flex items-center gap-6">
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">iRating</div>
          <div className={`text-2xl font-black ${impact.irDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} style={{ fontFamily: 'var(--ff-display)' }}>
            {impact.irDelta >= 0 ? '+' : ''}{impact.irDelta}
          </div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1">Safety Rating</div>
          <div className={`text-2xl font-black ${impact.srDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} style={{ fontFamily: 'var(--ff-display)' }}>
            {impact.srDelta >= 0 ? '+' : ''}{impact.srDelta.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────────

export default function RaceSummaryPanel({
  strengths,
  improvements,
  trackContext,
  composureReport,
  ratingImpact,
}: {
  strengths: SummaryPoint[]
  improvements: SummaryPoint[]
  trackContext: TrackContextReport | null
  composureReport: ComposureReport | null
  ratingImpact: RatingImpactReport | null
}) {
  return (
    <div className="space-y-6">
      {/* Rating Impact */}
      {ratingImpact && <RatingImpactSection impact={ratingImpact} />}

      {/* Strengths & Improvements — two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* What Went Well */}
        <div>
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            What Went Well
          </h3>
          {strengths.length > 0 ? (
            <div className="space-y-3">
              {strengths.map((s, i) => (
                <PointCard key={i} point={s} variant="strength" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">No standout strengths detected — keep racing to build your data.</p>
          )}
        </div>

        {/* Areas to Improve */}
        <div>
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Target size={16} />
            Areas to Improve
          </h3>
          {improvements.length > 0 ? (
            <div className="space-y-3">
              {improvements.map((s, i) => (
                <PointCard key={i} point={s} variant="improvement" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">Nothing flagged — a clean, strong performance.</p>
          )}
        </div>
      </div>

      {/* Track Context */}
      {trackContext && <TrackContextSection ctx={trackContext} />}

      {/* Composure */}
      {composureReport && <ComposureSection report={composureReport} />}
    </div>
  )
}
