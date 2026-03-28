import { SITE_NAME, DRIVE_URL } from '@/lib/constants'
import { getChannelInfo, getLatestVideos } from '@/lib/youtube'
import { ChannelBanner } from '@/components/youtube/ChannelBanner'
import { VideoGrid } from '@/components/youtube/VideoGrid'
import { TelemetryStatus } from '@/components/telemetry/TelemetryStatus'
import { DashboardEmbed } from '@/components/telemetry/DashboardEmbed'

export default async function HomePage() {
  // Fetch YouTube data at build time / ISR (revalidates every 30 min)
  const [channel, videos] = await Promise.all([
    getChannelInfo().catch(() => null),
    getLatestVideos(12).catch(() => []),
  ])
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 py-32 text-center overflow-hidden">
        {/* Gradient background inspired by brand graphics — deep reds fading to dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--k10-red-dark)]/20 via-[var(--k10-red)]/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[var(--k10-red)]/[0.04] blur-3xl pointer-events-none" />

        <img
          src="/branding/logomark-white.png"
          alt=""
          className="h-20 w-auto mb-8 relative z-10 opacity-90"
        />
        <h1 className="text-6xl font-black tracking-tight leading-none mb-4 relative z-10">
          {SITE_NAME}
        </h1>
        <p className="text-xl text-[var(--text-dim)] max-w-2xl leading-relaxed mb-10 relative z-10">
          Broadcast-grade sim racing HUD with real-time telemetry, race strategy,
          AI commentary, WebGL effects, and HomeKit smart lighting. Built for iRacing.
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
            K10 Pro Drive
          </a>
        </div>
      </section>

      {/* Live dashboard demo — full bleed, no margins */}
      <DashboardEmbed />

      {/* Features grid */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-black mb-10 text-center">What&apos;s Inside</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: 'Live Telemetry HUD',
              desc: 'Gear, speed, RPM with color-coded tachometer. Pedal traces. Fuel with pit window estimates. Four-corner tyre temps. BB/TC/ABS. Live lap timer with delta-to-best. All at 30fps.',
              accent: 'var(--k10-red)',
            },
            {
              title: 'Race Strategy Engine',
              desc: 'Real-time tire lifecycle tracking with composite grip scoring, fuel burn analysis with pit window calculation, stint-aware evaluation, and severity-graded coaching calls.',
              accent: 'var(--amber)',
            },
            {
              title: 'AI Commentary',
              desc: '33 telemetry-driven triggers with 240+ prompt combinations. Composable sentence fragments. Severity-based interruption with cooldowns. Contextual to your car and circuit.',
              accent: 'var(--green)',
            },
            {
              title: 'Track Map & Sectors',
              desc: 'SVG minimap with heading-up rotation. Per-sector timing with native iRacing boundaries (up to 7+ sectors). Live delta, split times, PB tracking.',
              accent: 'var(--blue)',
            },
            {
              title: 'WebGL Visual Effects',
              desc: 'Fragment shader post-processing: glare, bloom, light sweep, g-force vignette, RPM redline. Ambient light engine samples your screen and drives glass refraction effects.',
              accent: 'var(--cyan)',
            },
            {
              title: 'Smart Lighting & Drive Mode',
              desc: 'HomeKit integration maps flags, proximity, and strategy calls to smart light colors. Fullscreen Drive HUD mode for focused racing without production elements.',
              accent: 'var(--purple)',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border)] transition"
            >
              <div
                className="w-1 h-6 rounded-full mb-4"
                style={{ background: f.accent }}
              />
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-base text-[var(--text-dim)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Installation */}
      <section id="install" className="px-6 py-20 max-w-4xl mx-auto w-full">
        <h2 className="text-3xl font-black mb-10">Install</h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--k10-red)]">1. Download the Installer</h3>
            <p className="text-lg text-[var(--text-dim)] mb-3">
              The Windows installer bundles the SimHub plugin and the dashboard overlay. It auto-detects your SimHub installation and handles all file placement.
            </p>
            <a
              href="https://github.com/alternatekev/media-coach-simhub-plugin/releases/latest"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[var(--k10-red)] text-white hover:brightness-110 transition-all"
            >
              Download K10-Motorsports-Setup.exe →
            </a>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--k10-red)]">2. Enable in SimHub</h3>
            <p className="text-lg text-[var(--text-dim)] mb-3">
              Launch SimHub, enable &ldquo;K10 Motorsports&rdquo; in the plugin list, and configure display timing, commentary categories, and strategy options in the settings panel.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--k10-red)]">3. Launch & Connect</h3>
            <p className="text-lg text-[var(--text-dim)] mb-3">
              The overlay runs as a transparent window on top of your sim. Stream it to any browser on your network for multi-screen setups.
            </p>
            <div className="bg-[var(--bg-surface)] rounded-lg p-4 font-mono text-base text-[var(--text-dim)] border border-[var(--border-subtle)]">
              Built-in auto-updater keeps you current — check for updates from the SimHub settings panel
            </div>
          </div>
        </div>
      </section>

      {/* YouTube */}
      {(channel || videos.length > 0) && (
        <section className="px-6 py-20 max-w-6xl mx-auto w-full">
          {channel && <ChannelBanner channel={channel} />}
          {videos.length > 0 && <VideoGrid videos={videos} title="Latest from K10 Motorsports" />}
        </section>
      )}

      {/* Footer */}
      <footer className="mt-auto px-6 py-8 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/branding/logomark-white.png" alt="" className="h-5 w-auto opacity-40" />
            <span className="text-xs text-[var(--text-muted)]">{SITE_NAME} — Built by Kevin Conboy</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">MIT License</span>
        </div>
      </footer>
    </main>
  )
}
