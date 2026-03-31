import { auth } from '@/lib/auth'

const ADMIN_DISCORD_ID = process.env.K10_ADMIN_DISCORD_ID || ''

/**
 * Check if the current session belongs to the admin user.
 * Returns the session if admin, null otherwise.
 */
export async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null

  const user = session.user as unknown as Record<string, unknown>
  const discordId = user.discordId as string | undefined

  if (!ADMIN_DISCORD_ID || !discordId || discordId !== ADMIN_DISCORD_ID) {
    return null
  }

  return session
}

/** Check if a discordId is the admin */
export function isAdmin(discordId: string | undefined | null): boolean {
  if (!ADMIN_DISCORD_ID || !discordId) return false
  return discordId === ADMIN_DISCORD_ID
}
