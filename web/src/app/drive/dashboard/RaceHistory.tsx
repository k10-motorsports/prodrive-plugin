'use client'

import { useState, useEffect, useCallback } from 'react'
import { Car, LayoutGrid, List } from 'lucide-react'
import RaceCard from './RaceCard'
import RaceListView from './RaceListView'

// ── Types (mirrored from page.tsx) ────────────────────────────────────────────

interface RaceSession {
  id: string
  carModel: string
  manufacturer: string | null
  trackName: string | null
  finishPosition: number | null
  incidentCount: number | null
  sessionType: string | null
  category: string
  metadata: Record<string, any> | null
  createdAt: Date
}

interface BrandInfo {
  logoSvg: string | null
  logoPng: string | null
  brandColorHex: string | null
  manufacturerName: string
}

interface DisplayCard {
  session: RaceSession
  practiceSession?: RaceSession
  qualifyingSession?: RaceSession
}

interface CardLookups {
  trackMapLookup: Record<string, string>
  carImageLookup: Record<string, string | null>
  trackImageLookup: Record<string, string | null>
  trackLogoLookup: Record<string, string>
  trackDisplayNameLookup: Record<string, string>
  brandLogoLookup: Record<string, BrandInfo>
  iRatingHistory: number[]
}

type ViewMode = 'cards' | 'list'

const STORAGE_KEY = 'k10-race-history-view'

function readSavedView(): ViewMode {
  if (typeof window === 'undefined') return 'cards'
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'list' ? 'list' : 'cards'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RaceHistory({
  displayCards,
  lookups,
}: {
  displayCards: DisplayCard[]
  lookups: CardLookups
}) {
  const [view, setView] = useState<ViewMode>('cards')

  // Restore saved preference on mount
  useEffect(() => {
    setView(readSavedView())
  }, [])

  const changeView = useCallback((mode: ViewMode) => {
    setView(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [])

  const trackKey = (name: string | null) => (name || '').toLowerCase()

  return (
    <section className="mb-8">
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2
          className="font-bold flex items-center gap-2"
          style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--ff-display)' }}
        >
          <Car size={24} className="text-[var(--border-accent)]" />
          Race History
        </h2>

        <div className="flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => changeView('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              view === 'cards'
                ? 'bg-white/10 text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <LayoutGrid size={14} />
            Cards
          </button>
          <button
            onClick={() => changeView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              view === 'list'
                ? 'bg-white/10 text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <List size={14} />
            List
          </button>
        </div>
      </div>

      {/* Content */}
      {displayCards.length > 0 ? (
        view === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayCards.map(({ session: s, practiceSession, qualifyingSession }) => (
              <RaceCard
                key={s.id}
                session={s}
                practiceSession={practiceSession}
                qualifyingSession={qualifyingSession}
                trackSvgPath={lookups.trackMapLookup[trackKey(s.trackName)] || null}
                carImageUrl={lookups.carImageLookup[s.carModel] || null}
                trackImageUrl={lookups.trackImageLookup[s.trackName ?? ''] || null}
                trackLogoSvg={lookups.trackLogoLookup[trackKey(s.trackName)] || null}
                trackDisplayName={lookups.trackDisplayNameLookup[trackKey(s.trackName)] || null}
                brandInfo={lookups.brandLogoLookup[s.carModel] ?? null}
                iRatingHistory={lookups.iRatingHistory}
              />
            ))}
          </div>
        ) : (
          <RaceListView cards={displayCards} lookups={lookups} />
        )
      ) : (
        <div className="p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-center">
          <Car size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-dim)] mb-1">No races recorded yet</p>
          <p className="text-xs text-[var(--text-muted)]">
            Your session data will appear here after your next race with data sync enabled.
          </p>
        </div>
      )}
    </section>
  )
}
