import { NextRequest, NextResponse } from 'next/server'
import { validateToken } from '@/lib/plugin-auth'
import { db, schema } from '@/db'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/sessions/enrich — Add telemetry enrichment data to a session
 *
 * Updates the session's metadata JSONB with telemetry stats.
 *
 * Auth: Bearer token (plugin auth)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'missing_token' }, { status: 401 })
  }

  const result = await validateToken(authHeader.slice(7))
  if (!result) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { sessionId, telemetry } = body

    if (!sessionId || !telemetry) {
      return NextResponse.json({ error: 'Missing sessionId or telemetry data' }, { status: 400 })
    }

    // Find the session — must belong to this user
    const sessions = await db.select().from(schema.raceSessions)
      .where(and(
        eq(schema.raceSessions.id, sessionId),
        eq(schema.raceSessions.userId, result.user.id)
      ))
      .limit(1)

    if (sessions.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = sessions[0]
    const existingMetadata = (session.metadata as Record<string, unknown>) || {}

    // Merge telemetry enrichment into existing metadata
    const enrichedMetadata = {
      ...existingMetadata,
      telemetryEnrichment: {
        ...telemetry,
        enrichedAt: new Date().toISOString(),
      }
    }

    await db.update(schema.raceSessions).set({
      metadata: enrichedMetadata,
    }).where(eq(schema.raceSessions.id, sessionId))

    return NextResponse.json({ success: true, enriched: true })
  } catch (err: any) {
    console.error('[sessions/enrich] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
