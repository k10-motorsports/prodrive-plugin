'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Target } from 'lucide-react'
import { computeDriverDNA, getDriverArchetype } from '@/lib/driver-dna'

interface SessionData {
  finishPosition: number | null
  incidentCount: number | null
  metadata: Record<string, any> | null
  carModel: string
  trackName: string | null
  gameName: string | null
  createdAt: string
}

interface RatingData {
  iRating: number
  prevIRating: number | null
  createdAt: string
}

interface Props {
  sessions: SessionData[]
  ratingHistory: RatingData[]
}

export default function DriverDNARadar({ sessions, ratingHistory }: Props) {
  const { radarData, archetype, hasData } = useMemo(() => {
    const dna = computeDriverDNA(sessions, ratingHistory)
    const arch = getDriverArchetype(dna)
    const hasEnoughData = sessions.length >= 3

    const data = [
      { dimension: 'Consistency', value: dna.consistency, fullMark: 100 },
      { dimension: 'Racecraft', value: dna.racecraft, fullMark: 100 },
      { dimension: 'Cleanness', value: dna.cleanness, fullMark: 100 },
      { dimension: 'Endurance', value: dna.endurance, fullMark: 100 },
      { dimension: 'Adaptability', value: dna.adaptability, fullMark: 100 },
      { dimension: 'Improvement', value: dna.improvement, fullMark: 100 },
      dna.wetWeather !== 50 ? { dimension: 'Wet Weather', value: dna.wetWeather, fullMark: 100 } : null,
      { dimension: 'Experience', value: dna.experience, fullMark: 100 },
    ].filter(Boolean)

    return { radarData: data, archetype: arch, hasData: hasEnoughData }
  }, [sessions, ratingHistory])

  if (!hasData) {
    return (
      <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full flex flex-col items-center justify-center min-h-[200px]">
        <Target size={24} className="text-[var(--text-muted)] mb-2 opacity-50" />
        <p className="text-sm text-[var(--text-muted)] text-center">
          Complete 3+ races to unlock your Driver DNA
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] p-4 h-full relative flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          <Target size={24} className="text-[var(--border-accent)]" />
          Driver DNA
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--k10-red)]/15 text-[var(--k10-red)]">
          {archetype.name}
        </span>
      </div>

      {/* Radar Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="dimension" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} />
            <PolarRadiusAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'var(--text)' }}
            />
            <Radar name="Driver DNA" dataKey="value" stroke="#e53935" fill="#e53935" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer link */}
      <Link
        href="/drive/dna"
        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors text-right mt-1"
      >
        View full profile &rarr;
      </Link>
    </div>
  )
}
