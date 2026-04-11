import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * POST /api/admin/ratings/reset
 * Delete all rating_history rows for the current user.
 * Use this before re-importing to clear stale/duplicate data.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  if (!discordId) return NextResponse.json({ error: 'No Discord ID' }, { status: 401 })

  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId)).limit(1)
  if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  const userId = users[0].id

  const deleted = await db.delete(schema.ratingHistory)
    .where(eq(schema.ratingHistory.userId, userId))

  // Also reset iRacing import status so next overlay sync triggers a FULL import
  // (which includes chartData / iRating timeline) instead of the quiet "latest" path
  let importReset = false
  try {
    await db.update(schema.iracingAccounts).set({
      importStatus: null,
      lastImportAt: null,
      updatedAt: new Date(),
    }).where(eq(schema.iracingAccounts.userId, userId))
    importReset = true
  } catch {
    // iracingAccounts row may not exist — that's fine
  }

  return NextResponse.json({ success: true, deleted: deleted.rowCount, importReset })
}
