import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { desc, count, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin'

/** GET /api/admin/users — List all registered users (read-only) */
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await db
    .select({
      id: schema.users.id,
      discordId: schema.users.discordId,
      discordUsername: schema.users.discordUsername,
      discordDisplayName: schema.users.discordDisplayName,
      discordAvatar: schema.users.discordAvatar,
      email: schema.users.email,
      createdAt: schema.users.createdAt,
      updatedAt: schema.users.updatedAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))

  // Get active token count per user
  const tokenCounts = await db
    .select({
      userId: schema.pluginTokens.userId,
      tokenCount: count(schema.pluginTokens.id),
    })
    .from(schema.pluginTokens)
    .where(eq(schema.pluginTokens.revoked, false))
    .groupBy(schema.pluginTokens.userId)

  const tokenMap = new Map(tokenCounts.map(t => [t.userId, Number(t.tokenCount)]))

  const enriched = users.map(u => ({
    ...u,
    activeTokens: tokenMap.get(u.id) || 0,
  }))

  return NextResponse.json({ users: enriched })
}
