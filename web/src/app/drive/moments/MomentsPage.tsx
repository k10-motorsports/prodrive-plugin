'use client'

import { useMemo, useState } from 'react'
import {
  Trophy,
  Medal,
  Shield,
  TrendingUp,
  Star,
  MapPin,
  Car,
  Clock,
  Flame,
  HeartCrack,
  ArrowUpFromLine,
} from 'lucide-react'
import { detectMoments, type Moment, type SessionRecord, type RatingRecord } from '@/lib/moments'

interface MomentsPageProps {
  sessions: SessionRecord[]
  ratingHistory: RatingRecord[]
}

const ICON_MAP: Record<string, React.ReactNode> = {
  win_streak: <Trophy size={20} />,
  podium_streak: <Medal size={20} />,
  clean_streak: <Shield size={20} />,
  milestone_irating: <TrendingUp size={20} />,
  license_promotion: <ArrowUpFromLine size={20} />,
  comeback: <Flame size={20} />,
  personal_best: <Star size={20} />,
  new_track: <MapPin size={20} />,
  new_car: <Car size={20} />,
  century: <Clock size={20} />,
  iron_man: <Flame size={20} />,
  heartbreak: <HeartCrack size={20} />,
}

const GRADIENT_MAP: Record<string, string> = {
  win_streak:
    'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%)',
  podium_streak:
    'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%)',
  clean_streak:
    'linear-gradient(135deg, rgba(67, 160, 71, 0.15) 0%, rgba(67, 160, 71, 0.05) 100%)',
  milestone_irating:
    'linear-gradient(135deg, rgba(229, 57, 53, 0.15) 0%, rgba(229, 57, 53, 0.05) 100%)',
  license_promotion:
    'linear-gradient(135deg, rgba(30, 136, 229, 0.15) 0%, rgba(30, 136, 229, 0.05) 100%)',
  comeback:
    'linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 152, 0, 0.05) 100%)',
  personal_best: `var(--surface)`,
  new_track: `var(--surface)`,
  new_car: `var(--surface)`,
  century: `var(--surface)`,
  iron_man:
    'linear-gradient(135deg, rgba(255, 87, 34, 0.15) 0%, rgba(255, 87, 34, 0.05) 100%)',
  heartbreak: `var(--surface)`,
}

const BORDER_COLOR_MAP: Record<string, string> = {
  win_streak: '#ffd700',
  podium_streak: '#ffd700',
  clean_streak: '#43a047',
  milestone_irating: '#e53935',
  license_promotion: '#1e88e5',
  comeback: '#ff9800',
  personal_best: 'var(--border)',
  new_track: 'var(--border)',
  new_car: 'var(--border)',
  century: 'var(--border)',
  iron_man: '#ff5722',
  heartbreak: 'var(--border)',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function groupMomentsByMonth(moments: Moment[]): Map<string, Moment[]> {
  const grouped = new Map<string, Moment[]>()
  moments.forEach((moment) => {
    const date = new Date(moment.date)
    const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(moment)
  })
  return grouped
}

export default function MomentsPage({ sessions, ratingHistory }: MomentsPageProps) {
  const moments = useMemo(() => detectMoments(sessions, ratingHistory), [sessions, ratingHistory])
  const [showAll, setShowAll] = useState(false)

  const highlights = moments.slice(0, 5)
  const grouped = groupMomentsByMonth(moments)

  if (moments.length === 0) {
    return (
      <div className="min-h-screen px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-[var(--text-secondary)] mb-2">Your Moments</h1>
          <p className="text-[var(--text-muted)] mb-12">
            Track your greatest achievements and milestones
          </p>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-8 py-12 text-center">
            <Star size={48} className="mx-auto text-[var(--text-muted)] mb-4 opacity-50" />
            <p className="text-lg text-[var(--text-muted)]">
              Keep racing to unlock your first milestone!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-secondary)] mb-2">Your Moments</h1>
        <p className="text-[var(--text-muted)] mb-12">
          Track your greatest achievements and milestones
        </p>

        {/* Highlights Section */}
        {highlights.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-semibold text-[var(--text-secondary)] mb-6">Highlights</h2>
            <div className="grid gap-4">
              {highlights.map((moment, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--border)] p-6 overflow-hidden"
                  style={{ background: GRADIENT_MAP[moment.type] }}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-white flex-shrink-0 mt-1 text-[var(--text-secondary)]">
                      {ICON_MAP[moment.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-bold text-[var(--text-secondary)] mb-1">
                        {moment.title}
                      </h3>
                      <p className="text-[var(--text-dim)] mb-3">{moment.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                        <span>{formatDate(moment.date)}</span>
                        {moment.gameName && <span>•</span>}
                        {moment.gameName && <span>{moment.gameName}</span>}
                        {moment.carModel && <span>•</span>}
                        {moment.carModel && <span>{moment.carModel}</span>}
                        {moment.trackName && <span>•</span>}
                        {moment.trackName && <span>{moment.trackName}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-3xl font-bold text-[var(--k10-red)]">
                        {moment.significance}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">significance</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Section */}
        {moments.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-secondary)] mb-6">Timeline</h2>
            <div className="space-y-8">
              {Array.from(grouped.entries()).map(([month, monthMoments]) => (
                <div key={month}>
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
                    {month}
                  </h3>
                  <div className="space-y-3">
                    {monthMoments.map((moment, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex items-start gap-4"
                        style={{
                          borderLeftWidth: '4px',
                          borderLeftColor: BORDER_COLOR_MAP[moment.type],
                        }}
                      >
                        <div className="flex-shrink-0 text-[var(--text-secondary)] mt-0.5">
                          {ICON_MAP[moment.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[var(--text-secondary)] text-sm">
                            {moment.title}
                          </h4>
                          <p className="text-xs text-[var(--text-dim)] mt-1">{moment.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-right text-xs text-[var(--text-muted)]">
                          <div>{formatDate(moment.date)}</div>
                          {moment.carModel && <div className="mt-1">{moment.carModel}</div>}
                          {moment.trackName && <div>{moment.trackName}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {moments.length > 10 && !showAll && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowAll(true)}
                  className="px-6 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors text-sm font-medium"
                >
                  Load more moments
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
