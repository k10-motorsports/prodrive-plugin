'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

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

type DayData = {
  count: number
  irDelta: number
  srDelta: number
  incidents: number
}

// ── iRacing Season Definitions ──────────────────────────────────────────────

type Season = {
  label: string
  year: number
  quarter: number
  startDate: Date
  endDate: Date
  weeks: Date[][]
}

function buildSeasons(minYear: number, maxYear: number): Season[] {
  const quarterStarts: Array<{ month: number; day: number; yearOffset: number }> = [
    { month: 11, day: 9, yearOffset: -1 },
    { month: 2,  day: 10, yearOffset: 0 },
    { month: 5,  day: 9, yearOffset: 0 },
    { month: 8,  day: 8, yearOffset: 0 },
  ]

  const seasons: Season[] = []

  for (let year = minYear; year <= maxYear; year++) {
    for (let q = 0; q < 4; q++) {
      const qs = quarterStarts[q]
      const baseDate = new Date(year + qs.yearOffset, qs.month, qs.day)
      const dayOfWeek = baseDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
      const startMon = new Date(baseDate)
      startMon.setDate(startMon.getDate() + mondayOffset)

      const weeks: Date[][] = []
      const cursor = new Date(startMon)

      for (let w = 0; w < 13; w++) {
        const week: Date[] = []
        for (let d = 0; d < 7; d++) {
          week.push(new Date(cursor))
          cursor.setDate(cursor.getDate() + 1)
        }
        weeks.push(week)
      }

      const endDate = new Date(cursor)
      endDate.setDate(endDate.getDate() - 1)

      seasons.push({
        label: `${year} S${q + 1}`,
        year,
        quarter: q + 1,
        startDate: new Date(startMon),
        endDate,
        weeks,
      })
    }
  }

  return seasons
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<HeatMetric, string> = {
  races: 'Races',
  safetyRatingChange: 'Safety Rating',
  iRatingChange: 'iRating',
  incidents: 'Incidents',
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

export default function RaceCalendarHeatmap({ sessions }: Props) {
  const [metric, setMetric] = useState<HeatMetric>('races')
  const containerRef = useRef<HTMLDivElement>(null)

  const [colors, setColors] = useState({
    empty: [24, 24, 48] as [number, number, number],
    low: [112, 0, 16] as [number, number, number],
    mid: [176, 32, 32] as [number, number, number],
    high: [229, 57, 53] as [number, number, number],
    green: [67, 160, 71] as [number, number, number],
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
      return [24, 24, 48]
    }
    setColors({
      empty: parse(resolveVar(el, '--bg-elevated', 'rgba(24, 24, 48, 0.85)')),
      low: parse(resolveVar(el, '--k10-red-dark', '#700010')),
      mid: parse(resolveVar(el, '--k10-red-mid', '#b02020')),
      high: parse(resolveVar(el, '--k10-red', '#e53935')),
      green: parse(resolveVar(el, '--green', '#43a047')),
    })
  }, [])

  // Aggregate sessions by date
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const s of sessions) {
      const d = new Date(s.date)
      const k = dateKey(d)
      const existing = map.get(k)
      if (existing) {
        existing.count++
        existing.irDelta += s.iRatingDelta
        existing.srDelta += s.srDelta
        existing.incidents += s.incidents
      } else {
        map.set(k, { count: 1, irDelta: s.iRatingDelta, srDelta: s.srDelta, incidents: s.incidents })
      }
    }
    return map
  }, [sessions])

  // Build seasons
  const { allSeasons, currentSeasonIdx } = useMemo(() => {
    if (sessions.length === 0) return { allSeasons: [] as Season[], currentSeasonIdx: 0 }
    const dates = sessions.map(s => new Date(s.date))
    const minYear = Math.min(...dates.map(d => d.getFullYear()))
    const maxYear = Math.max(...dates.map(d => d.getFullYear()))
    const all = buildSeasons(minYear, maxYear + 1)
    const now = new Date()
    let curIdx = all.length - 1
    for (let i = 0; i < all.length; i++) {
      if (now >= all[i].startDate && now <= all[i].endDate) { curIdx = i; break }
    }
    if (now > all[all.length - 1].endDate) curIdx = all.length - 1
    return { allSeasons: all, currentSeasonIdx: curIdx }
  }, [sessions])

  const [seasonIdx, setSeasonIdx] = useState<number | null>(null)
  const activeIdx = seasonIdx ?? currentSeasonIdx
  const season = allSeasons[activeIdx]

  const getValue = useCallback((k: string): number | null => {
    const d = dayMap.get(k)
    if (!d) return null
    switch (metric) {
      case 'races': return d.count
      case 'iRatingChange': return d.irDelta
      case 'safetyRatingChange': return d.srDelta
      case 'incidents': return d.incidents
    }
  }, [metric, dayMap])

  const { minVal, maxVal, isDivergent } = useMemo(() => {
    let min = Infinity, max = -Infinity
    for (const [k] of dayMap) {
      const v = getValue(k)
      if (v !== null) { if (v < min) min = v; if (v > max) max = v }
    }
    if (min === Infinity) { min = 0; max = 0 }
    return { minVal: min, maxVal: max, isDivergent: metric === 'iRatingChange' || metric === 'safetyRatingChange' }
  }, [metric, dayMap, getValue])

  const cellColor = useCallback((value: number | null): string => {
    if (value === null || value === 0) return rgbStr(...colors.empty)
    if (isDivergent) {
      if (value > 0) {
        const t = maxVal > 0 ? Math.min(value / maxVal, 1) : 0
        return interpolateColor(colors.empty, colors.green, t)
      } else {
        const absMin = Math.abs(minVal)
        const t = absMin > 0 ? Math.min(Math.abs(value) / absMin, 1) : 0
        return interpolateColor(colors.empty, colors.high, t)
      }
    } else {
      const range = maxVal - Math.min(minVal, 0)
      if (range === 0) return rgbStr(...colors.low)
      const t = Math.min((value - Math.min(minVal, 0)) / range, 1)
      if (t < 0.33) return interpolateColor(colors.empty, colors.low, t / 0.33)
      if (t < 0.66) return interpolateColor(colors.low, colors.mid, (t - 0.33) / 0.33)
      return interpolateColor(colors.mid, colors.high, (t - 0.66) / 0.34)
    }
  }, [colors, isDivergent, minVal, maxVal])

  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  const formatVal = (v: number | null) => {
    if (v === null) return '0'
    if (metric === 'safetyRatingChange') return v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)
    if (metric === 'iRatingChange') return v > 0 ? `+${v}` : `${v}`
    return `${v}`
  }

  const todayKey = dateKey(new Date())

  // ── SVG-based fluid calendar ──────────────────────────────────────────────
  // Render as SVG so the grid scales to fill container width.
  // Layout: week-label column (40 units) + 7 day columns, 14 rows (header + 12 weeks + separator + week 13)

  const LABEL_W = 48
  const COL_W = 1        // 1 fractional unit — we size everything relative to total
  const TOTAL_W = LABEL_W + 7 * 80   // 48 + 560 = 608 logical units
  const HEADER_H = 24
  const ROW_H = 46
  const SEP_H = 12
  const GRID_H = HEADER_H + 12 * ROW_H + SEP_H + ROW_H   // header + 12 weeks + sep + w13
  const SVG_W = TOTAL_W
  const SVG_H = GRID_H
  const DAY_W = 80
  const CELL_PAD = 3     // padding inside each cell for the rect

  const dayX = (di: number) => LABEL_W + di * DAY_W
  const weekY = (wi: number) => {
    if (wi < 12) return HEADER_H + wi * ROW_H
    return HEADER_H + 12 * ROW_H + SEP_H // week 13
  }

  if (sessions.length === 0 || !season) {
    return (
      <div ref={containerRef} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-[var(--text-muted)]">No race data to display</p>
      </div>
    )
  }

  const renderWeekRow = (week: Date[], wi: number, label: string) => {
    const y = weekY(wi)
    return (
      <g key={wi}>
        {/* Week label */}
        <text
          x={LABEL_W - 8}
          y={y + ROW_H / 2 + 1}
          textAnchor="end"
          dominantBaseline="middle"
          fill="var(--text-muted)"
          fontSize={12}
          fontFamily="var(--ff)"
        >
          {label}
        </text>
        {/* Day cells */}
        {week.map((day, di) => {
          const k = dateKey(day)
          const val = getValue(k)
          const bg = cellColor(val)
          const isToday = todayKey === k
          const cx = dayX(di) + CELL_PAD
          const cy = y + CELL_PAD
          const cw = DAY_W - CELL_PAD * 2
          const ch = ROW_H - CELL_PAD * 2
          return (
            <g key={di}>
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                rx={4}
                fill={bg}
                stroke={isToday ? 'var(--k10-red)' : 'none'}
                strokeWidth={isToday ? 2 : 0}
                style={{ cursor: val !== null ? 'pointer' : 'default' }}
                onMouseEnter={e => {
                  const svgEl = (e.target as SVGElement).closest('svg')!
                  const svgRect = svgEl.getBoundingClientRect()
                  const containerRect = containerRef.current!.getBoundingClientRect()
                  const scaleX = svgRect.width / SVG_W
                  const scaleY = svgRect.height / SVG_H
                  setTooltip({
                    x: svgRect.left - containerRect.left + (cx + cw / 2) * scaleX,
                    y: svgRect.top - containerRect.top + cy * scaleY - 4,
                    text: `${day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} — ${formatVal(val)} ${METRIC_LABELS[metric].toLowerCase()}`,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              {/* Day number */}
              <text
                x={cx + cw / 2}
                y={cy + ch / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={val !== null ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)'}
                fontSize={11}
                fontFamily="var(--ff)"
                pointerEvents="none"
              >
                {day.getDate()}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <div ref={containerRef} className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full relative flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          <CalendarDays size={24} className="text-[var(--border-accent)]" />
          Race Calendar
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

      {/* Season navigation */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <button
          onClick={() => setSeasonIdx(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          className="p-0.5 rounded hover:bg-[var(--bg-surface)] disabled:opacity-25 transition-colors"
        >
          <ChevronLeft size={24} className="text-[var(--text-secondary)]" />
        </button>
        <span className="text-sm font-bold text-[var(--text)] min-w-[80px] text-center tracking-wide">
          {season.label}
        </span>
        <button
          onClick={() => setSeasonIdx(Math.min(allSeasons.length - 1, activeIdx + 1))}
          disabled={activeIdx === allSeasons.length - 1}
          className="p-0.5 rounded hover:bg-[var(--bg-surface)] disabled:opacity-25 transition-colors"
        >
          <ChevronRight size={24} className="text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* SVG calendar grid — fills remaining space */}
      <div className="flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          className="block"
        >
          {/* Day-of-week header labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={`dh-${i}`}
              x={dayX(i) + DAY_W / 2}
              y={HEADER_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={12}
              fontFamily="var(--ff)"
            >
              {label}
            </text>
          ))}

          {/* Weeks 1–12 */}
          {season.weeks.slice(0, 12).map((week, wi) => renderWeekRow(week, wi, `W${wi + 1}`))}

          {/* Dashed separator before week 13 */}
          <line
            x1={LABEL_W}
            y1={HEADER_H + 12 * ROW_H + SEP_H / 2}
            x2={LABEL_W + 7 * DAY_W}
            y2={HEADER_H + 12 * ROW_H + SEP_H / 2}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="6 4"
          />

          {/* Week 13 */}
          {season.weeks[12] && renderWeekRow(season.weeks[12], 12, 'W13')}
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
