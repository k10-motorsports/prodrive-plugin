import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'

/**
 * DELETE /api/sessions/manage — Session management via NextAuth session (web dashboard)
 * Query params:
 *   ?id=<sessionId>   — delete a specific session
 *   ?purge=empty      — delete all sessions with 0 laps and no best lap time
 */
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user_ext = session.user as Record<string, unknown>
  const discordId = user_ext.discordId as string
  if (!discordId) {
    return NextResponse.json({ error: 'No Discord ID' }, { status: 401 })
  }

  // Find the user in the database
  const users = await db.select().from(schema.users)
    .where(eq(schema.users.discordId, discordId))
    .limit(1)

  if (users.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  const userId = users[0].id

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('id')
  const purge = searchParams.get('purge')

  try {
    if (sessionId) {
      const deleted = await db.delete(schema.raceSessions)
        .where(and(
          eq(schema.raceSessions.id, sessionId),
          eq(schema.raceSessions.userId, userId)
        ))
        .returning()

      if (deleted.length === 0) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, deleted: deleted.length })
    }

    if (purge === 'empty') {
      const allSessions = await db.select().from(schema.raceSessions)
        .where(eq(schema.raceSessions.userId, userId))

      const emptySessions = allSessions.filter(s => {
        const meta = s.metadata as Record<string, unknown> | null
        const laps = meta?.completedLaps as number | undefined
        const best = meta?.bestLapTime as number | undefined
        return (!laps || laps <= 0) && (!best || best <= 0)
      })

      let deletedCount = 0
      for (const s of emptySessions) {
        await db.delete(schema.raceSessions)
          .where(and(
            eq(schema.raceSessions.id, s.id),
            eq(schema.raceSessions.userId, userId)
          ))
        deletedCount++
      }

      return NextResponse.json({ success: true, purged: deletedCount, total: allSessions.length })
    }

    return NextResponse.json({ error: 'Provide ?id=<sessionId> or ?purge=empty' }, { status: 400 })
  } catch (err) {
    console.error('[sessions/manage] DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
