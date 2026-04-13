'use client'

import Link from 'next/link'
import { BarChart3, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

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

interface LapTelemetryData {
  id: string
  lapNumber: number
  lapTime: number | null
  incidentCount: number
  rageScore: number | null
}

interface SessionBehaviorData {
  id: string
  hardBrakingEvents: number
  closePassCount: number
  tailgatingSeconds: number
  offTrackCount: number
  spinCount: number
  cleanLaps: number
  totalLaps: number
  peakRageScore: number
  avgRageScore: number
  incidentsByPhase: Record<string, any> | null
}

export default function SessionSummaryCard({
  session,
  sessionBehavior,
  lapTelemetries,
}: {
  session: RaceSession
  sessionBehavior: SessionBehaviorData | null
  lapTelemetries: LapTelemetryData[]
}) {
  const meta = (session.metadata || {}) as Record<string, any>

  const preRaceSR = meta.preRaceSR ?? null
  const postRaceSR = meta.postRaceSR ?? null
  const preRaceIR = meta.preRaceIRating ?? null
  const postRaceIR = meta.postRaceIRating ?? null

  const srChange = preRaceSR && postRaceSR ? postRaceSR - preRaceSR : null
  const irChange = preRaceIR && postRaceIR ? postRaceIR - preRaceIR : null

  const isDNF = !session.finishPosition || session.finishPosition === 0

  // Calculate clean lap percentage
  const cleanLapsCount = sessionBehavior?.cleanLaps ?? 0
  const totalLaps = sessionBehavior?.totalLaps ?? lapTelemetries.length
  const cleanLapPercentage =
    totalLaps > 0 ? Math.round((cleanLapsCount / totalLaps) * 100) : 0

  // Race phases
  const incidentsByPhase = (sessionBehavior?.incidentsByPhase || {}) as Record<
    string,
    number
  >
  const earlyIncidents = incidentsByPhase.early ?? 0
  const midIncidents = incidentsByPhase.mid ?? 0
  const lateIncidents = incidentsByPhase.late ?? 0

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className="rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-750 border-b border-zinc-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/drive/track/${encodeURIComponent(session.trackName || '')}`} className="text-lg font-semibold text-zinc-100 hover:text-emerald-400 transition-colors">
              {session.trackName || 'Unknown Track'}
            </Link>
            <p className="text-sm text-zinc-400 mt-1">
              <Link href={`/drive/car/${encodeURIComponent(session.carModel)}`} className="hover:text-zinc-200 transition-colors">{session.carModel}</Link> • {formatDate(session.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-zinc-400" />
            <span className="text-2xl font-bold text-zinc-100">
              {isDNF ? 'DNF' : session.finishPosition || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">
        {/* Finish Position / Incidents */}
        <div className="bg-zinc-900 rounded p-3">
          <p className="text-xs text-zinc-400 font-medium mb-1">Incidents</p>
          <p className="text-2xl font-bold text-zinc-100">
            {session.incidentCount ?? 0}
          </p>
        </div>

        {/* Clean Laps */}
        <div className="bg-zinc-900 rounded p-3">
          <p className="text-xs text-zinc-400 font-medium mb-1">Clean Laps</p>
          <p className="text-2xl font-bold text-emerald-400">
            {cleanLapPercentage}%
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {cleanLapsCount} of {totalLaps}
          </p>
        </div>

        {/* SR Change */}
        {srChange !== null && (
          <div className="bg-zinc-900 rounded p-3">
            <p className="text-xs text-zinc-400 font-medium mb-1">SR Change</p>
            <div className="flex items-center gap-1">
              {srChange >= 0 ? (
                <>
                  <TrendingUp size={16} className="text-emerald-400" />
                  <p className="text-2xl font-bold text-emerald-400">
                    +{srChange.toFixed(2)}
                  </p>
                </>
              ) : (
                <>
                  <TrendingDown size={16} className="text-rose-400" />
                  <p className="text-2xl font-bold text-rose-400">
                    {srChange.toFixed(2)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* iR Change */}
        {irChange !== null && (
          <div className="bg-zinc-900 rounded p-3">
            <p className="text-xs text-zinc-400 font-medium mb-1">iR Change</p>
            <div className="flex items-center gap-1">
              {irChange >= 0 ? (
                <>
                  <TrendingUp size={16} className="text-emerald-400" />
                  <p className="text-2xl font-bold text-emerald-400">
                    +{irChange}
                  </p>
                </>
              ) : (
                <>
                  <TrendingDown size={16} className="text-rose-400" />
                  <p className="text-2xl font-bold text-rose-400">
                    {irChange}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Race Phase Breakdown (if behavior data exists) */}
      {sessionBehavior && (
        <div className="border-t border-zinc-700 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400" />
            Incidents by Race Phase
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 rounded p-3 text-center">
              <p className="text-xs text-zinc-400 font-medium mb-1">Early</p>
              <p className="text-2xl font-bold text-rose-400">
                {earlyIncidents}
              </p>
            </div>
            <div className="bg-zinc-900 rounded p-3 text-center">
              <p className="text-xs text-zinc-400 font-medium mb-1">Mid</p>
              <p className="text-2xl font-bold text-amber-400">{midIncidents}</p>
            </div>
            <div className="bg-zinc-900 rounded p-3 text-center">
              <p className="text-xs text-zinc-400 font-medium mb-1">Late</p>
              <p className="text-2xl font-bold text-orange-400">
                {lateIncidents}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Behavioral Metrics */}
      {sessionBehavior && (
        <div className="border-t border-zinc-700 px-6 py-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3">
            Behavioral Metrics
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Hard Braking Events</p>
              <p className="text-lg font-semibold text-zinc-100">
                {sessionBehavior.hardBrakingEvents}
              </p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Close Passes</p>
              <p className="text-lg font-semibold text-zinc-100">
                {sessionBehavior.closePassCount}
              </p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Off-Track Events</p>
              <p className="text-lg font-semibold text-zinc-100">
                {sessionBehavior.offTrackCount}
              </p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Spins</p>
              <p className="text-lg font-semibold text-zinc-100">
                {sessionBehavior.spinCount}
              </p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Peak Rage Score</p>
              <p className="text-lg font-semibold text-rose-400">
                {sessionBehavior.peakRageScore.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Avg Rage Score</p>
              <p className="text-lg font-semibold text-orange-400">
                {sessionBehavior.avgRageScore.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
