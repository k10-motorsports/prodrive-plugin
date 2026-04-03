/**
 * iRacing Data API — Type Definitions
 * ─────────────────────────────────────────────
 * The actual API calls are made by the C# SimHub plugin (IRacingDataClient.cs)
 * which reads cookies from the locally running iRacing app.
 *
 * The plugin fetches career data and pushes it to POST /api/iracing/import.
 * This file defines the shared types used by the import route.
 */

export interface IRacingRecentRace {
  subsessionId: number
  seriesName: string
  seasonName: string
  startTime: string
  trackName: string
  carName: string
  startingPosition: number
  finishPosition: number
  incidents: number
  champPoints: number
  newIRating: number
  oldIRating: number
  newSubLevel: number
  oldSubLevel: number
  lapsComplete: number
  lapsLed: number
  sessionStartTime: string
  strengthOfField: number
}

export interface IRacingCareerStats {
  category: string
  starts: number
  wins: number
  top5s: number
  podiums: number
  laps: number
  lapsLed: number
  avgStartPosition: number
  avgFinishPosition: number
  avgIncidentsPerRace: number
  totalIncidents: number
  winPercentage: number
}

export interface IRacingChartPoint {
  when: string
  value: number
}

export interface IRacingImportPayload {
  custId: number
  displayName: string
  recentRaces: any[]
  careerSummary: any[]
  chartData: Record<string, IRacingChartPoint[]>
  yearlyStats?: any[]
  exportedAt: string
}
