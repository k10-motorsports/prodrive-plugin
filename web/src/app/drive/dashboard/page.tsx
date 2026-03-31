import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SITE_URL, SITE_NAME, CATEGORY_LABELS, LICENSE_LABELS, LICENSE_COLORS } from '@/lib/constants'
import { isAdmin } from '@/lib/admin'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { Download, LogOut, BarChart3, Trophy, Shield, Car, Settings } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/drive')

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  const displayName = (user_ext.discordDisplayName as string) || session.user.name || 'Racer'
  const avatar = session.user.image

  // Fetch race session count to determine if we should show the "keep racing" message
  let raceCount = 0
  let dbUser = null
  if (discordId) {
    const users = await db.select().from(schema.users).where(eq(schema.users.discordId, discordId)).limit(1)
    if (users.length > 0) {
      dbUser = users[0]
      const sessions = await db.select().from(schema.raceSessions).where(eq(schema.raceSessions.userId, dbUser.id))
      raceCount = sessions.length
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
