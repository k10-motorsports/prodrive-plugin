'use client'

import { useMemo } from 'react'
import { Sun } from 'lucide-react'

interface RatingEntry {
  category: string
  iRating: number
}

interface SafetyEntry {
  category: string
  safetyRating: string
  license: string
}

interface RatingHistoryPoint {
  category: string
  iRating: number
  createdAt: string
}

interface WhenInsight {
  type: 'positive' | 'negative' | 'neutral'
  text: string
}

interface DataStripProps {
  displayName: string
  raceCount: number
  totalLaps: number
  iRatingByCategory: RatingEntry[]
  safetyRatingByCategory: SafetyEntry[]
  iRatingHistory: RatingHistoryPoint[]
  insights: WhenInsight[]
  careerSpan: string | null
  uniqueGames: number
  uniqueTracks: number
  uniqueCars: number
}

const CAT_LABEL: Record<string, string> = {
  road: 'Road',
  oval: 'Oval',
  dirt_road: 'Dirt Road',
  dirt_oval: 'Dirt Oval',
}

const CAT_COLOR: Record<string, string> = {
  road: '#e53935',
  oval: '#1e88e5',
  dirt_road: '#43a047',
  dirt_oval: '#ff9800',
  formula: '#00bcd4',
}

const LICENSE_COLOR: Record<string, string> = {
  A: 'hsl(210, 80%, 45%)',
  B: 'hsl(142, 50%, 45%)',
  C: 'hsl(45, 80%, 45%)',
  D: 'hsl(25, 80%, 45%)',
  R: 'hsl(0, 60%, 45%)',
}

function Separator() {
  return <div className="w-px self-stretch bg-[var(--border)] shrink-0" />
}

function Stat({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex flex-col items-left gap-0.5 px-3" style={{color: 'var(--text-secondary)'}}>
      <span className="text-xs uppercase tracking-wider leading-none" style={{color: 'var(--text-muted)'}}>{label}</span>
      <span
        className="text-xs font-bold leading-none"
        style={mono ? { fontFamily: 'var(--ff-mono)' } : undefined}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  )
}

/* ── Sparkline ──────────────────────────────────────────────────────────────── */

const SPARK_W = 100
const SPARK_H = 28
const SPARK_PAD = 2

function Sparkline({ points, color, label, current, sr }: {
  points: number[]
  color: string
  label: string
  current: number
  sr?: SafetyEntry
}) {
  const isSingle = points.length === 1
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  // Single point: flat line + dot at center
  const midY = SPARK_H / 2
  const pathD = isSingle
    ? `M${SPARK_PAD},${midY} L${SPARK_W - SPARK_PAD},${midY}`
    : points
        .map((v, i) => {
          const x = SPARK_PAD + (i / (points.length - 1)) * (SPARK_W - SPARK_PAD * 2)
          const y = SPARK_PAD + (1 - (v - min) / range) * (SPARK_H - SPARK_PAD * 2)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')

  // Gradient fill path (close to bottom)
  const fillD = isSingle
    ? `M${SPARK_PAD},${midY} L${SPARK_W - SPARK_PAD},${midY} L${SPARK_W - SPARK_PAD},${SPARK_H} L${SPARK_PAD},${SPARK_H} Z`
    : `${pathD} L${(SPARK_W - SPARK_PAD).toFixed(1)},${SPARK_H} L${SPARK_PAD},${SPARK_H} Z`

  return (
    <div className="flex items-center gap-2 px-3 shrink-0" style={{ width: SPARK_W + 100, color: 'var(--text-secondary)' }}>
      {/* Label + value */}
      <div className="flex flex-col gap-0.5 shrink-0 min-w-[70px]">
        <span className="text-xs uppercase tracking-wider leading-none"  style={{color: 'var(--text-muted)'}}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold leading-none" style={{ fontFamily: 'var(--ff-mono)' }}>
            {current.toLocaleString()}
          </span>
          {sr && (
            <span
              className="text-xs font-black leading-none px-1 py-0.5 rounded-sm"
              style={{ background: LICENSE_COLOR[sr.license] || LICENSE_COLOR.R, color: 'white' }}
            >
              {sr.license}{sr.safetyRating}
            </span>
          )}
        </div>
      </div>

      {/* SVG sparkline */}
      <svg
        width={SPARK_W}
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        className="shrink-0"
        style={{ opacity: 0.9 }}
      >
        <defs>
          <linearGradient id={`spark-fill-${sr?.category}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#spark-fill-${sr?.category})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {isSingle && <circle cx={SPARK_W / 2} cy={midY} r={3} fill={color} />}
      </svg>
    </div>
  )
}

/* ── DataStrip ──────────────────────────────────────────────────────────────── */

export default function DataStrip({
  displayName,
  raceCount,
  totalLaps,
  iRatingByCategory,
  safetyRatingByCategory,
  iRatingHistory,
  insights,
  careerSpan,
  uniqueGames,
  uniqueTracks,
  uniqueCars,
}: DataStripProps) {
  // Split history by category, chronological order
  const sparklineData = useMemo(() => {
    const byCategory = new Map<string, number[]>()
    // History comes in desc order — reverse for chronological
    for (let i = iRatingHistory.length - 1; i >= 0; i--) {
      const h = iRatingHistory[i]
      if (!byCategory.has(h.category)) byCategory.set(h.category, [])
      byCategory.get(h.category)!.push(h.iRating)
    }
    return byCategory
  }, [iRatingHistory])

  return (
    <div
      className="border-b"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-accent)',
      }}
    >
      <div className="max-w-[120rem] mx-auto px-6 flex items-center justify-start gap-0 py-1.5 overflow-x-auto">
        <Stat label="Races" value={raceCount} />
        <Separator />
        <Stat label="Laps" value={totalLaps} />

        {/* Sparklines per category (only those with history data) */}
        {iRatingByCategory.map((entry) => {
          const points = sparklineData.get(entry.category)
          if (!points || points.length < 1) return null
          const sr = safetyRatingByCategory.find(s => s.category === entry.category)
          return (
            <div key={entry.category} className="contents">
              <Separator />
              <Sparkline
                points={points}
                color={CAT_COLOR[entry.category] || '#888'}
                label={CAT_LABEL[entry.category] || entry.category}
                current={entry.iRating}
                sr={sr}
              />
            </div>
          )
        })}

        {(careerSpan || uniqueTracks > 0 || uniqueCars > 0 || uniqueGames > 1) && <Separator />}

        {careerSpan && <Stat label="Span" value={careerSpan} mono={false} />}
        {uniqueGames > 1 && (
          <>
            <Separator />
            <Stat label="Games" value={uniqueGames} />
          </>
        )}
        {uniqueTracks > 0 && (
          <>
            <Separator />
            <Stat label="Tracks" value={uniqueTracks} />
          </>
        )}
        {uniqueCars > 0 && (
          <>
            <Separator />
            <Stat label="Cars" value={uniqueCars} />
          </>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2 px-3 shrink-0 color">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <Sun
                    size={12}
                    style={{
                      color: insight.type === 'positive'
                        ? 'hsl(142, 50%, 45%)'
                        : insight.type === 'negative'
                          ? 'hsl(0, 60%, 45%)'
                          : 'hsl(0, 0%, 45%)',
                    }}
                  />
                  <span className="text-sm whitespace-nowrap">{insight.text}</span>
                  {i < insights.length - 1 && <span className=" mx-1">·</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
