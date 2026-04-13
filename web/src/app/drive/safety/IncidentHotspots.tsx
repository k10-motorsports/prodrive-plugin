'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, TrendingDown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

interface RaceSession {
  id: string
  carModel: string
  trackName: string
  incidentCount: number
  createdAt: string
}

interface RatingHistoryEntry {
  category: string
  iRating: number
  safetyRating: string
  license: string
  prevSafetyRating: string | null
  trackName: string | null
  carModel: string | null
  createdAt: string
}

interface IncidentHotspotsProps {
  raceSessions: RaceSession[]
  ratingHistory: RatingHistoryEntry[]
}

interface TrackHotspot {
  track: string
  totalRaces: number
  totalIncidents: number
  avgIncidents: number
  srTrend: number | null
}

type SortField = 'avgIncidents' | 'totalRaces' | 'srTrend'
type SortDirection = 'asc' | 'desc'

export default function IncidentHotspots({ raceSessions, ratingHistory }: IncidentHotspotsProps) {
  const [sortField, setSortField] = useState<SortField>('avgIncidents')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  const hotspotsData = useMemo(() => {
    const trackMap = new Map<string, TrackHotspot>()

    // Aggregate from race sessions
    raceSessions.forEach((session) => {
      const track = session.trackName
      const existing = trackMap.get(track) || {
        track,
        totalRaces: 0,
        totalIncidents: 0,
        avgIncidents: 0,
        srTrend: null,
      }

      existing.totalRaces += 1
      existing.totalIncidents += session.incidentCount
      existing.avgIncidents = existing.totalIncidents / existing.totalRaces
      trackMap.set(track, existing)
    })

    // Calculate SR trend per track from rating history
    const trackSRTrends = new Map<string, number[]>()
    ratingHistory.forEach((entry) => {
      if (!entry.trackName) return
      const prevSR = entry.prevSafetyRating ? parseFloat(entry.prevSafetyRating) : 0
      const currentSR = parseFloat(entry.safetyRating)
      const delta = currentSR - prevSR

      if (!trackSRTrends.has(entry.trackName)) {
        trackSRTrends.set(entry.trackName, [])
      }
      trackSRTrends.get(entry.trackName)!.push(delta)
    })

    // Calculate average SR trend per track
    trackSRTrends.forEach((deltas, track) => {
      const hotspot = trackMap.get(track)
      if (hotspot) {
        hotspot.srTrend = deltas.reduce((a, b) => a + b, 0) / deltas.length
      }
    })

    return Array.from(trackMap.values())
  }, [raceSessions, ratingHistory])

  const sortedData = useMemo(() => {
    const sorted = [...hotspotsData]
    sorted.sort((a, b) => {
      let aVal: number
      let bVal: number

      if (sortField === 'srTrend') {
        aVal = a.srTrend ?? 0
        bVal = b.srTrend ?? 0
      } else {
        aVal = a[sortField]
        bVal = b[sortField]
      }

      if (sortDir === 'desc') {
        return bVal - aVal
      } else {
        return aVal - bVal
      }
    })

    return sorted.slice(0, 8)
  }, [hotspotsData, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  return (
    <div
      className="rounded-lg p-6"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-6">
        <MapPin size={20} className="text-amber-500" />
        <h2 className="text-xl font-semibold">Incident Hotspots</h2>
      </div>

      {hotspotsData.length === 0 ? (
        <div className="text-center py-8 text-zinc-400">
          <p>No track data yet. Race at different tracks to see hotspot analysis.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-3 px-4 font-medium text-zinc-300">Track</th>
                <th
                  className="text-right py-3 px-4 font-medium text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors"
                  onClick={() => toggleSort('totalRaces')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Races
                    {sortField === 'totalRaces' ? (
                      sortDir === 'asc' ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )
                    ) : (
                      <span className="opacity-30">⬍</span>
                    )}
                  </div>
                </th>
                <th className="text-right py-3 px-4 font-medium text-zinc-300">Total Incidents</th>
                <th
                  className="text-right py-3 px-4 font-medium text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors"
                  onClick={() => toggleSort('avgIncidents')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Avg/Race
                    {sortField === 'avgIncidents' ? (
                      sortDir === 'asc' ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )
                    ) : (
                      <span className="opacity-30">⬍</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-right py-3 px-4 font-medium text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors"
                  onClick={() => toggleSort('srTrend')}
                >
                  <div className="flex items-center justify-end gap-2">
                    SR Trend
                    {sortField === 'srTrend' ? (
                      sortDir === 'asc' ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )
                    ) : (
                      <span className="opacity-30">⬍</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((hotspot) => (
                <tr
                  key={hotspot.track}
                  className="border-b border-zinc-800 hover:bg-zinc-800 hover:bg-opacity-50 transition-colors"
                >
                  <td className="py-3 px-4 text-zinc-100">
                    <Link href={`/drive/track/${encodeURIComponent(hotspot.track)}`} className="hover:text-emerald-400 transition-colors">
                      {hotspot.track}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-300">{hotspot.totalRaces}</td>
                  <td className="py-3 px-4 text-right text-zinc-300">{hotspot.totalIncidents}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={hotspot.avgIncidents > 2 ? 'text-rose-400' : 'text-zinc-300'}>
                      {hotspot.avgIncidents.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {hotspot.srTrend !== null ? (
                      <div className="flex items-center justify-end gap-1">
                        {hotspot.srTrend > 0 ? (
                          <>
                            <TrendingUp size={14} className="text-emerald-400" />
                            <span className="text-emerald-400">+{hotspot.srTrend.toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={14} className="text-rose-400" />
                            <span className="text-rose-400">{hotspot.srTrend.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
