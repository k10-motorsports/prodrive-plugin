import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { db, schema } from '@/db'
import { eq, and, desc } from 'drizzle-orm'
import { getTrackImage } from '@/lib/commentary-images'
import { getTrackLocation } from '@/data/track-metadata'
import { computeTrackMastery, type TrackMastery } from '@/lib/mastery'
import TrackDetailClient from './TrackDetailClient'

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name: encodedName } = await params
  const trackName = decodeURIComponent(encodedName)

  const session = await auth()
  if (!session?.user) redirect('/drive')

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string

  let dbUser: { id: string } | null = null
  if (discordId) {
    const users = await db.select().from(schema.users).where(eq(schema.users.discordId, discordId)).limit(1)
    if (users.length > 0) dbUser = users[0]
  }
  if (!dbUser) redirect('/drive')

  // ── Fetch all sessions at this track ──────────────────────────────────────
  const trackSessions = await db
    .select()
    .from(schema.raceSessions)
    .where(
      and(
        eq(schema.raceSessions.userId, dbUser.id),
        eq(schema.raceSessions.trackName, trackName),
      ),
    )
    .orderBy(desc(schema.raceSessions.createdAt))

  if (trackSessions.length === 0) notFound()

  // ── Fetch all sessions for mastery computation ────────────────────────────
  const allSessions = await db
    .select()
    .from(schema.raceSessions)
    .where(eq(schema.raceSessions.userId, dbUser.id))
    .orderBy(desc(schema.raceSessions.createdAt))

  const masteryData = computeTrackMastery(
    allSessions.map(s => ({
      id: s.id,
      carModel: s.carModel,
      manufacturer: s.manufacturer || '',
      trackName: s.trackName || '',
      finishPosition: s.finishPosition,
      incidentCount: s.incidentCount ?? 0,
      metadata: s.metadata as Record<string, any> | null,
      createdAt: s.createdAt,
      gameName: (s.metadata as any)?.gameName || s.gameName || 'iRacing',
    })),
  )

  const trackMastery = masteryData.find(m => m.trackName === trackName) || null

  // ── Fetch rating history for this track ───────────────────────────────────
  const ratingHistory = await db
    .select()
    .from(schema.ratingHistory)
    .where(
      and(
        eq(schema.ratingHistory.userId, dbUser.id),
        eq(schema.ratingHistory.trackName, trackName),
      ),
    )
    .orderBy(desc(schema.ratingHistory.createdAt))

  // ── Fetch track map ───────────────────────────────────────────────────────
  let trackSvgPath: string | null = null
  let trackLogoSvg: string | null = null
  let trackDisplayName: string | null = null
  let sectorBoundaries: number[] | undefined

  const maps = await db
    .select({
      trackName: schema.trackMaps.trackName,
      svgPath: schema.trackMaps.svgPath,
      logoSvg: schema.trackMaps.logoSvg,
      displayName: schema.trackMaps.displayName,
      sectorBoundaries: schema.trackMaps.sectorBoundaries,
    })
    .from(schema.trackMaps)

  const match = maps.find(m => m.trackName.toLowerCase() === trackName.toLowerCase())
  if (match) {
    trackSvgPath = match.svgPath
    trackLogoSvg = match.logoSvg
    trackDisplayName = match.displayName
    if (match.sectorBoundaries) {
      try { sectorBoundaries = JSON.parse(match.sectorBoundaries) } catch { /* skip */ }
    }
  }

  // ── Fetch behavior data for incident hotspots ─────────────────────────────
  const behaviorData = await db
    .select()
    .from(schema.sessionBehavior)
    .where(eq(schema.sessionBehavior.userId, dbUser.id))
    .limit(200)

  const trackSessionIds = new Set(trackSessions.map(s => s.id))
  const trackBehaviors = behaviorData.filter(b => trackSessionIds.has(b.sessionId))

  // Aggregate incident locations across all sessions at this track
  const allIncidentLocations: Array<{ trackPosition: number; count: number; type?: string }> = []
  for (const b of trackBehaviors) {
    const locs = (b.incidentLocations as Array<{ trackPosition: number; lapNumber: number; type?: string; points?: number }>) || []
    for (const loc of locs) {
      const bucket = Math.round(loc.trackPosition * 20) / 20
      const existing = allIncidentLocations.find(a => Math.abs(a.trackPosition - bucket) < 0.01)
      if (existing) {
        existing.count++
      } else {
        allIncidentLocations.push({ trackPosition: bucket, count: 1, type: loc.type })
      }
    }
  }

  // ── Compute aggregate stats ───────────────────────────────────────────────
  const positions = trackSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => s.finishPosition!)

  const totalIncidents = trackSessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0)
  const totalLaps = trackSessions.reduce((sum, s) => sum + ((s.metadata as any)?.completedLaps ?? 0), 0)

  // Position history for trend chart
  const positionHistory = trackSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => ({
      date: s.createdAt.toISOString(),
      position: s.finishPosition!,
      incidents: s.incidentCount ?? 0,
      carModel: s.carModel,
    }))
    .reverse()

  // iRating history at this track
  const irHistory = ratingHistory.map(r => ({
    date: r.createdAt.toISOString(),
    iRating: r.iRating,
    delta: r.prevIRating ? r.iRating - r.prevIRating : 0,
  })).reverse()

  // Cars used at this track
  const carUsage = new Map<string, number>()
  for (const s of trackSessions) {
    carUsage.set(s.carModel, (carUsage.get(s.carModel) || 0) + 1)
  }
  const carsUsed = [...carUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([car, count]) => ({ car, count }))

  const trackImageUrl = getTrackImage(trackName)
  const trackLocation = getTrackLocation(trackName)

  // ── Generate summary ──────────────────────────────────────────────────────
  const avgPosition = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null
  const avgIncidents = trackSessions.length > 0 ? totalIncidents / trackSessions.length : 0
  const wins = positions.filter(p => p === 1).length
  const podiums = positions.filter(p => p <= 3).length
  const cleanRaces = trackSessions.filter(s => (s.incidentCount ?? 0) === 0).length

  let narrativeSummary: string
  if (trackSessions.length === 1) {
    narrativeSummary = `You have raced here once. ${bestPosition && bestPosition <= 5 ? 'A strong debut — build on this foundation.' : 'Every track starts with a first lap. The data from this visit will shape your approach next time.'}`
  } else if (trackMastery && trackMastery.masteryTier === 'diamond') {
    narrativeSummary = `This is one of your strongest tracks. With ${trackSessions.length} races, ${wins} win${wins !== 1 ? 's' : ''}, and a ${avgIncidents.toFixed(1)} average incident rate, you have earned Diamond mastery.`
  } else if (trackMastery && trackMastery.trend === 'improving') {
    narrativeSummary = `Your results here are on an upward trajectory. Average finish has improved to P${avgPosition?.toFixed(1)} over ${trackSessions.length} races.`
  } else if (avgIncidents > 5) {
    narrativeSummary = `This track challenges your clean racing — ${avgIncidents.toFixed(1)} average incidents across ${trackSessions.length} races. Check the heatmap below to identify recurring trouble spots.`
  } else {
    narrativeSummary = `You have ${trackSessions.length} races here with ${podiums} podium${podiums !== 1 ? 's' : ''} and an average finish of P${avgPosition?.toFixed(1)}.`
  }

  return (
    <TrackDetailClient
      trackName={trackName}
      trackDisplayName={trackDisplayName}
      trackSvgPath={trackSvgPath}
      trackLogoSvg={trackLogoSvg}
      trackImageUrl={trackImageUrl}
      trackLocation={trackLocation}
      sectorBoundaries={sectorBoundaries}
      incidentLocations={allIncidentLocations}
      mastery={trackMastery ? {
        masteryScore: trackMastery.masteryScore,
        masteryTier: trackMastery.masteryTier,
        trend: trackMastery.trend,
      } : null}
      stats={{
        totalRaces: trackSessions.length,
        totalLaps,
        avgPosition,
        bestPosition,
        avgIncidents,
        totalIncidents,
        wins,
        podiums,
        cleanRaces,
      }}
      positionHistory={positionHistory}
      irHistory={irHistory}
      carsUsed={carsUsed}
      recentSessions={trackSessions.map(s => ({
        id: s.id,
        carModel: s.carModel,
        finishPosition: s.finishPosition,
        incidentCount: s.incidentCount ?? 0,
        sessionType: s.sessionType || s.category,
        date: s.createdAt.toISOString(),
        irDelta: ((s.metadata as any)?.postRaceIRating ?? null) !== null && ((s.metadata as any)?.preRaceIRating ?? null) !== null
          ? (s.metadata as any).postRaceIRating - (s.metadata as any).preRaceIRating
          : null,
      }))}
      narrativeSummary={narrativeSummary}
    />
  )
}
