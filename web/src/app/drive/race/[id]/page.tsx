import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { db, schema } from '@/db'
import { eq, and, desc } from 'drizzle-orm'
import { getCarImage, getTrackImage } from '@/lib/commentary-images'
import { getTrackLocation } from '@/data/track-metadata'
import { generateRaceSummary } from '@/lib/race-summary'
import type {
  RaceSessionInput,
  LapTelemetryInput,
  SessionBehaviorInput,
  TrackHistoryInput,
  RatingContext,
} from '@/lib/race-summary'

import RaceDetailHero from './RaceDetailHero'
import RaceSummaryPanel from './RaceSummaryPanel'
import RaceDetailStats from './RaceDetailStats'
import CommentaryReplay from '../../debrief/CommentaryReplay'
import IncidentHeatmap from '../../components/IncidentHeatmap'

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: sessionId } = await params

  const session = await auth()
  if (!session?.user) redirect('/drive')

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string

  // ── Resolve user ────────────────────────────────────────────────────────────
  let dbUser: { id: string } | null = null
  if (discordId) {
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.discordId, discordId))
      .limit(1)
    if (users.length > 0) dbUser = users[0]
  }
  if (!dbUser) redirect('/drive')

  // ── Fetch the race session ──────────────────────────────────────────────────
  const sessions = await db
    .select()
    .from(schema.raceSessions)
    .where(
      and(
        eq(schema.raceSessions.id, sessionId),
        eq(schema.raceSessions.userId, dbUser.id),
      ),
    )
    .limit(1)

  if (sessions.length === 0) notFound()
  const raceSession = sessions[0]
  const meta = (raceSession.metadata || {}) as Record<string, any>

  // ── Find matching qualifying session ─────────────────────────────────────────
  // Look for a qualifying session at the same track within 8h before this race
  let qualifyingSession: typeof raceSession | null = null
  const sessionTypeLower = (raceSession.sessionType || '').toLowerCase()
  const isRaceType = !sessionTypeLower.includes('practice') && !sessionTypeLower.includes('qual')

  if (isRaceType && raceSession.trackName) {
    const qualCandidates = await db
      .select()
      .from(schema.raceSessions)
      .where(
        and(
          eq(schema.raceSessions.userId, dbUser.id),
          eq(schema.raceSessions.trackName, raceSession.trackName),
        ),
      )
      .orderBy(desc(schema.raceSessions.createdAt))
      .limit(20)

    const raceTime = raceSession.createdAt.getTime()
    for (const c of qualCandidates) {
      const cType = (c.sessionType || '').toLowerCase()
      const isQual = cType.includes('qual')
      const gap = raceTime - c.createdAt.getTime()
      if (isQual && gap > 0 && gap < 8 * 60 * 60 * 1000) {
        qualifyingSession = c
        break
      }
    }
  }

  // ── Fetch lap telemetry ─────────────────────────────────────────────────────
  const rawLaps = await db
    .select()
    .from(schema.lapTelemetry)
    .where(
      and(
        eq(schema.lapTelemetry.sessionId, sessionId),
        eq(schema.lapTelemetry.userId, dbUser.id),
      ),
    )
    .orderBy(schema.lapTelemetry.lapNumber)

  // ── Fetch session behavior ──────────────────────────────────────────────────
  const rawBehaviors = await db
    .select()
    .from(schema.sessionBehavior)
    .where(
      and(
        eq(schema.sessionBehavior.sessionId, sessionId),
        eq(schema.sessionBehavior.userId, dbUser.id),
      ),
    )
    .limit(1)
  const rawBehavior = rawBehaviors.length > 0 ? rawBehaviors[0] : null

  // ── Fetch track history (other sessions at this track) ──────────────────────
  let trackHistory: TrackHistoryInput | null = null
  if (raceSession.trackName) {
    const trackSessions = await db
      .select()
      .from(schema.raceSessions)
      .where(
        and(
          eq(schema.raceSessions.userId, dbUser.id),
          eq(schema.raceSessions.trackName, raceSession.trackName),
        ),
      )
      .orderBy(desc(schema.raceSessions.createdAt))

    const positions = trackSessions
      .filter(s => s.finishPosition && s.finishPosition > 0)
      .map(s => s.finishPosition!)

    trackHistory = {
      sessions: trackSessions.map(s => ({
        id: s.id,
        carModel: s.carModel,
        manufacturer: s.manufacturer,
        trackName: s.trackName,
        finishPosition: s.finishPosition,
        incidentCount: s.incidentCount,
        sessionType: s.sessionType,
        category: s.category,
        metadata: s.metadata as Record<string, any> | null,
        createdAt: s.createdAt,
      })),
      bestPosition: positions.length > 0 ? Math.min(...positions) : null,
      avgPosition: positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null,
      avgIncidents: trackSessions.reduce((sum, s) => sum + (s.incidentCount ?? 0), 0) / (trackSessions.length || 1),
      totalRaces: trackSessions.length,
    }
  }

  // ── Fetch track map data ────────────────────────────────────────────────────
  let trackSvgPath: string | null = null
  let trackLogoSvg: string | null = null
  let trackDisplayName: string | null = null
  let sectorBoundaries: number[] | undefined

  if (raceSession.trackName) {
    const trackKey = raceSession.trackName.toLowerCase()
    const maps = await db
      .select({
        trackName: schema.trackMaps.trackName,
        svgPath: schema.trackMaps.svgPath,
        logoSvg: schema.trackMaps.logoSvg,
        displayName: schema.trackMaps.displayName,
        sectorBoundaries: schema.trackMaps.sectorBoundaries,
      })
      .from(schema.trackMaps)

    const match = maps.find(m => m.trackName.toLowerCase() === trackKey)
    if (match) {
      trackSvgPath = match.svgPath
      trackLogoSvg = match.logoSvg
      trackDisplayName = match.displayName
      if (match.sectorBoundaries) {
        try { sectorBoundaries = JSON.parse(match.sectorBoundaries) } catch { /* skip */ }
      }
    }
  }

  // ── Fetch brand logo ────────────────────────────────────────────────────────
  let brandLogoSrc: string | null = null
  let brandColor: string | null = null
  let brandName: string | null = null

  if (raceSession.carModel) {
    const brands = await db
      .select({
        brandKey: schema.carLogos.brandKey,
        brandName: schema.carLogos.brandName,
        logoSvg: schema.carLogos.logoSvg,
        logoPng: schema.carLogos.logoPng,
        brandColorHex: schema.carLogos.brandColorHex,
      })
      .from(schema.carLogos)

    const ml = raceSession.carModel.toLowerCase()
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
  }

  // ── Imagery ─────────────────────────────────────────────────────────────────
  const carImageUrl = getCarImage(raceSession.carModel)
  const trackImageUrl = raceSession.trackName ? getTrackImage(raceSession.trackName) : null
  const trackLocation = raceSession.trackName ? getTrackLocation(raceSession.trackName) : null

  // ── Rating context ──────────────────────────────────────────────────────────
  const preRaceIR = meta.preRaceIRating ?? null
  const postRaceIR = meta.postRaceIRating ?? null
  const preRaceSR = meta.preRaceSR ?? null
  const postRaceSR = meta.postRaceSR ?? null

  const ratingCtx: RatingContext = {
    preRaceIRating: preRaceIR,
    postRaceIRating: postRaceIR,
    preRaceSR,
    postRaceSR,
    irDelta: preRaceIR != null && postRaceIR != null ? postRaceIR - preRaceIR : null,
    srDelta: preRaceSR != null && postRaceSR != null ? postRaceSR - preRaceSR : null,
  }

  // ── Map data to summary engine inputs ───────────────────────────────────────
  const sessionInput: RaceSessionInput = {
    id: raceSession.id,
    carModel: raceSession.carModel,
    manufacturer: raceSession.manufacturer,
    trackName: raceSession.trackName,
    finishPosition: raceSession.finishPosition,
    incidentCount: raceSession.incidentCount,
    sessionType: raceSession.sessionType,
    category: raceSession.category,
    metadata: meta,
    createdAt: raceSession.createdAt,
  }

  const lapsInput: LapTelemetryInput[] = rawLaps.map(l => ({
    lapNumber: l.lapNumber,
    lapTime: l.lapTime,
    sector1: l.sector1,
    sector2: l.sector2,
    sector3: l.sector3,
    incidentCount: l.incidentCount ?? 0,
    isCleanLap: l.isCleanLap,
    rageScore: l.rageScore,
    throttleAggression: l.throttleAggression,
    steeringErraticism: l.steeringErraticism,
    brakingAggression: l.brakingAggression,
    proximityChasing: l.proximityChasing,
  }))

  const behaviorInput: SessionBehaviorInput | null = rawBehavior ? {
    hardBrakingEvents: rawBehavior.hardBrakingEvents ?? 0,
    closePassCount: rawBehavior.closePassCount ?? 0,
    tailgatingSeconds: rawBehavior.tailgatingSeconds ?? 0,
    offTrackCount: rawBehavior.offTrackCount ?? 0,
    spinCount: rawBehavior.spinCount ?? 0,
    cleanLaps: rawBehavior.cleanLaps ?? 0,
    totalLaps: rawBehavior.totalLaps ?? 0,
    peakRageScore: rawBehavior.peakRageScore ?? 0,
    avgRageScore: rawBehavior.avgRageScore ?? 0,
    rageSpikes: rawBehavior.rageSpikes ?? 0,
    cooldownsTriggered: rawBehavior.cooldownsTriggered ?? 0,
    retaliationAttempts: rawBehavior.retaliationAttempts ?? 0,
    incidentsByPhase: (rawBehavior.incidentsByPhase as Record<string, number>) ?? null,
    incidentLocations: (rawBehavior.incidentLocations as SessionBehaviorInput['incidentLocations']) ?? null,
    commentaryLog: (rawBehavior.commentaryLog as SessionBehaviorInput['commentaryLog']) ?? null,
  } : null

  // ── Generate summary ────────────────────────────────────────────────────────
  const summary = generateRaceSummary(
    sessionInput,
    lapsInput,
    behaviorInput,
    trackHistory,
    ratingCtx,
  )

  // ── Commentary log for replay ───────────────────────────────────────────────
  const commentaryLog = behaviorInput?.commentaryLog ?? null

  // ── Incident locations for heatmap ──────────────────────────────────────────
  const incidentLocations = behaviorInput?.incidentLocations ?? []
  const heatmapIncidents = incidentLocations.reduce<
    Array<{ trackPosition: number; count: number; type?: string }>
  >((acc, loc) => {
    // Bucket to 5% intervals
    const bucket = Math.round(loc.trackPosition * 20) / 20
    const existing = acc.find(a => Math.abs(a.trackPosition - bucket) < 0.01)
    if (existing) {
      existing.count++
    } else {
      acc.push({ trackPosition: bucket, count: 1, type: loc.type })
    }
    return acc
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  const gameName = meta.gameName || 'iRacing'
  const completedLaps = meta.completedLaps ?? rawLaps.length
  const bestLapTime = meta.bestLapTime ?? summary.lapAnalysis.bestLapTime

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      {/* Hero */}
      <RaceDetailHero
        trackName={raceSession.trackName || 'Unknown Track'}
        trackDisplayName={trackDisplayName}
        carModel={raceSession.carModel}
        finishPosition={raceSession.finishPosition}
        fieldSize={meta.fieldSize ?? null}
        sessionType={raceSession.sessionType || raceSession.category}
        date={raceSession.createdAt.toISOString()}
        gameName={gameName}
        incidentCount={raceSession.incidentCount ?? 0}
        bestLapTime={bestLapTime}
        completedLaps={completedLaps}
        trackSvgPath={trackSvgPath}
        trackImageUrl={trackImageUrl}
        carImageUrl={carImageUrl}
        trackLogoSvg={trackLogoSvg}
        brandLogoSrc={brandLogoSrc}
        brandColor={brandColor}
        brandName={brandName}
        trackLocation={trackLocation}
        overallVerdict={summary.overallVerdict}
        headline={summary.headline}
        subheadline={summary.subheadline}
        irDelta={ratingCtx.irDelta}
        srDelta={ratingCtx.srDelta}
        qualifyingPosition={qualifyingSession?.finishPosition ?? null}
        qualifyingBestLap={((qualifyingSession?.metadata || {}) as Record<string, any>).bestLapTime ?? null}
      />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Qualifying detail card (if qualifying session exists) */}
        {qualifyingSession && (() => {
          const qMeta = (qualifyingSession.metadata || {}) as Record<string, any>
          const qBestLap = qMeta.bestLapTime as number | undefined
          const qPos = qualifyingSession.finishPosition
          const qIncidents = qualifyingSession.incidentCount ?? 0
          const qLaps = qMeta.completedLaps as number | undefined
          const raceBestLap = meta.bestLapTime ?? summary.lapAnalysis.bestLapTime
          const lapDelta = qBestLap && raceBestLap && qBestLap > 0 && raceBestLap > 0
            ? raceBestLap - qBestLap
            : null
          const posChange = qPos && qPos > 0 && raceSession.finishPosition && raceSession.finishPosition > 0
            ? qPos - raceSession.finishPosition
            : null

          const formatLap = (t: number | undefined | null): string => {
            if (!t || t <= 0) return '—'
            const m = Math.floor(t / 60)
            const sec = t - m * 60
            return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(3)
          }

          return (
            <div
              className="rounded-xl border overflow-hidden"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'hsla(45,60%,50%,0.2)',
              }}
            >
              <div className="px-5 py-3 border-b" style={{ borderColor: 'hsla(45,60%,50%,0.12)', background: 'hsla(45,60%,50%,0.04)' }}>
                <h2 className="text-sm font-bold text-amber-400/80 uppercase tracking-wider flex items-center gap-2">
                  Qualifying Session
                </h2>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Qualifying position */}
                  {qPos && qPos > 0 && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Grid Position</div>
                      <div className="text-2xl font-black text-amber-300" style={{ fontFamily: 'var(--ff-display)' }}>
                        P{qPos}
                      </div>
                    </div>
                  )}

                  {/* Qualifying best lap */}
                  {qBestLap && qBestLap > 0 && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Best Lap</div>
                      <div className="text-lg font-bold text-[var(--text)] tabular-nums" style={{ fontFamily: 'var(--ff-mono)' }}>
                        {formatLap(qBestLap)}
                      </div>
                    </div>
                  )}

                  {/* Positions gained/lost */}
                  {posChange !== null && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Race vs Grid</div>
                      <div className={`text-lg font-bold ${posChange > 0 ? 'text-emerald-400' : posChange < 0 ? 'text-rose-400' : 'text-[var(--text-dim)]'}`}>
                        {posChange > 0 ? `+${posChange} places` : posChange < 0 ? `${posChange} places` : 'Held position'}
                      </div>
                    </div>
                  )}

                  {/* Lap time delta (race vs qualifying) */}
                  {lapDelta !== null && (
                    <div>
                      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Race vs Quali Pace</div>
                      <div className={`text-lg font-bold tabular-nums ${lapDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`} style={{ fontFamily: 'var(--ff-mono)' }}>
                        {lapDelta <= 0 ? '' : '+'}{lapDelta.toFixed(3)}s
                      </div>
                    </div>
                  )}
                </div>

                {/* Extra context row */}
                <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
                  {qLaps && <span>{qLaps} laps</span>}
                  {qIncidents > 0 && <span>{qIncidents}x incidents</span>}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Summary: Strengths, Improvements, Track Context, Composure, Ratings */}
        <RaceSummaryPanel
          strengths={summary.strengths}
          improvements={summary.improvements}
          trackContext={summary.trackContext}
          composureReport={summary.composureReport}
          ratingImpact={summary.ratingImpact}
        />

        {/* Detailed Stats: Lap times, sectors, behavioral radar, rage timeline */}
        <RaceDetailStats
          laps={lapsInput.map(l => ({
            ...l,
            isCleanLap: l.isCleanLap ?? null,
          }))}
          behavior={behaviorInput ? {
            hardBrakingEvents: behaviorInput.hardBrakingEvents,
            closePassCount: behaviorInput.closePassCount,
            tailgatingSeconds: behaviorInput.tailgatingSeconds,
            offTrackCount: behaviorInput.offTrackCount,
            spinCount: behaviorInput.spinCount,
            cleanLaps: behaviorInput.cleanLaps,
            totalLaps: behaviorInput.totalLaps,
            peakRageScore: behaviorInput.peakRageScore,
            avgRageScore: behaviorInput.avgRageScore,
            rageSpikes: behaviorInput.rageSpikes,
            cooldownsTriggered: behaviorInput.cooldownsTriggered,
            retaliationAttempts: behaviorInput.retaliationAttempts,
            incidentsByPhase: behaviorInput.incidentsByPhase,
          } : null}
          lapAnalysis={summary.lapAnalysis}
        />

        {/* Incident Heatmap (if track SVG + incidents exist) */}
        {trackSvgPath && heatmapIncidents.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-3 flex items-center gap-2">
              Incident Heatmap
            </h2>
            <IncidentHeatmap
              svgPath={trackSvgPath}
              incidents={heatmapIncidents}
              sectorBoundaries={sectorBoundaries}
              trackName={trackDisplayName || raceSession.trackName || undefined}
              width={500}
              height={400}
            />
          </div>
        )}

        {/* Commentary Replay */}
        {commentaryLog && commentaryLog.length > 0 && (
          <CommentaryReplay commentaryLog={commentaryLog} />
        )}
      </div>
    </main>
  )
}
