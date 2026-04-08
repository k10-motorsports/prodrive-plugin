import { auth, signOut } from '@/lib/auth'
import { isAdmin } from '@/lib/admin'
import { db, schema } from '@/db'
import { and, eq, gt } from 'drizzle-orm'
import LogoMark from '@/components/LogoMark'
import ThemeSetEffects from '@/components/ThemeSetEffects'
import DriveNavLinks from '@/components/DriveNavLinks'
import UserMenu from '@/components/UserMenu'

export default async function DriveHeader() {
  const session = await auth()

  let displayName = ''
  let avatar: string | null = null
  let admin = false
  let isPluginConnected = false

  if (session?.user) {
    const user_ext = session.user as Record<string, unknown>
    const discordId = user_ext.discordId as string
    displayName = (user_ext.discordDisplayName as string) || session.user.name || 'Racer'
    avatar = session.user.image ?? null
    admin = isAdmin(discordId)

    // Check plugin connection status
    if (discordId) {
      try {
        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.discordId, discordId))
          .limit(1)
        if (users.length > 0) {
          const activeTokens = await db
            .select()
            .from(schema.pluginTokens)
            .where(
              and(
                eq(schema.pluginTokens.userId, users[0].id),
                eq(schema.pluginTokens.revoked, false),
                gt(schema.pluginTokens.expiresAt, new Date()),
              ),
            )
            .limit(1)
          isPluginConnected = activeTokens.length > 0
        }
      } catch {
        // DB unavailable — leave disconnected
      }
    }
  }

  const handleSignOut = async () => {
    'use server'
    await signOut({ redirectTo: '/drive' })
  }

  return (
    <>
      <ThemeSetEffects />
      <header className="border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-40">
        <div className="px-4 flex items-center justify-between">
          {/* Left: logo + nav links */}
          <div className="flex items-center gap-4">
            <a href="/drive/dashboard" className="flex items-center gap-2 py-2 flex-shrink-0">
              <LogoMark className="h-5 w-auto" />
            </a>
            <DriveNavLinks />
          </div>

          {/* Right: user menu */}
          {session?.user && (
            <div className="flex items-center flex-shrink-0">
              <UserMenu
                user={{
                  name: displayName,
                  image: avatar,
                  isAdmin: admin,
                  isPluginConnected,
                }}
                signOutAction={handleSignOut}
              />
            </div>
          )}
        </div>
      </header>
    </>
  )
}
