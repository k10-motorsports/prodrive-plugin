import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import AdminPanel from './AdminPanel'

export const metadata = {
  title: 'Admin — K10 Pro Drive',
}

export default async function AdminPage() {
  const session = await requireAdmin()
  if (!session) redirect('/drive/dashboard')

  const user = session.user as unknown as Record<string, unknown>

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/drive/dashboard" className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm">&larr; Dashboard</a>
          <span className="text-[var(--border)]">/</span>
          <span className="text-sm font-bold tracking-wider uppercase text-[var(--k10-red)]">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {session.user?.image && <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />}
          <span className="text-xs text-[var(--text-muted)]">{user.discordDisplayName as string}</span>
        </div>
      </header>
      <AdminPanel />
    </main>
  )
}
