import type { Metadata } from 'next'
import { K10_NAME, K10_DESCRIPTION, SITE_URL } from '@/lib/constants'
import { TelemetryProvider } from '@/components/telemetry/TelemetryProvider'

export const metadata: Metadata = {
  title: K10_NAME,
  description: K10_DESCRIPTION,
}

export default function K10Layout({ children }: { children: React.ReactNode }) {
  return (
    <TelemetryProvider>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:no-underline">
            <img
              src="/branding/logomark-white.png"
              alt="K10"
              className="h-7 w-auto"
            />
            <span className="text-sm font-bold tracking-wider uppercase text-[var(--text-secondary)]">
              {K10_NAME}
            </span>
          </a>
          <div className="flex items-center gap-6">
            <a href="#videos" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] hover:no-underline transition-colors">
              Videos
            </a>
            <a
              href={SITE_URL}
              className="px-4 py-1.5 rounded-md bg-[var(--k10-red)] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition hover:no-underline"
            >
              RaceCor.io
            </a>
          </div>
        </div>
      </nav>
      {children}
    </TelemetryProvider>
  )
}
