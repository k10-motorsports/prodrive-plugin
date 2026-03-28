'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { TelemetrySnapshot } from '@/lib/telemetry'
import { TELEMETRY_API_URL, TELEMETRY_POLL_MS } from '@/lib/telemetry'

// ── Context shape ──────────────────────────────────────────────

interface TelemetryState {
  /** Latest snapshot from the API, or null before first fetch. */
  data: TelemetrySnapshot | null
  /** True while the first request is still in flight. */
  loading: boolean
  /** Connection status: 'connecting' | 'live' | 'error' */
  status: 'connecting' | 'live' | 'error'
  /** Measured poll round-trip in ms (last successful fetch). */
  latencyMs: number
}

const TelemetryContext = createContext<TelemetryState>({
  data: null,
  loading: true,
  status: 'connecting',
  latencyMs: 0,
})

// ── Provider ───────────────────────────────────────────────────

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TelemetrySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<TelemetryState['status']>('connecting')
  const [latencyMs, setLatencyMs] = useState(0)

  // Refs survive across renders — avoid stale closures in the poll loop
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const poll = useCallback(async () => {
    const t0 = performance.now()
    try {
      const res = await fetch(TELEMETRY_API_URL, { cache: 'no-store' })
      if (!mountedRef.current) return
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const snapshot: TelemetrySnapshot = await res.json()
      if (!mountedRef.current) return

      setData(snapshot)
      setLoading(false)
      setStatus('live')
      setLatencyMs(Math.round(performance.now() - t0))
    } catch {
      if (!mountedRef.current) return
      setStatus('error')
    }

    // Schedule next poll — chained setTimeout avoids overlap if a request
    // takes longer than the interval.
    if (mountedRef.current) {
      timerRef.current = setTimeout(poll, TELEMETRY_POLL_MS)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    poll()
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [poll])

  return (
    <TelemetryContext.Provider value={{ data, loading, status, latencyMs }}>
      {children}
    </TelemetryContext.Provider>
  )
}

// ── Hooks ──────────────────────────────────────────────────────

/** Access the full telemetry state (snapshot, status, latency). */
export function useTelemetry() {
  return useContext(TelemetryContext)
}

/**
 * Read a single property from the latest telemetry snapshot.
 *
 * Returns `undefined` when the key is absent or data hasn't loaded yet.
 * This is the primary hook ported dashboard components should use.
 *
 * @example
 * const gear = useTelemetryValue('DataCorePlugin.GameData.Gear')
 * const rpm  = useTelemetryValue<number>('DataCorePlugin.GameData.Rpms')
 */
export function useTelemetryValue<T extends string | number = string | number>(
  key: string,
): T | undefined {
  const { data } = useContext(TelemetryContext)
  return data ? (data[key] as T | undefined) : undefined
}
