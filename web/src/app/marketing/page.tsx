import { SITE_NAME, DRIVE_URL } from '@/lib/constants'
import { getChannelInfo, getLatestVideos } from '@/lib/youtube'
import { ChannelBanner } from '@/components/youtube/ChannelBanner'
import { VideoGrid } from '@/components/youtube/VideoGrid'

export default async function HomePage() {
  // Fetch YouTube data at build time / ISR (revalidates every 30 min)
  const [channel, videos] = await Promise.all([
    getChannelInfo().catch(() => null),
    getLatestVideos(12).catch(() => []),
  ])
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 py-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--purple)]/5 to-transparent pointer-events-none" />
        <h1 className="text-6xl font-black tracking-tight leading-none mb-4 relative z-10">
          {SITE_NAME}
        </h1>
        <p className="text-xl text-[var(--text-dim)] max-w-2xl leading-relaxed mb-10 relative z-10">
          Real-time sim racing telemetry overlay with AI commentary, sector analysis,
          and driver performance tracking. Built for iRacing.
        </p>
        <div className="flex gap-4 relative z-10">
          <a
            href="#install"
            className="px-8 py-3 rounded-lg bg-[var(--purple)] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition"
          >
            Get Started
          </a>
          <a
            href={DRIVE_URL}
            className="px-8 py-3 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm uppercase tracking-wider hover:bg-white/5 transition"
          >
            K10 Pro Drive
          </a>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: 'Live Telemetry HUD',
              desc: 'Gear, speed, RPM with tachometer. Pedal traces. Fuel and tyre monitoring. Brake bias, TC, ABS. All at 30fps.',
            },
            {
              title: 'AI Commentary',
              desc: '50+ telemetry-driven events with severity-based interruption. Contextual commentary about your car and the circuit.',
            },
            {
              title: 'Sector Analysis',
              desc: 'F1-style 3-sector timing using iRacing native boundaries. Live delta, split times, PB tracking.',
            },
            {
              title: 'Leaderboard',
              desc: 'Relative leaderboard with sparkline lap history, iRating display, gap times, and pit status.',
            },
            {
              title: 'Drive Mode',
              desc: 'Full-screen driver HUD for iPad or second screen. Track map, sectors, position, incidents — glanceable at speed.',
            },
            {
              title: 'Driver Profile',
              desc: 'iRating and Safety Rating tracking across all license classes. History charts, car brand heatmap, performance assessment.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl bg-white/[0.03] border border-[var(--border-subtle)] hover:border-[var(--border)] transition"
            >
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Installation */}
      <section id="install" className="px-6 py-20 max-w-4xl mx-auto w-full">
        <h2 className="text-3xl font-black mb-8">Install</h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--purple)]">1. SimHub Plugin</h3>
            <p className="text-[var(--text-dim)] mb-3">
              Prerequisites: SimHub installed on Windows. Optional: iRacing Extra Properties plugin for iRating display.
            </p>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-[var(--green)]">
              Double-click <span className="text-white">install.bat</span> in the repository root
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--purple)]">2. Dashboard Overlay</h3>
            <p className="text-[var(--text-dim)] mb-3">
              The Electron overlay runs as a transparent window on top of your sim.
            </p>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm space-y-1">
              <div><span className="text-[var(--text-dim)]">$</span> <span className="text-white">cd dashboard-overlay</span></div>
              <div><span className="text-[var(--text-dim)]">$</span> <span className="text-white">npm install</span></div>
              <div><span className="text-[var(--text-dim)]">$</span> <span className="text-white">npm start</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3 text-[var(--purple)]">3. Remote Access</h3>
            <p className="text-[var(--text-dim)] mb-3">
              Stream the dashboard to any browser on your network — iPad, phone, second monitor.
            </p>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-sm text-[var(--text-dim)]">
              Settings → Connections → Stream to Safari → scan QR code
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
      <footer className="mt-auto px-6 py-8 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">
        <p>{SITE_NAME} — Built by Kevin Conboy</p>
        <p className="mt-1">MIT License</p>
      </footer>
    </main>
  )
}
