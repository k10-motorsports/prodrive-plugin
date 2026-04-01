import { SITE_URL, SITE_NAME } from '@/lib/constants'
import { signIn, auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DrivePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth()
  const params = await searchParams
  const callbackUrl = params.callbackUrl

  // If user is already logged in and there's a plugin auth callback, redirect there
  if (session?.user && callbackUrl?.includes('/api/plugin-auth/')) {
    redirect(callbackUrl)
  }

  // If user is logged in, redirect to the members dashboard
  if (session?.user) {
    redirect('/drive/dashboard')
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center relative overflow-hidden">
      {/* Subtle brand glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[var(--k10-red)]/[0.06] blur-3xl pointer-events-none" />

      <img
        src="/branding/logomark-white.png"
        alt="RaceCor.io"
        className="h-16 w-auto mb-8 relative z-10 opacity-80"
      />
      <h1 className="text-4xl font-bold mb-3 relative z-10" style={{ fontFamily: 'var(--ff-display)' }}>RaceCor.io Pro Drive</h1>
      <p className="text-[var(--text-dim)] max-w-md mb-8 relative z-10">
        Your sim racing performance dashboard. Track iRating, Safety Rating, license progression,
        and race history across all iRacing categories.
      </p>
      <form
        action={async () => {
          'use server'
          await signIn('discord', { redirectTo: callbackUrl || '/drive/dashboard' })
        }}
      >
        <button
          type="submit"
          className="relative z-10 px-8 py-3 rounded-lg bg-[#5865F2] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition flex items-center gap-2 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          Sign in with Discord
        </button>
      </form>
      <p className="mt-6 text-xs text-[var(--text-muted)] relative z-10">
        <a href={SITE_URL} className="hover:text-[var(--text-dim)] transition-colors">&larr; Back to {SITE_NAME}</a>
      </p>
    </main>
  )
}
