'use client'

import { useTelemetry, useTelemetryValue } from './TelemetryProvider'

/**
 * Compact proof-of-life indicator showing the telemetry feed is active.
 * Displays connection status, latency, and a few live values.
 *
 * This is a placeholder — it'll be replaced (or removed) once real dashboard
 * components are ported. Its purpose is to verify the polling pipeline works.
 */
export function TelemetryStatus() {
  const { status, latencyMs, loading } = useTelemetry()

  const gear = useTelemetryValue<string>('DataCorePlugin.GameData.Gear')
  const speed = useTelemetryValue<number>('DataCorePlugin.GameData.SpeedMph')
  const rpm = useTelemetryValue<number>('DataCorePlugin.GameData.Rpms')
  const lap = useTelemetryValue<number>('DataCorePlugin.GameData.CurrentLap')
  const totalLaps = useTelemetryValue<number>('DataCorePlugin.GameData.TotalLaps')
  const track = useTelemetryValue<string>('DataCorePlugin.GameData.TrackName')
  const car = useTelemetryValue<string>('DataCorePlugin.GameData.CarModel')
  const position = useTelemetryValue<number>('DataCorePlugin.GameData.Position')
  const throttle = useTelemetryValue<number>('DataCorePlugin.GameData.Throttle')
  const brake = useTelemetryValue<number>('DataCorePlugin.GameData.Brake')

  const dotColor =
    status === 'live' ? 'bg-[var(--green)]' :
    status === 'error' ? 'bg-[var(--k10-red)]' :
    'bg-[var(--amber)]'

  const statusLabel =
    status === 'live' ? 'LIVE' :
    status === 'error' ? 'OFFLINE' :
    'CONNECTING'

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-dim)]">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />
          Connecting to telemetry feed...
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${dotColor} ${status === 'live' ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)]">
            Telemetry {statusLabel}
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          {latencyMs}ms
        </span>
      </div>

      {/* Live values grid */}
      {status === 'live' && (
        <div className="p-4">
          {/* Track & car context */}
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {track}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {car}
            </span>
          </div>

          {/* Telemetry readout */}
          <div className="grid grid-cols-4 gap-3">
            <TelemetryCell label="Gear" value={gear ?? '-'} large />
            <TelemetryCell label="Speed" value={speed != null ? `${Math.round(speed)}` : '-'} unit="mph" />
            <TelemetryCell label="RPM" value={rpm != null ? `${rpm}` : '-'} />
            <TelemetryCell label="Position" value={position != null ? `P${position}` : '-'} />
            <TelemetryCell label="Lap" value={lap != null && totalLaps != null ? `${lap}/${totalLaps}` : '-'} />
            <TelemetryCell label="Throttle" value={throttle != null ? `${Math.round(throttle * 100)}%` : '-'} />
            <TelemetryCell label="Brake" value={brake != null ? `${Math.round(brake * 100)}%` : '-'} />
            <TelemetryCell label="Poll" value={`${latencyMs}ms`} muted />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 text-center text-xs text-[var(--text-muted)]">
          Could not reach telemetry API. Retrying...
        </div>
      )}
    </div>
  )
}

// ── Tiny cell subcomponent ──

function TelemetryCell({
  label,
  value,
  unit,
  large,
  muted,
}: {
  label: string
  value: string
  unit?: string
  large?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">
        {label}
      </span>
      <span
        className={`font-mono leading-none ${
          large ? 'text-2xl font-black' : 'text-sm font-semibold'
        } ${muted ? 'text-[var(--text-muted)]' : 'text-[var(--text)]'}`}
      >
        {value}
        {unit && (
          <span className="text-[9px] text-[var(--text-muted)] ml-0.5">{unit}</span>
        )}
      </span>
    </div>
  )
}
