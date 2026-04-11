'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

export type RatingHistoryPoint = {
  category: string
  iRating: number
  createdAt: string
}

type Props = {
  history: RatingHistoryPoint[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  road:       { label: 'Road',       color: '#e53935' },
  oval:       { label: 'Oval',       color: '#1e88e5' },
  dirt_road:  { label: 'Dirt Road',  color: '#43a047' },
  dirt_oval:  { label: 'Dirt Oval',  color: '#ff9800' },
  sports_car: { label: 'Sports Car', color: '#ab47bc' },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Component ────────────────────────────────────────────────────────────────

export default function IRatingTimeline({ history }: Props) {
  // Determine which categories actually have data
  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const h of history) cats.add(h.category)
    // Return in a stable order matching CATEGORY_META keys
    return Object.keys(CATEGORY_META).filter(c => cats.has(c))
  }, [history])

  // Build chart data: one row per timestamp, with a column per category.
  // We forward-fill so each line continues at its last known value.
  const chartData = useMemo(() => {
    if (history.length === 0) return []

    // Group by category, each sorted ascending by date
    const byCat: Record<string, { date: string; iRating: number }[]> = {}
    for (const cat of categories) byCat[cat] = []

    for (const h of history) {
      if (byCat[h.category]) {
        byCat[h.category].push({ date: h.createdAt, iRating: h.iRating })
      }
    }

    // Sort each ascending
    for (const cat of categories) {
      byCat[cat].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    // Merge all timestamps, deduplicate, sort
    const allTimestamps = new Set<string>()
    for (const cat of categories) {
      for (const pt of byCat[cat]) allTimestamps.add(pt.date)
    }
    const sorted = [...allTimestamps].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    )

    // Build rows with forward-fill
    const lastKnown: Record<string, number | null> = {}
    for (const cat of categories) lastKnown[cat] = null

    // Pre-index: for each category, build a map from timestamp → iRating
    const catMaps: Record<string, Map<string, number>> = {}
    for (const cat of categories) {
      catMaps[cat] = new Map(byCat[cat].map(p => [p.date, p.iRating]))
    }

    const rows: Record<string, any>[] = []
    for (const ts of sorted) {
      const row: Record<string, any> = { date: formatDate(ts), _ts: ts }
      for (const cat of categories) {
        const val = catMaps[cat].get(ts)
        if (val !== undefined) lastKnown[cat] = val
        // Only start plotting a category once we've seen its first point
        if (lastKnown[cat] !== null) {
          row[cat] = lastKnown[cat]
        }
      }
      rows.push(row)
    }

    return rows
  }, [history, categories])

  if (categories.length === 0 || chartData.length === 0) {
    return (
      <div className="p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-center">
        <p className="text-sm text-[var(--text-dim)]">
          Complete some races to see your iRating progression
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] mb-3">
        <TrendingUp size={20} className="text-[var(--border-accent)]" />
        iRating Timeline
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 16 }}>
          <defs>
            {categories.map(cat => (
              <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CATEGORY_META[cat].color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CATEGORY_META[cat].color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
            stroke="rgba(255,255,255,0.1)"
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(16, 16, 32, 0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [
              value?.toLocaleString() ?? '—',
              CATEGORY_META[name]?.label ?? name,
            ]}
          />
          {categories.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}
              formatter={(value: string) => CATEGORY_META[value]?.label ?? value}
            />
          )}
          {categories.map(cat => (
            <Area
              key={cat}
              type="monotone"
              dataKey={cat}
              name={cat}
              stroke={CATEGORY_META[cat].color}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#grad-${cat})`}
              connectNulls
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
