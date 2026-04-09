import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { db, schema } from "@/db";
import { and, eq, gt, desc } from "drizzle-orm";
import { Download, BarChart3, Trophy, Shield, Car } from "lucide-react";
import RaceCard from "./RaceCard";
import RaceCalendarHeatmap, {
  type SessionDataPoint,
} from "./RaceCalendarHeatmap";
import RaceScatterGrid from "./RaceScatterGrid";
import DriverDNARadar from "./DriverDNARadar";
import SessionLengthCards from "./SessionLengthCards";
import IRacingQuickImport from "./IRacingQuickImport";
import DataManagement from "./DataManagement";
import { getCarImage, getTrackImage } from "@/lib/commentary-images";

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

type BrandInfo = {
  logoSvg: string | null;
  logoPng: string | null;
  brandColorHex: string | null;
  manufacturerName: string; // canonical brand name from carLogos table
};

type DisplayCard = {
  session: RaceSession;
  practiceSession?: RaceSession;
};

const isPractice = (s: RaceSession) =>
  (s.sessionType || s.category || "").toLowerCase().includes("practice");

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
      isPluginConnected = activeTokens.length > 0;

      const allSessions = await db
        .select()
        .from(schema.raceSessions)
        .where(eq(schema.raceSessions.userId, dbUser.id))
        .orderBy(desc(schema.raceSessions.createdAt));
      raceCount = allSessions.length;

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

  // ── iRating sparkline ────────────────────────────────────────────────────────
  let iRatingHistory: number[] = [];
  if (isPluginConnected && dbUser) {
    const history = await db
      .select({ iRating: schema.ratingHistory.iRating })
      .from(schema.ratingHistory)
      .where(eq(schema.ratingHistory.userId, dbUser.id))
      .orderBy(desc(schema.ratingHistory.createdAt))
      .limit(100);
    iRatingHistory = history.map((h) => h.iRating).reverse();
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
        if (dist < bestDist && rh.trackName === s.trackName) {
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

  const sortedAsc = [...recentSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const consumedIds = new Set<string>();
  const practiceForRace = new Map<string, RaceSession>(); // raceId → its paired practice

  // Pass 1: pair each race with the immediately preceding practice on the same track
  for (let i = 0; i < sortedAsc.length; i++) {
    const s = sortedAsc[i];
    if (isPractice(s)) continue;

    // Find the nearest preceding unclaimed practice on the same track within 8 h
    for (let j = i - 1; j >= 0; j--) {
      const prev = sortedAsc[j];
      if (consumedIds.has(prev.id)) continue;
      const gapMs =
        new Date(s.createdAt).getTime() - new Date(prev.createdAt).getTime();
      if (
        isPractice(prev) &&
        prev.trackName === s.trackName &&
        gapMs < 8 * 60 * 60 * 1000
      ) {
        practiceForRace.set(s.id, prev);
        consumedIds.add(prev.id);
      }
      break; // only consider the single immediately-preceding unconsumed session
    }
  }

  // Pass 2: build display groups — consumed practices are silently dropped
  const groups: DisplayCard[] = [];
  for (const s of sortedAsc) {
    if (consumedIds.has(s.id)) continue;
    groups.push(
      isPractice(s)
        ? { session: s } // standalone practice
        : { session: s, practiceSession: practiceForRace.get(s.id) }, // race ± practice
    );
  }

  // Most recent first
  const displayCards = groups.reverse();
  console.log(displayCards.length);

  const hasEnoughData = raceCount >= 5;
  

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const trackKey = (name: string | null) => (name || "").toLowerCase();

  return (
    <main className="min-h-screen relative">
      <div className="max-w-[120rem] mx-auto px-6 py-12">
        {isPluginConnected ? (
          <>
            {/* Welcome + Quick Import */}
            <section className="mb-12 flex items-start justify-between gap-6">
              <div>
                <h1
                  className="text-3xl font-bold mb-2"
                  style={{ fontFamily: "var(--ff-display)" }}
                >
                  Welcome, {displayName}
                </h1>
                <p className="text-[var(--text-dim)]">
                  Your overlay is connected and sending data to Pro Drive.
                </p>
              </div>
              <IRacingQuickImport />
            </section>

            {/* Visualizations — Calendar Heatmap + Scatter Grid */}
            {vizData.length > 0 && (
              <section className="mb-12">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <RaceCalendarHeatmap sessions={vizData} />
                  <RaceScatterGrid sessions={vizData} />
                  <DriverDNARadar sessions={dnaSessionData} ratingHistory={dnaRatingData} />
                  <SessionLengthCards sessions={dnaSessionData} />
                </div>
              </section>
            )}

            {/* Race History */}
            <section className="mb-8">
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ fontSize: "23px" }}
              >
                <Car size={24} className="text-[var(--border-accent)]" />
                Race History
              </h2>
              {displayCards.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  {displayCards.map(({ session: s, practiceSession }) => (
                    <RaceCard
                      key={s.id}
                      session={s}
                      practiceSession={practiceSession}
                      trackSvgPath={
                        trackMapLookup[trackKey(s.trackName)] || null
                      }
                      carImageUrl={carImageLookup[s.carModel] || null}
                      trackImageUrl={
                        trackImageLookup[s.trackName ?? ""] || null
                      }
                      trackLogoSvg={
                        trackLogoLookup[trackKey(s.trackName)] || null
                      }
                      trackDisplayName={
                        trackDisplayNameLookup[trackKey(s.trackName)] || null
                      }
                      brandInfo={brandLogoLookup[s.carModel] ?? null}
                      iRatingHistory={iRatingHistory}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-center">
                  <Car
                    size={32}
                    className="mx-auto mb-3 text-[var(--text-muted)]"
                  />
                  <p className="text-sm text-[var(--text-dim)] mb-1">
                    No races recorded yet
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Your session data will appear here after your next race with
                    data sync enabled.
                  </p>
                </div>
              )}
            </section>

            {/* Data Management (collapsible) */}
            {isPluginConnected && raceCount > 0 && (
              <DataManagement totalSessions={raceCount} emptySessions={emptySessionCount} />
            )}

            {/* Performance */}
            <section className="mb-12">
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ fontSize: "23px" }}
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
                    Charts and performance trends will appear once you&apos;ve
                    completed at least 5 races.
                  </p>
                </div>
              )}
            </section>

            {/* Pro Features */}
            {!hasEnoughData && (
              <section className="mb-12">
                <h2
                  className="font-bold mb-4 flex items-center gap-2"
                  style={{ fontSize: "23px" }}
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
            <section className="mb-12">
              <h1
                className="text-3xl font-bold mb-2"
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
              <h2 className="font-bold mb-4" style={{ fontSize: "23px" }}>
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

            <section className="mb-12">
              <h2
                className="font-bold mb-4 flex items-center gap-2"
                style={{ fontSize: "23px" }}
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
                className="font-bold mb-4 flex items-center gap-2"
                style={{ fontSize: "23px" }}
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
