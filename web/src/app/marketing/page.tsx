import { RACECOR_NAME, DRIVE_URL, K10_NAME, K10_URL } from '@/lib/constants'
import { TelemetryStatus } from '@/components/telemetry/TelemetryStatus'
import { DashboardEmbed } from '@/components/telemetry/DashboardEmbed'
import { FeatureShowcase } from '@/components/telemetry/FeatureShowcase'

export default async function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 py-24 text-center overflow-hidden">
        {/* Gradient background inspired by brand graphics — deep reds fading to dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--k10-red-dark)]/20 via-[var(--k10-red)]/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--k10-red)]/[0.04] blur-3xl pointer-events-none" />

        <img
          src="/branding/racecor-logomark-white.svg"
          alt=""
          className="h-20 w-auto mb-8 relative z-10"
        />
        <h1 className="font-[var(--ff-display)] text-[48px] font-bold tracking-tight leading-none mb-4 relative z-10" style={{ fontFamily: 'var(--ff-display)' }}>
          {RACECOR_NAME}
        </h1>
        <p className="text-xl text-[var(--text-dim)] max-w-2xl leading-relaxed mb-10 relative z-10">
          Broadcast-grade sim racing HUD with real-time telemetry, race strategy, AI commentary, and WebGL visual effects. Built for iRacing.
        </p>
        <div className="flex gap-4 relative z-10">
          <a
            href="#install"
            className="px-8 py-3 rounded-lg bg-[var(--k10-red)] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 hover:no-underline transition"
          >
            Get Started
          </a>
          <a
            href={DRIVE_URL}
            className="px-8 py-3 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm uppercase tracking-wider hover:bg-white/5 hover:no-underline transition"
          >
            Pro Drive
          </a>
        </div>
      </section>

      {/* Live dashboard demo — full bleed, no margins */}
      <DashboardEmbed />

      {/* Features — live dashboard modules, one at a time */}
      <FeatureShowcase />

      {/* Get Started */}
      <section id="install" className="px-6 py-20 max-w-4xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-10" style={{ fontFamily: 'var(--ff-display)' }}>Get Started</h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--k10-red)]">1. Create Your Account</h3>
            <p className="text-lg text-[var(--text-dim)] mb-3">
              Sign in with Discord to access Pro Drive — your personal sim racing performance dashboard and download portal.
            </p>
            <a
              href={DRIVE_URL}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[#5865F2] text-white hover:brightness-110 hover:no-underline transition-all"
            >
              Sign in to Pro Drive &rarr;
            </a>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--k10-red)]">2. Download & Install</h3>
            <p className="text-lg text-[var(--text-dim)] mb-3">
              The Windows installer is available in your Pro Drive dashboard. It bundles the SimHub plugin and the dashboard overlay, auto-detects your SimHub installation, and handles all file placement.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--k10-red)]">3. Connect & Race</h3>
            <p className="text-lg text-[var(--text-dim)] mb-3">
              Open the overlay settings (Ctrl+Shift+S), go to Connections, and click &ldquo;Connect to Pro Drive&rdquo; to unlock all Pro features — AI commentary, incidents, spotter, leaderboard, datastream, WebGL effects, and ambient reflections.
            </p>
            <div className="bg-[var(--bg-surface)] rounded-lg p-4 font-mono text-base text-[var(--text-dim)] border border-[var(--border-subtle)]">
              Your race data syncs automatically — performance charts appear after a few sessions
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 py-8 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/branding/racecor-logomark-white.svg" alt="" className="h-5 w-auto opacity-40" />
            <span className="text-xs text-[var(--text-muted)]">{RACECOR_NAME} — Built by Kevin Conboy</span>
          </div>
          <div className="flex items-center gap-4">
            <a href={K10_URL} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">
              A {K10_NAME} product
            </a>
            <span className="text-xs text-[var(--text-muted)]">MIT License</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
