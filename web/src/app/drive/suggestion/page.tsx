import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'
import { getTrackImage, getCarImage } from '@/lib/commentary-images'
import { getTrackLocation } from '@/data/track-metadata'
import { computeTrackMastery, computeCarAffinity } from '@/lib/mastery'
import SuggestionDetailClient from './SuggestionDetailClient'

export default async function SuggestionDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; series?: string; cars?: string }>
}) {
  const { track: trackName, series: seriesName, cars: carsParam } = await searchParams

  if (!trackName) redirect('/drive/dashboard')

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

  const carClassNames = carsParam ? carsParam.split(',').map(c => c.trim()).filter(Boolean) : []

  // ── Fetch all user sessions ──────────────────────────────────────────────
  const allSessions = await db
    .select()
    .from(schema.raceSessions)
    .where(eq(schema.raceSessions.userId, dbUser.id))
    .orderBy(desc(schema.raceSessions.createdAt))

  // ── Track aggregate ──────────────────────────────────────────────────────
  const trackSessions = allSessions.filter(
    s => (s.trackName || '').toLowerCase() === trackName.toLowerCase(),
  )

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
  const trackMastery = masteryData.find(m => m.trackName.toLowerCase() === trackName.toLowerCase()) || null

  // Track stats
  const trackPositions = trackSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => s.finishPosition!)
  const trackTotalIncidents = trackSessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0)
  const trackTotalLaps = trackSessions.reduce((sum, s) => sum + ((s.metadata as any)?.completedLaps ?? 0), 0)
  const trackAvgPos = trackPositions.length > 0 ? trackPositions.reduce((a, b) => a + b, 0) / trackPositions.length : null
  const trackBestPos = trackPositions.length > 0 ? Math.min(...trackPositions) : null
  const trackAvgInc = trackSessions.length > 0 ? trackTotalIncidents / trackSessions.length : 0
  const trackWins = trackPositions.filter(p => p === 1).length
  const trackPodiums = trackPositions.filter(p => p <= 3).length

  // ── Series aggregate ─────────────────────────────────────────────────────
  const seriesSessions = seriesName
    ? allSessions.filter(s => {
        const meta = (s.metadata || {}) as Record<string, any>
        const sName = meta.seriesName || meta.series_name || ''
        return sName.toLowerCase() === seriesName.toLowerCase()
      })
    : []

  const seriesPositions = seriesSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => s.finishPosition!)
  const seriesTotalIncidents = seriesSessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0)
  const seriesAvgPos = seriesPositions.length > 0 ? seriesPositions.reduce((a, b) => a + b, 0) / seriesPositions.length : null
  const seriesBestPos = seriesPositions.length > 0 ? Math.min(...seriesPositions) : null
  const seriesWins = seriesPositions.filter(p => p === 1).length
  const seriesPodiums = seriesPositions.filter(p => p <= 3).length
  const seriesAvgInc = seriesSessions.length > 0 ? seriesTotalIncidents / seriesSessions.length : 0

  // Unique tracks in this series
  const seriesTracks = new Map<string, number>()
  for (const s of seriesSessions) {
    const t = s.trackName || 'Unknown'
    seriesTracks.set(t, (seriesTracks.get(t) || 0) + 1)
  }
  const seriesTrackList = [...seriesTracks.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  // ── Car aggregate ────────────────────────────────────────────────────────
  // Match sessions by checking if the session's carModel fuzzy-matches any car class name
  const carSessions = carClassNames.length > 0
    ? allSessions.filter(s => {
        const model = s.carModel.toLowerCase()
        return carClassNames.some(cn => {
          const cLow = cn.toLowerCase()
          return model.includes(cLow) || cLow.includes(model)
        })
      })
    : []

  const affinityData = computeCarAffinity(
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

  // Collect matching affinities for any car class
  const matchedAffinities = carClassNames.length > 0
    ? affinityData.filter(a =>
        carClassNames.some(cn => {
          const cLow = cn.toLowerCase()
          return a.manufacturer.toLowerCase().includes(cLow) ||
                 cLow.includes(a.manufacturer.toLowerCase()) ||
                 a.cars.some(c => c.carModel.toLowerCase().includes(cLow) || cLow.includes(c.carModel.toLowerCase()))
        }),
      )
    : []

  // Per-car stats
  const carStats = carClassNames.map(cn => {
    const sessions = allSessions.filter(s => s.carModel.toLowerCase().includes(cn.toLowerCase()) || cn.toLowerCase().includes(s.carModel.toLowerCase()))
    const positions = sessions.filter(s => s.finishPosition && s.finishPosition > 0).map(s => s.finishPosition!)
    const totalInc = sessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0)
    return {
      name: cn,
      totalRaces: sessions.length,
      avgPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
      bestPosition: positions.length > 0 ? Math.min(...positions) : null,
      wins: positions.filter(p => p === 1).length,
      avgIncidents: sessions.length > 0 ? totalInc / sessions.length : 0,
    }
  })

  // ── Fetch track map ──────────────────────────────────────────────────────
  let trackSvgPath: string | null = null
  let trackLogoSvg: string | null = null
  let trackDisplayName: string | null = null

  const maps = await db
    .select({
      trackName: schema.trackMaps.trackName,
      svgPath: schema.trackMaps.svgPath,
      logoSvg: schema.trackMaps.logoSvg,
      displayName: schema.trackMaps.displayName,
    })
    .from(schema.trackMaps)

  const match = maps.find(m => m.trackName.toLowerCase() === trackName.toLowerCase())
  if (match) {
    trackSvgPath = match.svgPath
    trackLogoSvg = match.logoSvg
    trackDisplayName = match.displayName
  }

  // ── Fetch brand logos for car classes ─────────────────────────────────────
  const brands = await db
    .select({
      brandKey: schema.carLogos.brandKey,
      brandName: schema.carLogos.brandName,
      logoSvg: schema.carLogos.logoSvg,
      logoPng: schema.carLogos.logoPng,
      brandColorHex: schema.carLogos.brandColorHex,
    })
    .from(schema.carLogos)

  const carBrandInfo = carClassNames.map(cn => {
    const ml = cn.toLowerCase()
    const b = brands.find(brand => ml.includes(brand.brandKey.toLowerCase()) || ml.includes(brand.brandName.toLowerCase()))
    return {
      name: cn,
      logoSrc: b?.logoSvg
        ? `data:image/svg+xml,${encodeURIComponent(b.logoSvg)}`
        : b?.logoPng
          ? `data:image/png;base64,${b.logoPng}`
          : null,
      brandColor: b?.brandColorHex || null,
      brandName: b?.brandName || null,
    }
  })

  const trackImageUrl = getTrackImage(trackName)
  const trackLocation = getTrackLocation(trackName)

  return (
    <SuggestionDetailClient
      trackName={trackName}
      trackDisplayName={trackDisplayName}
      trackSvgPath={trackSvgPath}
      trackLogoSvg={trackLogoSvg}
      trackImageUrl={trackImageUrl}
      trackLocation={trackLocation}
      seriesName={seriesName || null}
      carClassNames={carClassNames}
      trackData={{
        totalRaces: trackSessions.length,
        totalLaps: trackTotalLaps,
        avgPosition: trackAvgPos,
        bestPosition: trackBestPos,
        avgIncidents: trackAvgInc,
        wins: trackWins,
        podiums: trackPodiums,
        mastery: trackMastery
          ? { score: trackMastery.masteryScore, tier: trackMastery.masteryTier, trend: trackMastery.trend }
          : null,
      }}
      seriesData={{
        totalRaces: seriesSessions.length,
        avgPosition: seriesAvgPos,
        bestPosition: seriesBestPos,
        avgIncidents: seriesAvgInc,
        wins: seriesWins,
        podiums: seriesPodiums,
        tracks: seriesTrackList,
      }}
      carData={carStats}
      carBrandInfo={carBrandInfo}
    />
  )
}
