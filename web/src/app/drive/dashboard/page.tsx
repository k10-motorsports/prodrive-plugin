import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SITE_URL, SITE_NAME, CATEGORY_LABELS, LICENSE_LABELS, LICENSE_COLORS } from '@/lib/constants'
import { isAdmin } from '@/lib/admin'
import { db, schema } from '@/db'
import { and, eq, gt, desc } from 'drizzle-orm'
import { Download, LogOut, BarChart3, Trophy, Shield, Car, Settings, Wifi } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/drive')

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  const displayName = (user_ext.discordDisplayName as string) || session.user.name || 'Racer'
  const avatar = session.user.image

  // Fetch user and check for active plugin tokens
  let raceCount = 0
  let dbUser = null
  let isPluginConnected = false
  let recentSessions: any[] = []

  let userToken = ''
  if (discordId) {
    const users = await db.select().from(schema.users).where(eq(schema.users.discordId, discordId)).limit(1)
    if (users.length > 0) {
      dbUser = users[0]

      // Check if user has any active plugin tokens
      const activeTokens = await db.select().from(schema.pluginTokens)
        .where(and(
          eq(schema.pluginTokens.userId, dbUser.id),
          eq(schema.pluginTokens.revoked, false),
          gt(schema.pluginTokens.expiresAt, new Date())
        ))
        .limit(1)
      isPluginConnected = activeTokens.length > 0

      // Fetch all race sessions for count
      const sessions = await db.select().from(schema.raceSessions).where(eq(schema.raceSessions.userId, dbUser.id))
      raceCount = sessions.length

      // For connected users, fetch recent sessions
      if (isPluginConnected) {
        recentSessions = await db.select().from(schema.raceSessions)
          .where(eq(schema.raceSessions.userId, dbUser.id))
          .orderBy(desc(schema.raceSessions.createdAt))
          .limit(20)
      // Get the user's latest access token for API calls
      const tokens = await db.select().from(schema.pluginTokens)
        .where(eq(schema.pluginTokens.userId, dbUser.id))
        .orderBy(schema.pluginTokens.createdAt)
        .limit(1)
      if (tokens.length > 0) {
        userToken = tokens[0].accessToken
      }
    }
  }

  const hasEnoughData = raceCount >= 5

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      {/* Top bar */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/branding/logomark-white.png" alt="K10" className="h-8 w-auto opacity-80" />
          <span className="text-sm font-bold tracking-wider uppercase text-[var(--text-secondary)]">Pro Drive</span>
          {isPluginConnected && (
            <div className="flex items-center gap-1.5 ml-4 pl-4 border-l border-[var(--border)]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-green-500/80">SimHub connected</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {avatar && <img src={avatar} alt="" className="w-7 h-7 rounded-full" />}
            <span className="text-sm text-[var(--text-secondary)]">{displayName}</span>
          </div>
          {isAdmin(discordId) && (
            <a
              href="/drive/admin"
              className="text-xs text-[var(--k10-red)] hover:brightness-110 transition-colors flex items-center gap-1"
            >
              <Settings size={12} /> Admin
            </a>
          )}
          <form action={async () => {
            'use server'
            await signOut({ redirectTo: '/drive' })
          }}>
            <button type="submit" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors flex items-center gap-1 cursor-pointer">
              <LogOut size={12} /> Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {isPluginConnected ? (
          <>
            {/* Connected State Layout */}

            {/* Welcome (no download CTA) */}
            <section className="mb-12">
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--ff-display)' }}>Welcome, {displayName}</h1>
              <p className="text-[var(--text-dim)]">
                Your overlay is connected and sending data to Pro Drive.
              </p>
            </section>

            {/* Race History */}
            <section className="mb-12">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Car size={18} className="text-[var(--k10-red)]" />
                Race History
              </h2>
              {recentSessions.length > 0 ? (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left">
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Date</th>
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Track</th>
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Car</th>
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Pos</th>
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Inc</th>
                        <th className="px-4 py-3 text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Best Lap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((s) => {
                        const meta = (s.metadata as Record<string, any>) || {}
                        const date = new Date(s.createdAt)
                        const bestLap = meta.bestLapTime
                        let lapStr = '—'
                        if (bestLap && bestLap > 0) {
                          const m = Math.floor(bestLap / 60)
                          const sec = bestLap - m * 60
                          lapStr = m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(3)
                        }
                        return (
                          <tr key={s.id} className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-[var(--text-dim)]">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                            <td className="px-4 py-3 text-[var(--text-secondary)] font-medium">{s.trackName || '—'}</td>
                            <td className="px-4 py-3 text-[var(--text-dim)]">{s.carModel || '—'}</td>
                            <td className="px-4 py-3 font-bold">{s.finishPosition ? 'P' + s.finishPosition : '—'}</td>
                            <td className="px-4 py-3 text-[var(--text-dim)]">{s.incidentCount ?? '—'}</td>
                            <td className="px-4 py-3 text-[var(--text-dim)] font-mono text-xs">{lapStr}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
                  <Car size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-dim)] mb-1">No races recorded yet</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Your session data will appear here after your next race with data sync enabled.
                  </p>
                </div>
              )}
            </section>

            {/* Performance Dashboard */}
            <section className="mb-12">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-[var(--k10-red)]" />
                Performance
              </h2>
              {hasEnoughData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Races</div>
                    <div className="text-2xl font-black">{raceCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Charts</div>
                    <div className="text-sm text-[var(--text-dim)]">Coming soon</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Trends</div>
                    <div className="text-sm text-[var(--text-dim)]">Coming soon</div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
                  <Trophy size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-dim)] mb-1">
                    {raceCount === 0
                      ? 'No race data yet'
                      : `${raceCount} of 5 races recorded`}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Charts and performance trends will appear once you&apos;ve completed at least 5 races with the overlay connected.
                    Keep racing!
                  </p>
                </div>
              )}
            </section>

            {/* Pro Features */}
            <section className="mb-12">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-[var(--k10-red)]" />
                Pro Features
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'AI Commentary', icon: '🎙️' },
                  { label: 'Incidents Panel', icon: '⚠️' },
                  { label: 'Virtual Spotter', icon: '👁️' },
                  { label: 'Live Leaderboard', icon: '🏆' },
                  { label: 'Datastream', icon: '📊' },
                  { label: 'WebGL Effects', icon: '✨' },
                  { label: 'Reflections', icon: '🔮' },
                  { label: 'Module Config', icon: '⚙️' },
                ].map(f => (
                  <div key={f.label} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                    <div className="text-lg mb-1">{f.icon}</div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)]">{f.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                All Pro features are unlocked when your overlay is connected to your Pro Drive account.
              </p>
            </section>

            {/* Subtle Download Link */}
            <section className="mb-8 text-center">
              <a
                href="/api/download/latest"
                className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors"
              >
                <Download size={12} />
                Need to reinstall? Download RaceCor.io Overlay
              </a>
            </section>
          </>
        ) : (
          <>
            {/* Not Connected State Layout (Original) */}

            {/* Welcome + Download */}
            <section className="mb-12">
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--ff-display)' }}>Welcome, {displayName}</h1>
              <p className="text-[var(--text-dim)] mb-6">
                Download the RaceCor overlay, connect it to your Pro Drive account, and start racing. Your performance data will appear here automatically.
              </p>
              <a
                href="/api/download/latest"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--k10-red)] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition"
              >
                <Download size={16} />
                Download RaceCor Overlay
              </a>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Windows installer &mdash; includes SimHub plugin and dashboard overlay
              </p>
            </section>

            {/* Setup Instructions */}
            <section className="mb-12 p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <h2 className="text-lg font-bold mb-4">Get Connected</h2>
              <ol className="space-y-3 text-sm text-[var(--text-dim)]">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--k10-red)] text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span>Install the RaceCor overlay using the download above</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--k10-red)] text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span>Launch the overlay and open Settings (Ctrl+Shift+S)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--k10-red)] text-white text-xs font-bold flex items-center justify-center">3</span>
                  <span>Go to the <strong>Connections</strong> tab and click <strong>Connect to Pro Drive</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--k10-red)] text-white text-xs font-bold flex items-center justify-center">4</span>
                  <span>You&apos;ll be redirected here to authorize, then the overlay unlocks all Pro features</span>
                </li>
              </ol>
            </section>

            {/* Performance Dashboard (placeholder or data) */}
            <section className="mb-12">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-[var(--k10-red)]" />
                Performance
              </h2>
              {hasEnoughData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Races</div>
                    <div className="text-2xl font-black">{raceCount}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Charts</div>
                    <div className="text-sm text-[var(--text-dim)]">Coming soon</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Trends</div>
                    <div className="text-sm text-[var(--text-dim)]">Coming soon</div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-center">
                  <Trophy size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-dim)] mb-1">
                    {raceCount === 0
                      ? 'No race data yet'
                      : `${raceCount} of 5 races recorded`}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Charts and performance trends will appear once you&apos;ve completed at least 5 races with the overlay connected.
                    Keep racing!
                  </p>
                </div>
              )}
            </section>

            {/* Pro Features */}
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Shield size={18} className="text-[var(--k10-red)]" />
                Pro Features
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'AI Commentary', icon: '🎙️' },
                  { label: 'Incidents Panel', icon: '⚠️' },
                  { label: 'Virtual Spotter', icon: '👁️' },
                  { label: 'Live Leaderboard', icon: '🏆' },
                  { label: 'Datastream', icon: '📊' },
                  { label: 'WebGL Effects', icon: '✨' },
                  { label: 'Reflections', icon: '🔮' },
                  { label: 'Module Config', icon: '⚙️' },
                ].map(f => (
                  <div key={f.label} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-center">
                    <div className="text-lg mb-1">{f.icon}</div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)]">{f.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                All Pro features are unlocked when your overlay is connected to your Pro Drive account.
              </p>
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-[var(--border)] text-center">
          <a href={SITE_URL} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">
            &larr; Back to {SITE_NAME}
          </a>
        </footer>
      </div>
    </main>
  )
}
