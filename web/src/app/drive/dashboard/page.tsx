import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { db, schema } from "@/db";
import { and, eq, gt, desc } from "drizzle-orm";
import { Download, BarChart3, Trophy, Shield } from "lucide-react";
import { resolveIRacingTrackId } from "@/data/iracing-track-map";
import RaceHistory from "./RaceHistory";
import RaceCalendarHeatmap, {
  type SessionDataPoint,
} from "./RaceCalendarHeatmap";
import RaceScatterGrid from "./RaceScatterGrid";
import DriverDNARadar from "./DriverDNARadar";
import SessionLengthCards from "./SessionLengthCards";

import IRatingTimeline, { type RatingHistoryPoint } from "./IRatingTimeline";
import DataManagement from "./DataManagement";
import WhenInsightsPanel from "./WhenInsightsPanel";
import DataStrip from "./DataStrip";
import RecentMoments from "./RecentMoments";
import { getCarImage, getTrackImage } from "@/lib/commentary-images";
import { computeWhenProfile, generateWhenInsights } from "@/lib/when-engine";
import { detectMoments, type Moment, type SessionRecord as MomentSession, type RatingRecord as MomentRating } from "@/lib/moments";
import NextRaceIdeas, { type RaceSuggestion as NRISuggestion, type StrategyType } from "./NextRaceIdeas";
import TopTracksAndCars from "./TopTracksAndCars";
import { computeNextRaceIdeas, type SessionInput, type RatingInput, type DriverRatingInput, type IRacingSchedule } from "@/lib/next-race-ideas";
import { computeTrackMastery, computeCarAffinity } from "@/lib/mastery";
import { fetchIRacingSchedule } from "@/lib/iracing-schedule-fetcher";

import type { BrandInfo } from '@/types/brand';

// ── Types ──────────────────────────────────────────────────────────────────────

type RaceSession = {
  id: string;
  carModel: string;
  manufacturer: string | null;
  trackName: string | null;
  finishPosition: number | null;
  incidentCount: number | null;
  sessionType: string | null;
  category: string;
  metadata: Record<string, any> | null;
  createdAt: Date;
};

type DisplayCard = {
  session: RaceSession;
  practiceSession?: RaceSession;
  qualifyingSession?: RaceSession;
};

const isPractice = (s: RaceSession) =>
  (s.sessionType || s.category || "").toLowerCase().includes("practice");

const isQualifying = (s: RaceSession) => {
  const t = (s.sessionType || s.category || "").toLowerCase();
  return t.includes("qualify") || t.includes("qual") || t === "qualifying";
};

const isRace = (s: RaceSession) => !isPractice(s) && !isQualifying(s);

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/drive");

  const user_ext = session.user as Record<string, unknown>;
  const discordId = user_ext.discordId as string;
  const displayName =
    (user_ext.discordDisplayName as string) || session.user.name || "Racer";

  // ── User + connection status ─────────────────────────────────────────────────
  let raceCount = 0;
  let dbUser: { id: string } | null = null;
  let isPluginConnected = false;
  let recentSessions: RaceSession[] = [];
  let allSessions: Array<typeof schema.raceSessions.$inferSelect> = [];

  if (discordId) {
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.discordId, discordId))
      .limit(1);

    if (users.length > 0) {
      dbUser = users[0];

      const activeTokens = await db
        .select()
        .from(schema.pluginTokens)
        .where(
          and(
            eq(schema.pluginTokens.userId, dbUser.id),
            eq(schema.pluginTokens.revoked, false),
            gt(schema.pluginTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);

      allSessions = await db
        .select()
        .from(schema.raceSessions)
        .where(eq(schema.raceSessions.userId, dbUser.id))
        .orderBy(desc(schema.raceSessions.createdAt));
      raceCount = allSessions.length;

      // Consider "connected" if: active plugin token, OR has any imported data
      // (from extension sync, JSON upload, or web import)
      const hasPluginToken = activeTokens.length > 0;
      const hasImportedData = allSessions.length > 0;
      const hasRatingData = await db
        .select({ id: schema.ratingHistory.id })
        .from(schema.ratingHistory)
        .where(eq(schema.ratingHistory.userId, dbUser.id))
        .limit(1);
      const hasDriverRatings = await db
        .select({ id: schema.driverRatings.id })
        .from(schema.driverRatings)
        .where(eq(schema.driverRatings.userId, dbUser.id))
        .limit(1);

      isPluginConnected = hasPluginToken || hasImportedData || hasRatingData.length > 0 || hasDriverRatings.length > 0;

      if (isPluginConnected) {
        recentSessions = allSessions.slice(0, 100) as RaceSession[]; // top 100 for card grouping
      }
    }
  }

  // ── Count empty sessions (0 laps, no best lap) ──────────────────────────────
  const emptySessionCount = recentSessions.filter(s => {
    const laps = s.metadata?.completedLaps as number | undefined
    const best = s.metadata?.bestLapTime as number | undefined
    return (!laps || laps <= 0) && (!best || best <= 0)
  }).length

  // ── Track maps + display names ───────────────────────────────────────────────
  let trackMapLookup: Record<string, string> = {};
  let trackLogoLookup: Record<string, string> = {};
  let trackDisplayNameLookup: Record<string, string> = {};
  let carImageLookup: Record<string, string | null> = {};
  let trackImageLookup: Record<string, string | null> = {};
  let brandLogoLookup: Record<string, BrandInfo> = {};

  if (isPluginConnected && recentSessions.length > 0) {
    // Track maps (svgPath + displayName + logo)
    const maps = await db
      .select({
        trackName: schema.trackMaps.trackName,
        svgPath: schema.trackMaps.svgPath,
        logoSvg: schema.trackMaps.logoSvg,
        displayName: schema.trackMaps.displayName,
      })
      .from(schema.trackMaps);

    maps.forEach((m) => {
      const key = m.trackName.toLowerCase();
      trackMapLookup[key] = m.svgPath;
      if (m.logoSvg) trackLogoLookup[key] = m.logoSvg;
      if (m.displayName) trackDisplayNameLookup[key] = m.displayName;
    });

    // Car images (commentary data)
    const carModels = [
      ...new Set(recentSessions.map((s) => s.carModel).filter(Boolean)),
    ];
    carModels.forEach((c) => {
      if (c) carImageLookup[c] = getCarImage(c);
    });

    const trackNames = [
      ...new Set(recentSessions.map((s) => s.trackName).filter(Boolean)),
    ];
    trackNames.forEach((t) => {
      if (t) trackImageLookup[t] = getTrackImage(t);
    });

    // Brand logos — match by carModel substring since manufacturer field is not yet populated.
    // For each unique carModel, try each brand's key/name as a substring match.
    const uniqueCarModels = [
      ...new Set(recentSessions.map((s) => s.carModel).filter(Boolean)),
    ];
    if (uniqueCarModels.length > 0) {
      const brands = await db
        .select({
          brandKey: schema.carLogos.brandKey,
          brandName: schema.carLogos.brandName,
          logoSvg: schema.carLogos.logoSvg,
          logoPng: schema.carLogos.logoPng,
          brandColorHex: schema.carLogos.brandColorHex,
        })
        .from(schema.carLogos);

      for (const carModel of uniqueCarModels) {
        if (!carModel) continue;
        const ml = carModel.toLowerCase();
        for (const brand of brands) {
          const bk = brand.brandKey.toLowerCase();
          const bn = brand.brandName.toLowerCase();
          if (ml.includes(bk) || ml.includes(bn)) {
            brandLogoLookup[carModel] = {
              logoSvg: brand.logoSvg,
              logoPng: brand.logoPng,
              brandColorHex: brand.brandColorHex,
              manufacturerName: brand.brandName,
            };
            break; // use first match; brandKey entries are ordered by specificity
          }
        }
      }
    }
  }

  // ── iRating history (full, per-category) ──────────────────────────────────────
  let iRatingHistory: number[] = [];
  let iRatingByCategory: { category: string; iRating: number }[] = [];
  let iRatingFullHistory: { category: string; iRating: number; createdAt: string }[] = [];
  if (isPluginConnected && dbUser) {
    const allHistory = await db
      .select({
        category: schema.ratingHistory.category,
        iRating: schema.ratingHistory.iRating,
        createdAt: schema.ratingHistory.createdAt,
      })
      .from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, dbUser.id))
      .orderBy(desc(schema.ratingHistory.createdAt));

    // Full history for the timeline chart (serialise dates)
    iRatingFullHistory = allHistory.map(r => ({
      category: r.category,
      iRating: r.iRating,
      createdAt: r.createdAt.toISOString(),
    }));

    // Legacy sparkline (cross-category, last 100)
    iRatingHistory = allHistory.slice(0, 100).map(h => h.iRating).reverse();

    // Latest iRating per category
    const seen = new Set<string>();
    for (const row of allHistory) {
      if (!seen.has(row.category)) {
        seen.add(row.category);
        iRatingByCategory.push({ category: row.category, iRating: row.iRating });
      }
    }
  }

  // ── When-engine insights ────────────────────────────────────────────────────
  let whenInsights: { type: 'positive' | 'negative' | 'neutral'; text: string }[] = []
  let safetyRatingByCategory: { category: string; safetyRating: string; license: string }[] = []
  if (isPluginConnected && dbUser && allSessions.length >= 5) {
    const fullRatingHistory = await db
      .select()
      .from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, dbUser.id))
      .orderBy(desc(schema.ratingHistory.createdAt))

    const profile = computeWhenProfile(
      JSON.parse(JSON.stringify(allSessions)),
      JSON.parse(JSON.stringify(fullRatingHistory)),
    )
    whenInsights = generateWhenInsights(profile)

    // Latest safety rating + license per category
    const seenSR = new Set<string>()
    for (const row of fullRatingHistory) {
      if (!seenSR.has(row.category) && row.license !== 'R') {
        seenSR.add(row.category)
        safetyRatingByCategory.push({
          category: row.category,
          safetyRating: row.safetyRating,
          license: row.license,
        })
      }
    }
  }

  // Backfill safety ratings from driverRatings (ground truth from extension sidebar)
  if (isPluginConnected && dbUser) {
    const driverRatingsRows = await db
      .select()
      .from(schema.driverRatings)
      .where(eq(schema.driverRatings.userId, dbUser.id))

    const existingSRCategories = new Set(safetyRatingByCategory.map(s => s.category))
    for (const dr of driverRatingsRows) {
      if (dr.license !== 'R' && dr.safetyRating !== '0.00') {
        if (!existingSRCategories.has(dr.category)) {
          // Add missing categories
          safetyRatingByCategory.push({
            category: dr.category,
            safetyRating: dr.safetyRating,
            license: dr.license,
          })
        } else {
          // Override placeholder values from ratingHistory
          const existing = safetyRatingByCategory.find(s => s.category === dr.category)
          if (existing && (existing.license === 'R' || existing.safetyRating === '0.00')) {
            existing.safetyRating = dr.safetyRating
            existing.license = dr.license
          }
        }
      }
    }
  }

  // ── Moments ─────────────────────────────────────────────────────────────────
  let recentMoments: Moment[] = []
  let momentHighlights: Moment[] = []
  if (isPluginConnected && dbUser && allSessions.length > 0) {
    const fullRH = await db
      .select()
      .from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, dbUser.id))
      .orderBy(desc(schema.ratingHistory.createdAt))

    const momentSessions: MomentSession[] = allSessions.map(s => ({
      id: s.id,
      carModel: s.carModel,
      trackName: s.trackName || 'Unknown Track',
      finishPosition: s.finishPosition || undefined,
      incidentCount: s.incidentCount || 0,
      metadata: s.metadata ? (typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata) as MomentSession['metadata'] : undefined,
      createdAt: s.createdAt,
      gameName: s.gameName || 'iracing',
      sessionType: s.sessionType || 'race',
    }))

    const momentRatings: MomentRating[] = fullRH.map(r => ({
      iRating: r.iRating,
      prevIRating: r.prevIRating ?? 0,
      prevLicense: r.prevLicense || undefined,
      license: r.license,
      createdAt: r.createdAt,
    }))

    const allMoments = detectMoments(momentSessions, momentRatings)
    // Top 5 by significance (detectMoments returns significance-sorted)
    momentHighlights = allMoments.slice(0, 5)
    // Sort by date desc for "latest 20"
    recentMoments = [...allMoments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
  }

  // ── Next Race Ideas ────────────────────────────────────────────────────────
  let nextRaceSuggestions: NRISuggestion[] = []
  if (isPluginConnected && dbUser && allSessions.length >= 3) {
    try {
      // Fetch schedule data from week planner
      const scheduleData = await fetchIRacingSchedule()

      if (scheduleData.length > 0) {

        // Fetch full rating history with all fields needed by scoring engine
        const nriRatingHistory = await db
          .select()
          .from(schema.ratingHistory)
          .where(eq(schema.ratingHistory.userId, dbUser.id))
          .orderBy(desc(schema.ratingHistory.createdAt))

        // Fetch current driver ratings
        const nriDriverRatings = await db
          .select()
          .from(schema.driverRatings)
          .where(eq(schema.driverRatings.userId, dbUser.id))

        // Map to scoring engine input types
        const sessionInputs: SessionInput[] = allSessions.map(s => ({
          id: s.id,
          carModel: s.carModel,
          manufacturer: s.manufacturer,
          category: s.category,
          gameName: s.gameName || 'iracing',
          trackName: s.trackName,
          sessionType: s.sessionType,
          finishPosition: s.finishPosition,
          incidentCount: s.incidentCount,
          metadata: s.metadata ? (typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata) as SessionInput['metadata'] : null,
          createdAt: s.createdAt,
        }))

        const ratingInputs: RatingInput[] = nriRatingHistory.map(r => ({
          category: r.category,
          iRating: r.iRating,
          safetyRating: r.safetyRating,
          license: r.license,
          prevIRating: r.prevIRating,
          prevSafetyRating: r.prevSafetyRating,
          prevLicense: r.prevLicense,
          trackName: r.trackName,
          carModel: r.carModel,
          createdAt: r.createdAt,
        }))

        const driverRatingInputs: DriverRatingInput[] = nriDriverRatings.map(dr => ({
          category: dr.category,
          iRating: dr.iRating,
          safetyRating: dr.safetyRating,
          license: dr.license,
        }))

        // Determine which categories the user actually races.
        // From sessions: any category with at least one race.
        // From driver ratings: only categories where the driver has
        // actually raced (iRating > 0 and license above Rookie).
        // The extension scrapes ALL 5 license categories from the
        // sidebar, but categories with iRating 0 / Rookie license
        // mean the driver has never competed there.
        const activeCategories = [...new Set([
          ...sessionInputs.map(s => s.category),
          ...driverRatingInputs
            .filter(dr => dr.iRating > 0 || dr.license !== 'R')
            .map(dr => dr.category),
        ])]
        // Always include 'formula' alongside 'road' — iRacing merged
        // sports_car into road, and the JSON import predates formula detection,
        // so formula sessions may be tagged as road. Once re-imported this
        // is a no-op (formula will already be in the set).
        if (activeCategories.includes('road') && !activeCategories.includes('formula')) {
          activeCategories.push('formula')
        }

        const rawSuggestions = computeNextRaceIdeas(
          sessionInputs,
          ratingInputs,
          driverRatingInputs,
          scheduleData,
          activeCategories,
        )

        // Map to component display type with serialized dates
        nextRaceSuggestions = rawSuggestions.map(s => ({
          seriesName: s.seriesName,
          trackName: s.trackName,
          trackConfig: s.trackConfig ?? undefined,
          category: s.category,
          license: s.licenseClass,
          official: s.isOfficial,
          fixed: s.isFixed,
          score: s.score,
          strategy: s.strategy.type as StrategyType,
          commentary: s.commentary,
          startsAtUtc: s.nextStartTime.toISOString(),
          carClassNames: s.carClassNames,
          seasonId: s.seasonId,
          seriesId: s.seriesId,
        }))

        // Populate image/brand lookups for suggested race tracks & car classes
        // so the hero card can find them (existing lookups are keyed by session data)
        const nriBrands = await db
          .select({
            brandKey: schema.carLogos.brandKey,
            brandName: schema.carLogos.brandName,
            logoSvg: schema.carLogos.logoSvg,
            logoPng: schema.carLogos.logoPng,
            brandColorHex: schema.carLogos.brandColorHex,
          })
          .from(schema.carLogos)

        // Build a set of unique car models the driver has raced
        const driverCarModels = [...new Set(sessionInputs.map(s => s.carModel).filter(Boolean))]

        for (const s of rawSuggestions) {
          // Track images keyed by schedule track name
          if (!trackImageLookup[s.trackName]) {
            trackImageLookup[s.trackName] = getTrackImage(s.trackName)
          }
          // For each car class, find driver car models that belong to it
          // and populate brand/image lookups keyed by class name
          for (const className of s.carClassNames) {
            if (!carImageLookup[className]) {
              carImageLookup[className] = getCarImage(className)
            }
            // iRacing uses alternate manufacturer names in class/series names
            // e.g. "Global Mazda MX-5 Cup" where "Global" = Mazda
            const IRACING_BRAND_ALIASES: Record<string, string> = {
              'global': 'mazda',
              'mx-5': 'mazda',
              'mx5': 'mazda',
              'miata': 'mazda',
              'dallara': 'dallara',
              'riley': 'riley',
            }
            let cl = className.toLowerCase()
            for (const [alias, realBrand] of Object.entries(IRACING_BRAND_ALIASES)) {
              if (cl.includes(alias)) {
                cl = cl.replace(alias, realBrand)
                break
              }
            }

            // Try matching driver's actual car models to this class for brand lookup
            if (!brandLogoLookup[className]) {
              // First: if the class name contains a brand name directly (e.g. "Mazda MX-5 Cup"),
              // use that brand — no need to cross-reference driver car models
              for (const brand of nriBrands) {
                const bk = brand.brandKey.toLowerCase()
                const bn = brand.brandName.toLowerCase()
                if (cl.includes(bn) || cl.includes(bk)) {
                  brandLogoLookup[className] = {
                    logoSvg: brand.logoSvg,
                    logoPng: brand.logoPng,
                    brandColorHex: brand.brandColorHex,
                    manufacturerName: brand.brandName,
                  }
                  break
                }
              }

              // Second: cross-reference driver car models, but skip generic tokens
              // like "cup", "gt", "open", "pro" that appear across many series
              if (!brandLogoLookup[className]) {
                const GENERIC_TOKENS = new Set(['cup', 'gt', 'gt3', 'gt4', 'gte', 'lmp', 'open', 'pro', 'sr', 'series', 'spec', 'super', 'tour', 'touring'])
                const classTokens = cl.replace(/class/g, '').trim().split(/\s+/).filter(t => t.length > 2 && !GENERIC_TOKENS.has(t))
                if (classTokens.length > 0) {
                  for (const carModel of driverCarModels) {
                    const ml = carModel.toLowerCase()
                    for (const brand of nriBrands) {
                      const bk = brand.brandKey.toLowerCase()
                      const bn = brand.brandName.toLowerCase()
                      if (ml.includes(bk) || ml.includes(bn)) {
                        const modelMatches = classTokens.some(t => ml.includes(t))
                        if (modelMatches) {
                          brandLogoLookup[className] = {
                            logoSvg: brand.logoSvg,
                            logoPng: brand.logoPng,
                            brandColorHex: brand.brandColorHex,
                            manufacturerName: brand.brandName,
                          }
                          break
                        }
                      }
                    }
                    if (brandLogoLookup[className]) break
                  }
                }
              }
            }
            // Fallback: direct class name to brand match (reuses alias-resolved cl)
            if (!brandLogoLookup[className]) {
              for (const brand of nriBrands) {
                const bk = brand.brandKey.toLowerCase()
                const bn = brand.brandName.toLowerCase()
                if (cl.includes(bk) || cl.includes(bn)) {
                  brandLogoLookup[className] = {
                    logoSvg: brand.logoSvg,
                    logoPng: brand.logoPng,
                    brandColorHex: brand.brandColorHex,
                    manufacturerName: brand.brandName,
                  }
                  break
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[dashboard] Next Race Ideas computation failed:', err)
      // If NRI fails, we continue gracefully — the dashboard still works,
      // just without suggestions. The error is logged for debugging.
    }
  }

  // ── Visualization data (all sessions + rating deltas) ───────────────────────
  let vizData: SessionDataPoint[] = [];
  let dnaSessionData: { finishPosition: number | null; incidentCount: number | null; metadata: Record<string, any> | null; carModel: string; trackName: string | null; gameName: string | null; createdAt: string }[] = [];
  let dnaRatingData: { iRating: number; prevIRating: number | null; createdAt: string }[] = [];
  if (isPluginConnected && dbUser) {
    // Build a map of rating history entries by (trackName + createdAt) for matching
    const allRatingHistory = await db
      .select({
        iRating: schema.ratingHistory.iRating,
        prevIRating: schema.ratingHistory.prevIRating,
        safetyRating: schema.ratingHistory.safetyRating,
        prevSafetyRating: schema.ratingHistory.prevSafetyRating,
        trackName: schema.ratingHistory.trackName,
        createdAt: schema.ratingHistory.createdAt,
      })
      .from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, dbUser.id))
      .orderBy(desc(schema.ratingHistory.createdAt));

    // Index rating history by date (within 30 min of a session)
    const ratingByDate = new Map<
      string,
      { irDelta: number; srDelta: number }
    >();
    for (const rh of allRatingHistory) {
      const irDelta = rh.prevIRating != null ? rh.iRating - rh.prevIRating : 0;
      const srDelta =
        rh.prevSafetyRating != null
          ? parseFloat(rh.safetyRating) - parseFloat(rh.prevSafetyRating)
          : 0;
      // Key by ISO date string for fuzzy matching
      const key = rh.createdAt.toISOString();
      ratingByDate.set(key, { irDelta, srDelta });
    }

    // For each race session, find closest rating history entry
    const allSessionRows = await db
      .select()
      .from(schema.raceSessions)
      .where(eq(schema.raceSessions.userId, dbUser.id));

    for (const s of allSessionRows) {
      // Find the closest rating history entry (within 30 minutes)
      let bestMatch: { irDelta: number; srDelta: number } | null = null;
      let bestDist = 30 * 60 * 1000; // 30 min threshold
      const sessionTime = s.createdAt.getTime();

      for (const rh of allRatingHistory) {
        const dist = Math.abs(rh.createdAt.getTime() - sessionTime);
        const rhTrackId = resolveIRacingTrackId(rh.trackName || '')
        const sTrackId = resolveIRacingTrackId(s.trackName || '')
        if (dist < bestDist && rhTrackId === sTrackId) {
          bestDist = dist;
          bestMatch = {
            irDelta: rh.prevIRating != null ? rh.iRating - rh.prevIRating : 0,
            srDelta:
              rh.prevSafetyRating != null
                ? parseFloat(rh.safetyRating) - parseFloat(rh.prevSafetyRating)
                : 0,
          };
        }
      }

      vizData.push({
        date: s.createdAt.toISOString(),
        iRatingDelta: bestMatch?.irDelta ?? 0,
        srDelta: bestMatch?.srDelta ?? 0,
        incidents: (s.incidentCount as number) ?? 0,
      });
    }

    // ── Driver DNA data (serialized for client component) ──────────────────────
    dnaSessionData = recentSessions.map((s) => ({
      finishPosition: s.finishPosition,
      incidentCount: s.incidentCount,
      metadata: s.metadata,
      carModel: s.carModel,
      trackName: s.trackName,
      gameName: (s.metadata as Record<string, any>)?.gameName ?? null,
      createdAt: new Date(s.createdAt).toISOString(),
    }));

    dnaRatingData = allRatingHistory.map((r) => ({
      iRating: r.iRating,
      prevIRating: r.prevIRating ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── Group practice sessions into the race that immediately followed them ─────
  // Two-pass approach:
  //   Pass 1 — scan ASC, pre-mark which practices are claimed by a race.
  //   Pass 2 — build groups, skipping consumed practices.
  // This prevents practices from being emitted as standalone before the backward
  // scan of the subsequent race has a chance to claim them.

  // Helper: resolve a session's track to a canonical trackId for comparison.
  // iRacing sends inconsistent names ("mexicocity gp" vs "Autódromo Hermanos Rodríguez")
  // so we normalize via metadata.prodriveTrackId or resolveIRacingTrackId.
  const sessionTrackId = (s: RaceSession): string => {
    const meta = s.metadata as Record<string, unknown> | null
    if (meta?.prodriveTrackId && typeof meta.prodriveTrackId === 'string') {
      return meta.prodriveTrackId
    }
    return resolveIRacingTrackId(s.trackName || '', (meta?.iracingTrackConfig as string) || undefined)
  }

  const sortedAsc = [...recentSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const consumedIds = new Set<string>();
  const practiceForRace = new Map<string, RaceSession>(); // raceId → its paired practice
  const qualifyingForRace = new Map<string, RaceSession>(); // raceId → its paired qualifying

  // Pass 1: pair each race with the immediately preceding practice/qualifying on the same track
  for (let i = 0; i < sortedAsc.length; i++) {
    const s = sortedAsc[i];
    if (!isRace(s)) continue;

    const sTrackId = sessionTrackId(s);

    // Scan backward for unclaimed practice and qualifying within 8h
    for (let j = i - 1; j >= 0; j--) {
      const prev = sortedAsc[j];
      if (consumedIds.has(prev.id)) continue;
      const gapMs =
        new Date(s.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (gapMs >= 8 * 60 * 60 * 1000) break; // too far back
      if (sessionTrackId(prev) !== sTrackId) continue;

      if (isQualifying(prev) && !qualifyingForRace.has(s.id)) {
        qualifyingForRace.set(s.id, prev);
        consumedIds.add(prev.id);
      } else if (isPractice(prev) && !practiceForRace.has(s.id)) {
        practiceForRace.set(s.id, prev);
        consumedIds.add(prev.id);
      }
      // Keep scanning — a race might have both practice + qualifying before it
    }
  }

  // Pass 2: build display groups — consumed sessions are silently dropped
  const groups: DisplayCard[] = [];
  for (const s of sortedAsc) {
    if (consumedIds.has(s.id)) continue;
    groups.push(
      isRace(s)
        ? { session: s, practiceSession: practiceForRace.get(s.id), qualifyingSession: qualifyingForRace.get(s.id) }
        : { session: s }, // standalone practice or qualifying
    );
  }

  // Most recent first
  const displayCards = groups.reverse();

  const hasEnoughData = raceCount >= 5;

  // ── Career summary stats ────────────────────────────────────────────────────
  const careerStats = (() => {
    const totalLaps = allSessions.reduce((sum, s) => {
      const meta = (s.metadata as Record<string, any>) || {};
      return sum + ((meta.completedLaps as number) || 0);
    }, 0);
    const uniqueTracks = new Set(allSessions.map(s => s.trackName).filter(Boolean)).size;
    const uniqueCars = new Set(allSessions.map(s => s.carModel).filter(Boolean)).size;
    const uniqueGames = new Set(allSessions.map(s => s.gameName).filter(Boolean)).size;
    let careerSpan: string | null = null;
    if (allSessions.length > 1) {
      const oldest = new Date(allSessions[allSessions.length - 1].createdAt);
      const newest = new Date(allSessions[0].createdAt);
      const diffDays = Math.floor((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 30) careerSpan = `${diffDays}d`;
      else if (diffDays < 365) careerSpan = `${Math.floor(diffDays / 30)}mo`;
      else {
        const y = Math.floor(diffDays / 365);
        const m = Math.floor((diffDays % 365) / 30);
        careerSpan = m > 0 ? `${y}y ${m}mo` : `${y}y`;
      }
    }

    return { totalLaps, uniqueTracks, uniqueCars, uniqueGames, careerSpan };
  })();

  // ── Track mastery + car affinity (top 3 for sidebar) ─────────────────────────
  const masterySessions = allSessions.map(s => ({
    ...s,
    manufacturer: s.manufacturer || '',
    incidentCount: s.incidentCount ?? 0,
    metadata: (s.metadata ?? null) as Record<string, any> | null,
    gameName: ((s.metadata as Record<string, any>)?.gameName as string) || s.gameName || 'Unknown',
  }))
  const trackMasteryList = computeTrackMastery(masterySessions as any)
  const carAffinityList = computeCarAffinity(masterySessions as any)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const trackKey = (name: string | null) => (name || "").toLowerCase();

  return (
    <main className="min-h-screen relative">
      {isPluginConnected && allSessions.length > 0 && (
        <DataStrip
          displayName={displayName}
          raceCount={raceCount}
          totalLaps={careerStats.totalLaps}
          iRatingByCategory={iRatingByCategory}
          safetyRatingByCategory={safetyRatingByCategory}
          careerSpan={careerStats.careerSpan}
          uniqueGames={careerStats.uniqueGames}
          uniqueTracks={careerStats.uniqueTracks}
          uniqueCars={careerStats.uniqueCars}
          iRatingHistory={iRatingFullHistory}
          insights={whenInsights}
        />
      )}
      <div className="max-w-[120rem] mx-auto px-6 py-6">
        {isPluginConnected ? (
          <>
            {/* Dashboard top grid — suggested races + viz left, moments + session length right */}
            {(nextRaceSuggestions.length > 0 || recentMoments.length > 0 || vizData.length > 0) && (
              <section className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] lg:grid-cols-[3fr_1fr] gap-4">
                  {/* ── Left column ── */}
                  <div className="flex flex-col gap-4">
                    {nextRaceSuggestions.length > 0 && (
                      <NextRaceIdeas
                        suggestions={nextRaceSuggestions}
                        lookups={{
                          trackMapLookup,
                          trackLogoLookup,
                          trackImageLookup,
                          trackDisplayNameLookup,
                          carImageLookup,
                          brandLogoLookup,
                        }}
                      />
                    )}
                    {vizData.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <RaceCalendarHeatmap sessions={vizData} />
                        <RaceScatterGrid sessions={vizData} />
                        <DriverDNARadar sessions={dnaSessionData} ratingHistory={dnaRatingData} />
                      </div>
                    )}
                    {vizData.length > 0 && (
                      <SessionLengthCards sessions={dnaSessionData} />
                    )}
                    {/* Race History — card grid / list toggle */}
                    <RaceHistory
                      displayCards={displayCards}
                      lookups={{
                        trackMapLookup,
                        carImageLookup,
                        trackImageLookup,
                        trackLogoLookup,
                        trackDisplayNameLookup,
                        brandLogoLookup,
                        iRatingHistory,
                      }}
                    />
                  </div>
                  {/* ── Right column ── */}
                  <div className="flex flex-col gap-4">
                    {(trackMasteryList.length > 0 || carAffinityList.length > 0) && (
                      <TopTracksAndCars
                        tracks={trackMasteryList}
                        cars={carAffinityList}
                        trackMapLookup={trackMapLookup}
                        trackDisplayNameLookup={trackDisplayNameLookup}
                        brandLogoLookup={brandLogoLookup}
                      />
                    )}
                    {(recentMoments.length > 0 || momentHighlights.length > 0) && (
                      <RecentMoments
                        moments={recentMoments}
                        highlights={momentHighlights}
                        trackMapLookup={trackMapLookup}
                        trackLogoLookup={trackLogoLookup}
                        trackDisplayNameLookup={trackDisplayNameLookup}
                        brandLogoLookup={brandLogoLookup}
                        compact
                      />
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Empty state: plugin connected but all data sources are empty */}
            {isPluginConnected && raceCount > 0 && nextRaceSuggestions.length === 0 && recentMoments.length === 0 && vizData.length === 0 && (
              <section className="mb-6 p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  Insights and visualizations will appear as you record more sessions.
                </p>
              </section>
            )}

            {/* iRating timeline + career summary replaced by DataStrip sparklines */}

            {/* Data Management (collapsible) */}
            {isPluginConnected && raceCount > 0 && (
              <DataManagement totalSessions={raceCount} emptySessions={emptySessionCount} />
            )}

            {/* Pro Features */}
            {!hasEnoughData && (
              <section className="mb-6">
                <h2
                  className="font-bold mb-2 flex items-center gap-2"
                  style={{ fontSize: "var(--fs-2xl)", fontFamily: "var(--ff-display)" }}
                >
                  <Shield size={24} className="text-[var(--border-accent)]" />
                  Pro Features
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "AI Commentary", icon: "🎙️" },
                    { label: "Incidents Panel", icon: "⚠️" },
                    { label: "Virtual Spotter", icon: "👁️" },
                    { label: "Live Leaderboard", icon: "🏆" },
                    { label: "Datastream", icon: "📊" },
                    { label: "WebGL Effects", icon: "✨" },
                    { label: "Reflections", icon: "🔮" },
                    { label: "Module Config", icon: "⚙️" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-center"
                    >
                      <div className="text-lg mb-1">{f.icon}</div>
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        {f.label}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  All Pro features are unlocked when your overlay is connected
                  to your Pro Drive account.
                </p>
              </section>
            )}
            {/* Download link */}
            <section className="text-center">
              <a
                href="/api/download/latest"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors"
              >
                <Download size={24} />
                Need to reinstall? Download RaceCor.io Overlay
              </a>
            </section>

            <footer className="mt-16 pt-6 border-t border-[var(--border)] text-center">
              <a
                href={SITE_URL}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors"
              >
                &larr; Back to {SITE_NAME}
              </a>
            </footer>
          </>
        ) : (
          <>
            {/* Not Connected */}
            <section className="mb-6">
              <h1
                className="text-3xl font-black mb-2"
                style={{ fontFamily: "var(--ff-display)" }}
              >
                Welcome, {displayName}
              </h1>
              <p className="text-[var(--text-dim)] mb-6">
                Download the RaceCor overlay, connect it to your Pro Drive
                account, and start racing. Your performance data will appear
                here automatically.
              </p>
              <a
                href="/api/download/latest"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--k10-red)] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition"
              >
                <Download size={24} />
                Download RaceCor Overlay
              </a>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Windows installer &mdash; includes SimHub plugin and dashboard
                overlay
              </p>
            </section>

            <section className="mb-12 p-6 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
              <h2 className="font-bold mb-4" style={{ fontSize: "var(--fs-2xl)", fontFamily: "var(--ff-display)" }}>
                Get Connected
              </h2>
              <ol className="space-y-3 text-sm text-[var(--text-dim)]">
                {[
                  "Install the RaceCor overlay using the download above",
                  "Launch the overlay and open Settings (Ctrl+Shift+S)",
                  <>
                    Go to the <strong>Connections</strong> tab and click{" "}
                    <strong>Connect to Pro Drive</strong>
                  </>,
                  "You'll be redirected here to authorize, then the overlay unlocks all Pro features",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--k10-red)] text-white text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mb-6">
              <h2
                className="font-bold mb-2 flex items-center gap-2"
                style={{ fontSize: "var(--fs-2xl)", fontFamily: "var(--ff-display)" }}
              >
                <BarChart3 size={24} className="text-[var(--border-accent)]" />
                Performance
              </h2>
              {hasEnoughData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Races
                    </div>
                    <div className="text-2xl font-black">{raceCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Charts
                    </div>
                    <div className="text-sm text-[var(--text-dim)]">
                      Coming soon
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Trends
                    </div>
                    <div className="text-sm text-[var(--text-dim)]">
                      Coming soon
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-center">
                  <Trophy
                    size={32}
                    className="mx-auto mb-3 text-[var(--text-muted)]"
                  />
                  <p className="text-sm text-[var(--text-dim)] mb-1">
                    {raceCount === 0
                      ? "No race data yet"
                      : `${raceCount} of 5 races recorded`}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Complete at least 5 races to unlock charts and trends.
                  </p>
                </div>
              )}
            </section>

            <section>
              <h2
                className="font-bold mb-2 flex items-center gap-2"
                style={{ fontSize: "var(--fs-2xl)", fontFamily: "var(--ff-display)" }}
              >
                <Shield size={24} className="text-[var(--border-accent)]" />
                Pro Features
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "AI Commentary", icon: "🎙️" },
                  { label: "Incidents Panel", icon: "⚠️" },
                  { label: "Virtual Spotter", icon: "👁️" },
                  { label: "Live Leaderboard", icon: "🏆" },
                  { label: "Datastream", icon: "📊" },
                  { label: "WebGL Effects", icon: "✨" },
                  { label: "Reflections", icon: "🔮" },
                  { label: "Module Config", icon: "⚙️" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-center"
                  >
                    <div className="text-lg mb-1">{f.icon}</div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)]">
                      {f.label}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                All Pro features are unlocked when your overlay is connected to
                your Pro Drive account.
              </p>
            </section>

            <footer className="mt-16 pt-6 border-t border-[var(--border)] text-center">
              <a
                href={SITE_URL}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors"
              >
                &larr; Back to {SITE_NAME}
              </a>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
