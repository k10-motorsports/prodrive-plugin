import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'
import { getCarImage } from '@/lib/commentary-images'
import CarDetailClient from './CarDetailClient'

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name: encodedName } = await params
  const carModel = decodeURIComponent(encodedName)

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

  // ── Fetch all sessions with this car ──────────────────────────────────────
  const carSessions = await db
    .select()
    .from(schema.raceSessions)
    .where(eq(schema.raceSessions.userId, dbUser.id))
    .orderBy(desc(schema.raceSessions.createdAt))

  // Filter to matching car model
  const matchingSessions = carSessions.filter(s => s.carModel === carModel)
  if (matchingSessions.length === 0) notFound()

  // ── Fetch brand logo ──────────────────────────────────────────────────────
  let brandLogoSrc: string | null = null
  let brandColor: string | null = null
  let brandName: string | null = null

  const brands = await db
    .select({
      brandKey: schema.carLogos.brandKey,
      brandName: schema.carLogos.brandName,
      logoSvg: schema.carLogos.logoSvg,
      logoPng: schema.carLogos.logoPng,
      brandColorHex: schema.carLogos.brandColorHex,
    })
    .from(schema.carLogos)

  const ml = carModel.toLowerCase()
  for (const brand of brands) {
    const bk = brand.brandKey.toLowerCase()
    const bn = brand.brandName.toLowerCase()
    if (ml.includes(bk) || ml.includes(bn)) {
      brandLogoSrc = brand.logoSvg
        ? `data:image/svg+xml,${encodeURIComponent(brand.logoSvg)}`
        : brand.logoPng
          ? `data:image/png;base64,${brand.logoPng}`
          : null
      brandColor = brand.brandColorHex
      brandName = brand.brandName
      break
    }
  }

  // ── Rating history for this car ───────────────────────────────────────────
  const ratingHistory = await db
    .select()
    .from(schema.ratingHistory)
    .where(eq(schema.ratingHistory.userId, dbUser.id))
    .orderBy(desc(schema.ratingHistory.createdAt))

  const carRatingHistory = ratingHistory
    .filter(r => r.carModel === carModel)
    .map(r => ({
      date: r.createdAt.toISOString(),
      iRating: r.iRating,
      delta: r.prevIRating ? r.iRating - r.prevIRating : 0,
    }))
    .reverse()

  // ── Compute stats ─────────────────────────────────────────────────────────
  const positions = matchingSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => s.finishPosition!)

  const totalIncidents = matchingSessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0)
  const totalLaps = matchingSessions.reduce((sum, s) => sum + ((s.metadata as any)?.completedLaps ?? 0), 0)
  const avgPosition = positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null
  const avgIncidents = matchingSessions.length > 0 ? totalIncidents / matchingSessions.length : 0
  const wins = positions.filter(p => p === 1).length
  const podiums = positions.filter(p => p <= 3).length
  const cleanRaces = matchingSessions.filter(s => (s.incidentCount ?? 0) === 0).length

  // Position history
  const positionHistory = matchingSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => ({
      date: s.createdAt.toISOString(),
      position: s.finishPosition!,
      incidents: s.incidentCount ?? 0,
      trackName: s.trackName || 'Unknown',
    }))
    .reverse()

  // Tracks driven with this car
  const trackUsage = new Map<string, number>()
  for (const s of matchingSessions) {
    const t = s.trackName || 'Unknown'
    trackUsage.set(t, (trackUsage.get(t) || 0) + 1)
  }
  const tracksUsed = [...trackUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([track, count]) => ({ track, count }))

  const carImageUrl = getCarImage(carModel)

  // ── Sibling cars from same manufacturer ──────────────────────────────────
  const manufacturer = matchingSessions[0]?.manufacturer || brandName || null
  const siblingModels = new Map<string, { count: number; positions: number[]; incidents: number }>()

  if (manufacturer) {
    for (const s of carSessions) {
      // Match by manufacturer field or brand name appearing in the model
      const sameManuf = s.manufacturer && s.manufacturer.toLowerCase() === manufacturer.toLowerCase()
      const brandInModel = brandName && s.carModel.toLowerCase().includes(brandName.toLowerCase())
      if ((sameManuf || brandInModel) && s.carModel !== carModel) {
        const existing = siblingModels.get(s.carModel) || { count: 0, positions: [], incidents: 0 }
        existing.count++
        if (s.finishPosition && s.finishPosition > 0) existing.positions.push(s.finishPosition)
        existing.incidents += s.incidentCount ?? 0
        siblingModels.set(s.carModel, existing)
      }
    }
  }

  const siblingCars = [...siblingModels.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([model, data]) => ({
      carModel: model,
      totalRaces: data.count,
      avgPosition: data.positions.length > 0
        ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
        : null,
      wins: data.positions.filter(p => p === 1).length,
      avgIncidents: data.count > 0 ? data.incidents / data.count : 0,
      imageUrl: getCarImage(model),
    }))

  // ── Brand-level aggregate (this car + siblings) ──────────────────────────
  const allBrandSessions = manufacturer
    ? carSessions.filter(s => {
        const sameManuf = s.manufacturer && s.manufacturer.toLowerCase() === manufacturer.toLowerCase()
        const brandInModel = brandName && s.carModel.toLowerCase().includes(brandName.toLowerCase())
        return sameManuf || brandInModel
      })
    : matchingSessions

  const brandPositions = allBrandSessions
    .filter(s => s.finishPosition && s.finishPosition > 0)
    .map(s => s.finishPosition!)
  const brandTotalIncidents = allBrandSessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0)
  const brandStats = {
    totalRaces: allBrandSessions.length,
    totalCars: 1 + siblingCars.length,
    avgPosition: brandPositions.length > 0
      ? brandPositions.reduce((a, b) => a + b, 0) / brandPositions.length
      : null,
    wins: brandPositions.filter(p => p === 1).length,
    podiums: brandPositions.filter(p => p <= 3).length,
    avgIncidents: allBrandSessions.length > 0
      ? brandTotalIncidents / allBrandSessions.length
      : 0,
  }

  // Narrative
  let narrativeSummary: string
  if (matchingSessions.length === 1) {
    narrativeSummary = `You have driven the ${carModel} once. ${bestPosition && bestPosition <= 5 ? 'A promising start — keep building experience with this car.' : 'One session under your belt. Each race builds familiarity.'}`
  } else if (avgIncidents <= 2 && wins > 0) {
    narrativeSummary = `The ${carModel} is one of your cleanest, most successful cars — ${wins} win${wins !== 1 ? 's' : ''} with just ${avgIncidents.toFixed(1)} average incidents across ${matchingSessions.length} races.`
  } else if (avgPosition && avgPosition <= 5) {
    narrativeSummary = `You are competitive in the ${carModel} with an average finish of P${avgPosition.toFixed(1)} over ${matchingSessions.length} races. ${podiums} podium${podiums !== 1 ? 's' : ''} and counting.`
  } else {
    narrativeSummary = `You have ${matchingSessions.length} races in the ${carModel} with ${podiums} podium${podiums !== 1 ? 's' : ''} and an average finish of P${avgPosition?.toFixed(1) || '—'}.`
  }

  return (
    <CarDetailClient
      carModel={carModel}
      carImageUrl={carImageUrl}
      brandLogoSrc={brandLogoSrc}
      brandColor={brandColor}
      brandName={brandName}
      stats={{
        totalRaces: matchingSessions.length,
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
      irHistory={carRatingHistory}
      tracksUsed={tracksUsed}
      recentSessions={matchingSessions.map(s => ({
        id: s.id,
        trackName: s.trackName || 'Unknown',
        finishPosition: s.finishPosition,
        incidentCount: s.incidentCount ?? 0,
        sessionType: s.sessionType || s.category,
        date: s.createdAt.toISOString(),
        irDelta: ((s.metadata as any)?.postRaceIRating ?? null) !== null && ((s.metadata as any)?.preRaceIRating ?? null) !== null
          ? (s.metadata as any).postRaceIRating - (s.metadata as any).preRaceIRating
          : null,
      }))}
      narrativeSummary={narrativeSummary}
      siblingCars={siblingCars}
      brandStats={siblingCars.length > 0 ? brandStats : null}
      manufacturer={manufacturer}
    />
  )
}
