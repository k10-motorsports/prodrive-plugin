import type { Metadata } from 'next'
import { SITE_NAME, SITE_DESCRIPTION, DRIVE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:no-underline">
            <img
              src="/branding/racecor-logomark-white.svg"
              alt="RaceCor.io"
              className="h-7 w-auto"
            />
            <span className="text-sm font-bold tracking-wider uppercase text-[var(--text-secondary)]">
              RaceCor.io
            </span>
          </a>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] hover:no-underline transition-colors">
              Features
            </a>
            <a href="#install" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text)] hover:no-underline transition-colors">
              Install
            </a>
            <a
              href={DRIVE_URL}
              className="px-4 py-1.5 rounded-md bg-[var(--k10-red)] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition hover:no-underline"
            >
              Pro Drive
            </a>
          </div>
        </div>
      </nav>
      {children}
    </>
  )
}
