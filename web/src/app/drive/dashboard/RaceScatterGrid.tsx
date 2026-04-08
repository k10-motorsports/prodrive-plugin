'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type HeatMetric = 'races' | 'safetyRatingChange' | 'iRatingChange' | 'incidents'

export type SessionDataPoint = {
  date: string
  iRatingDelta: number
  srDelta: number
  incidents: number
}

type Props = {
  sessions: SessionDataPoint[]
}

type Bucket = {
  day: number        // 0=Sun ... 6=Sat
  hour: number       // 0–23
  count: number
  irDelta: number
  srDelta: number
  incidents: number
}

// ── Constants ────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<HeatMetric, string> = {
  races: 'Races',
  safetyRatingChange: 'Safety Rating Change',
  iRatingChange: 'iRating Change',
  incidents: 'Incidents',
}

// Display order: Mon–Sun
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TIME_LABELS = [
  { hour: 0, label: '12 AM' },
  { hour: 3, label: '3 AM' },
  { hour: 6, label: '6 AM' },
  { hour: 9, label: '9 AM' },
  { hour: 12, label: '12 PM' },
  { hour: 15, label: '3 PM' },
  { hour: 18, label: '6 PM' },
  { hour: 21, label: '9 PM' },
]

// SVG dimensions
const MARGIN = { top: 28, right: 12, bottom: 24, left: 44 }
const COL_W = 56
const ROW_H = 18
const CHART_W = 7 * COL_W
const CHART_H = 24 * ROW_H
const SVG_W = MARGIN.left + CHART_W + MARGIN.right
const SVG_H = MARGIN.top + CHART_H + MARGIN.bottom

const MIN_R = 4
const MAX_R = 18

// ── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbStr(r: number, g: number, b: number) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

function interpolateColor(from: [number, number, number], to: [number, number, number], t: number): string {
  return rgbStr(lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t))
}

function resolveVar(el: HTMLElement, varName: string, fallback: string): string {
  const val = getComputedStyle(el).getPropertyValue(varName).trim()
  return val || fallback
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RaceScatterGrid({ sessions }: Props) {
  const [metric, setMetric] = useState<HeatMetric>('safetyRatingChange')
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  // Resolve theme colors
  const [colors, setColors] = useState({
    low: [112, 0, 16] as [number, number, number],
    mid: [176, 32, 32] as [number, number, number],
    high: [229, 57, 53] as [number, number, number],
    green: [67, 160, 71] as [number, number, number],
    neutral: [160, 160, 180] as [number, number, number],
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const parse = (v: string): [number, number, number] => {
      if (v.startsWith('#')) return hexToRgb(v)
      if (v.startsWith('rgb')) {
        const m = v.match(/[\d.]+/g)
        if (m && m.length >= 3) return [+m[0], +m[1], +m[2]]
      }
      return [160, 160, 180]
    }
    setColors({
      low: parse(resolveVar(el, '--k10-red-dark', '#700010')),
      mid: parse(resolveVar(el, '--k10-red-mid', '#b02020')),
      high: parse(resolveVar(el, '--k10-red', '#e53935')),
      green: parse(resolveVar(el, '--green', '#43a047')),
      neutral: parse(resolveVar(el, '--text-muted', 'rgba(255,255,255,0.45)')),
    })
  }, [])

  // Bucket sessions by (dayOfWeek, hour)
  const buckets = useMemo(() => {
    const map = new Map<string, Bucket>()
    for (const s of sessions) {
      const d = new Date(s.date)
      const day = d.getDay()
      const hour = d.getHours()
      const k = `${day}-${hour}`
      const existing = map.get(k)
      if (existing) {
        existing.count++
        existing.irDelta += s.iRatingDelta
        existing.srDelta += s.srDelta
        existing.incidents += s.incidents
      } else {
        map.set(k, { day, hour, count: 1, irDelta: s.iRatingDelta, srDelta: s.srDelta, incidents: s.incidents })
      }
    }
    return Array.from(map.values())
  }, [sessions])

  // Max count for radius scaling
  const maxCount = useMemo(() => Math.max(1, ...buckets.map(b => b.count)), [buckets])

  // Metric value + range
  const { getVal, minMetric, maxMetric, isDivergent } = useMemo(() => {
    const gv = (b: Bucket): number => {
      switch (metric) {
        case 'races': return b.count
        case 'iRatingChange': return b.count > 0 ? b.irDelta / b.count : 0
        case 'safetyRatingChange': return b.count > 0 ? b.srDelta / b.count : 0
        case 'incidents': return b.count > 0 ? b.incidents / b.count : 0
      }
    }
    let min = Infinity, max = -Infinity
    for (const b of buckets) {
      const v = gv(b)
      if (v < min) min = v
      if (v > max) max = v
    }
    if (min === Infinity) { min = 0; max = 0 }
    const divergent = metric === 'iRatingChange' || metric === 'safetyRatingChange'
    return { getVal: gv, minMetric: min, maxMetric: max, isDivergent: divergent }
  }, [metric, buckets])

  // Color for a metric value
  const circleColor = useCallback((value: number): string => {
    if (isDivergent) {
      if (value > 0) {
        const t = maxMetric > 0 ? Math.min(value / maxMetric, 1) : 0
        return interpolateColor(colors.neutral, colors.green, t)
      } else if (value < 0) {
        const absMin = Math.abs(minMetric)
        const t = absMin > 0 ? Math.min(Math.abs(value) / absMin, 1) : 0
        return interpolateColor(colors.neutral, colors.high, t)
      }
      return rgbStr(...colors.neutral)
    } else {
      const range = maxMetric - Math.min(minMetric, 0)
      if (range === 0) return rgbStr(...colors.mid)
      const t = Math.min((value - Math.min(minMetric, 0)) / range, 1)
      if (t < 0.33) return interpolateColor(colors.low, colors.mid, t / 0.33)
      if (t < 0.66) return interpolateColor(colors.mid, colors.high, (t - 0.33) / 0.33)
      return rgbStr(...colors.high)
    }
  }, [colors, isDivergent, minMetric, maxMetric])

  const formatMetricVal = (b: Bucket) => {
    const v = getVal(b)
    if (metric === 'safetyRatingChange') return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)
    if (metric === 'iRatingChange') return v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`
    if (metric === 'incidents') return v.toFixed(1)
    return `${v}`
  }

  // X position for day column
  const xForDay = (day: number) => {
    const col = DAY_ORDER.indexOf(day)
    return MARGIN.left + col * COL_W + COL_W / 2
  }

  // Y position for hour
  const yForHour = (hour: number) => MARGIN.top + hour * ROW_H + ROW_H / 2

  if (sessions.length === 0) {
    return (
      <div ref={containerRef} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-[var(--text-muted)]">No race data to display</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full relative flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          <Clock size={24} className="text-[var(--border-accent)]" />
          Race Schedule
        </div>
        <select
          value={metric}
          onChange={e => setMetric(e.target.value as HeatMetric)}
          className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] text-xs rounded px-2 py-1 outline-none cursor-pointer"
        >
          {(Object.keys(METRIC_LABELS) as HeatMetric[]).map(k => (
            <option key={k} value={k}>{METRIC_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* SVG scatter */}
      <div className="flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="block"
        >
          {/* Grid lines — horizontal */}
          {TIME_LABELS.map(({ hour }) => (
            <line
              key={`h-${hour}`}
              x1={MARGIN.left}
              y1={yForHour(hour)}
              x2={MARGIN.left + CHART_W}
              y2={yForHour(hour)}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
          ))}

          {/* Grid lines — vertical */}
          {DAY_ORDER.map((_, i) => (
            <line
              key={`v-${i}`}
              x1={MARGIN.left + i * COL_W + COL_W / 2}
              y1={MARGIN.top}
              x2={MARGIN.left + i * COL_W + COL_W / 2}
              y2={MARGIN.top + CHART_H}
              stroke="var(--border-subtle)"
              strokeWidth={1}
            />
          ))}

          {/* Y-axis labels (time) */}
          {TIME_LABELS.map(({ hour, label }) => (
            <text
              key={`tl-${hour}`}
              x={MARGIN.left - 6}
              y={yForHour(hour) + 1}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* X-axis labels (day) */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={`dl-${i}`}
              x={MARGIN.left + i * COL_W + COL_W / 2}
              y={MARGIN.top + CHART_H + 16}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* Data circles */}
          {buckets.map(b => {
            const cx = xForDay(b.day)
            const cy = yForHour(b.hour)
            const r = MIN_R + (MAX_R - MIN_R) * (b.count / maxCount)
            const fill = circleColor(getVal(b))
            return (
              <circle
                key={`${b.day}-${b.hour}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                opacity={0.85}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => {
                  const svgRect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
                  const containerRect = containerRef.current!.getBoundingClientRect()
                  const scaleX = svgRect.width / SVG_W
                  const scaleY = svgRect.height / SVG_H
                  setTooltip({
                    x: svgRect.left - containerRect.left + cx * scaleX,
                    y: svgRect.top - containerRect.top + (cy - r) * scaleY - 4,
                    text: `${DAY_LABELS[DAY_ORDER.indexOf(b.day)]} ${b.hour === 0 ? '12' : b.hour > 12 ? b.hour - 12 : b.hour}${b.hour < 12 ? 'AM' : 'PM'}–${(b.hour + 1) % 24 === 0 ? '12' : (b.hour + 1) % 24 > 12 ? (b.hour + 1) % 24 - 12 : (b.hour + 1) % 24}${(b.hour + 1) % 24 < 12 ? 'AM' : 'PM'}: ${b.count} race${b.count > 1 ? 's' : ''}, ${METRIC_LABELS[metric]}: ${formatMetricVal(b)}`,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded text-[11px] text-[var(--text)] whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(16, 16, 32, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
