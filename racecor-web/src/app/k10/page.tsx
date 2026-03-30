import { K10_NAME, RACECOR_NAME, SITE_URL } from '@/lib/constants'
import { getChannelInfo, getLatestVideos } from '@/lib/youtube'
import { ChannelBanner } from '@/components/youtube/ChannelBanner'
import { VideoGrid } from '@/components/youtube/VideoGrid'

export default async function K10Page() {
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
          {K10_NAME}
        </h1>
        <p className="text-xl text-[var(--text-dim)] max-w-2xl leading-relaxed mb-10 relative z-10">
          Sim racing content, tools, and technology
        </p>
      </section>

      {/* RaceCor Product Card */}
      <section className="px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--k10-red)]/10 to-transparent p-8">
          <div className="flex items-start gap-6">
            <img
              src="/branding/racecor-logomark.svg"
              alt="RaceCor.io"
              className="h-16 w-auto flex-shrink-0 mt-1"
            />
            <div className="flex-1">
              <h2 className="text-3xl font-black mb-3 text-white">{RACECOR_NAME}</h2>
              <p className="text-lg text-[var(--text-dim)] mb-6">
                Our broadcast-grade sim racing HUD — real-time telemetry, AI commentary, WebGL effects, and HomeKit smart lighting. Built for iRacing.
              </p>
              <a
                href={SITE_URL}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-sm uppercase tracking-wider bg-[var(--k10-red)] text-white hover:brightness-110 hover:no-underline transition-all"
              >
                Visit {RACECOR_NAME} &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* YouTube */}
      {(channel || videos.length > 0) && (
        <section id="videos" className="px-6 py-20 max-w-6xl mx-auto w-full">
          {channel && <ChannelBanner channel={channel} />}
          {videos.length > 0 && <VideoGrid videos={videos} title="Latest Videos" />}
        </section>
      )}

      {/* Footer */}
      <footer className="mt-auto px-6 py-8 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/branding/logomark-white.png" alt="" className="h-5 w-auto opacity-40" />
            <span className="text-xs text-[var(--text-muted)]">{K10_NAME} — Built by Kevin Conboy</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">MIT License</span>
        </div>
      </footer>
    </main>
  )
}
