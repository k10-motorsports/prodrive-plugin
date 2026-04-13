'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { computeTrackMastery, computeCarAffinity, type TrackMastery, type CarAffinity } from '@/lib/mastery'
import styles from './TrackMasteryPage.module.css'

interface RaceSession {
  id: string
  carModel: string
  manufacturer: string
  trackName: string
  finishPosition: number | null
  incidentCount: number
  metadata: Record<string, any> | null
  createdAt: string
  gameName: string
}

interface Props {
  sessions: RaceSession[]
  brandColors: Record<string, string>
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)

  if (diffSec < 60) return 'now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return `${diffWeek}w ago`
}

function formatPosition(pos: number): string {
  return `P${pos.toFixed(1)}`
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  diamond: '#b9f2ff'
}

function TierBadge({ tier }: { tier: TrackMastery['masteryTier'] }) {
  return (
    <div className={styles.tierBadge}>
      <div
        className={styles.tierDot}
        style={{ backgroundColor: TIER_COLORS[tier] }}
      />
      <span>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
    </div>
  )
}

function MasteryProgressRing({ score, color }: { score: number; color: string }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (score / 100) * circumference

  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className={styles.progressRing}>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="3"
      />
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="11"
        fontWeight="bold"
      >
        {score}
      </text>
    </svg>
  )
}

function TrendIndicator({ trend }: { trend: string }) {
  let arrow = '→'
  let label = 'Stable'

  if (trend === 'improving') {
    arrow = '↑'
    label = 'Improving'
  } else if (trend === 'declining') {
    arrow = '↓'
    label = 'Declining'
  } else if (trend === 'new') {
    arrow = '●'
    label = 'New'
  }

  return (
    <div className={styles.trend}>
      <span>{arrow}</span>
      <span>{label}</span>
    </div>
  )
}

function TrackCard({ track, color }: { track: TrackMastery; color: string }) {
  return (
    <Link href={`/drive/track/${encodeURIComponent(track.trackName)}`} className={styles.trackCard} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={styles.cardHeader}>
        <h3>{track.trackName}</h3>
        <TierBadge tier={track.masteryTier} />
      </div>

      <div className={styles.scoreSection}>
        <MasteryProgressRing
          score={track.masteryScore}
          color={TIER_COLORS[track.masteryTier]}
        />
        <div className={styles.scoreInfo}>
          <div className={styles.statRow}>
            <span className={styles.label}>Sessions</span>
            <span className={styles.value}>{track.totalSessions}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.label}>Avg Position</span>
            <span className={styles.value}>
              {track.avgPosition !== null ? formatPosition(track.avgPosition) : '—'}
            </span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.label}>Incidents/Race</span>
            <span className={styles.value}>{track.avgIncidents.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {track.gameNames.length > 0 && (
        <div className={styles.gameBadges}>
          {track.gameNames.map(game => (
            <span key={game} className={styles.gameBadge}>
              {game}
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <TrendIndicator trend={track.trend} />
        <span className={styles.lastRaced}>
          {formatRelativeTime(track.lastRaced)}
        </span>
      </div>
    </Link>
  )
}

function CarAffinityCard({
  affinity,
  brandColor
}: {
  affinity: CarAffinity
  brandColor?: string
}) {
  const [expanded, setExpanded] = useState(false)

  const bgColor = brandColor ? `${brandColor}14` : 'transparent'
  const borderColor = brandColor || 'var(--border)'

  return (
    <div
      className={styles.affinityCard}
      style={{
        backgroundColor: bgColor,
        borderLeftColor: borderColor
      }}
    >
      <div className={styles.affinityHeader}>
        <div>
          <h3>{affinity.manufacturer}</h3>
          <div className={styles.affinityStats}>
            <span>{affinity.totalSessions} sessions</span>
            <span className={styles.separator}>•</span>
            <span>
              {affinity.avgPosition !== null ? formatPosition(affinity.avgPosition) : '—'}
              {' '}avg
            </span>
          </div>
        </div>
        <div className={styles.affinityBadges}>
          <div className={styles.affinityScore}>
            <span className={styles.scoreLabel}>Affinity</span>
            <span className={styles.scoreValue}>{affinity.affinityScore}</span>
          </div>
          <TrendIndicator trend={affinity.trend} />
        </div>
      </div>

      <div className={styles.scoreBar}>
        <div
          className={styles.scoreBarFill}
          style={{
            width: `${affinity.affinityScore}%`,
            backgroundColor: brandColor || 'var(--text-secondary)'
          }}
        />
      </div>

      <div className={styles.affinityDetailStats}>
        <div className={styles.stat}>
          <span className={styles.label}>Best</span>
          <span className={styles.value}>
            {affinity.bestPosition !== null ? `P${affinity.bestPosition}` : '—'}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Incidents</span>
          <span className={styles.value}>{affinity.avgIncidents.toFixed(1)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Laps</span>
          <span className={styles.value}>{affinity.totalLaps}</span>
        </div>
      </div>

      {affinity.cars.length > 0 && (
        <div className={styles.carList}>
          <button
            className={styles.expandButton}
            onClick={() => setExpanded(!expanded)}
          >
            <span className={styles.chevron}>
              {expanded ? '▼' : '▶'}
            </span>
            {affinity.cars.length} car{affinity.cars.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className={styles.carListItems}>
              {affinity.cars.map(car => (
                <Link key={car.carModel} href={`/drive/car/${encodeURIComponent(car.carModel)}`} className={styles.carItem} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <span className={styles.carName}>{car.carModel}</span>
                  <span className={styles.carMeta}>
                    {car.sessionCount} session{car.sessionCount !== 1 ? 's' : ''} in {car.gameName}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TrackMasteryPage({ sessions, brandColors }: Props) {
  const tracks = useMemo(() => {
    const converted = sessions.map(s => ({
      ...s,
      createdAt: new Date(s.createdAt)
    }))
    return computeTrackMastery(converted)
  }, [sessions])

  const affinities = useMemo(() => {
    const converted = sessions.map(s => ({
      ...s,
      createdAt: new Date(s.createdAt)
    }))
    return computeCarAffinity(converted)
  }, [sessions])

  const totalSessions = sessions.length
  const uniqueTracks = new Set(sessions.map(s => s.trackName)).size
  const uniqueCars = new Set(sessions.map(s => s.carModel)).size

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Tracks & Cars</h1>
          <p>Master the circuits and your machinery</p>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{uniqueTracks}</span>
            <span className={styles.statLabel}>Tracks</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{uniqueCars}</span>
            <span className={styles.statLabel}>Cars</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{totalSessions}</span>
            <span className={styles.statLabel}>Sessions</span>
          </div>
        </div>
      </div>

      <section className={styles.section}>
        <h2>Track Mastery</h2>
        {tracks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Hit the track and your mastery profile will build automatically</p>
          </div>
        ) : (
          <div className={styles.trackGrid}>
            {tracks.map(track => (
              <TrackCard
                key={track.trackName}
                track={track}
                color={TIER_COLORS[track.masteryTier]}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Car Affinity</h2>
        {affinities.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Your car affinity develops as you race different machinery</p>
          </div>
        ) : (
          <div className={styles.affinityGrid}>
            {affinities.map(affinity => (
              <CarAffinityCard
                key={affinity.manufacturer}
                affinity={affinity}
                brandColor={brandColors[affinity.brandKey]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
