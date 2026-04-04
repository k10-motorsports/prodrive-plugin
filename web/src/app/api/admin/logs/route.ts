import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { connectionLogger } from '@/lib/connection-logger'

/**
 * GET /api/admin/logs
 * Returns recent connection and database operation logs
 */
export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const logs = connectionLogger.getLogs(50)
    const stats = connectionLogger.getStats()

    return NextResponse.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        operation: log.operation,
        status: log.status,
        duration: log.duration,
        errorDetails: log.errorDetails || null,
      })),
      stats,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch logs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
