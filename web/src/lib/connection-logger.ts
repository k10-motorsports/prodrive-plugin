// In-memory connection and database operation logger
// Stores recent logs for admin panel inspection

interface ConnectionLog {
  id: string
  timestamp: Date
  operation: string
  status: 'success' | 'failure'
  duration: number // milliseconds
  errorDetails?: string
}

class ConnectionLogger {
  private logs: ConnectionLog[] = []
  private maxLogs = 100

  log(
    operation: string,
    status: 'success' | 'failure',
    duration: number,
    errorDetails?: string
  ): void {
    const log: ConnectionLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      operation,
      status,
      duration,
      errorDetails,
    }

    this.logs.unshift(log)

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }
  }

  getLogs(limit: number = 50): ConnectionLog[] {
    return this.logs.slice(0, limit)
  }

  clear(): void {
    this.logs = []
  }

  getStats() {
    const total = this.logs.length
    const successful = this.logs.filter(l => l.status === 'success').length
    const failed = this.logs.filter(l => l.status === 'failure').length
    const avgDuration = total > 0
      ? this.logs.reduce((sum, l) => sum + l.duration, 0) / total
      : 0

    return {
      total,
      successful,
      failed,
      avgDuration: Math.round(avgDuration * 100) / 100,
    }
  }
}

export const connectionLogger = new ConnectionLogger()

// Helper to wrap async database operations with automatic logging
export async function logConnection<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    connectionLogger.log(operation, 'success', duration)
    return result
  } catch (error) {
    const duration = Date.now() - start
    const errorDetails = error instanceof Error ? error.message : String(error)
    connectionLogger.log(operation, 'failure', duration, errorDetails)
    throw error
  }
}
