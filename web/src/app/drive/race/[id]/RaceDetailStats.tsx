'use client'

import { useMemo } from 'react'
import { Timer, BarChart3, Gauge, Layers } from 'lucide-react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { LapAnalysis } from '@/lib/race-summary'

// ── Types ───────────────────────────────────────────────────────────────────────

interface LapTelemetryData {
  lapNumber: number
  lapTime: number | null
  sector1: number | null
  sector2: number | null
  sector3: number | null
  incidentCount: number
  isCleanLap: boolean | null
  rageScore: number | null
  throttleAggression: number | null
  steeringErraticism: number | null
  brakingAggression: number | null
  proximityChasing: number | null
}

interface SessionBehaviorData {
  hardBrakingEvents: number
  closePassCount: number
  tailgatingSeconds: number
  offTrackCount: number
  spinCount: number
  cleanLaps: number
  totalLaps: number
  peakRageScore: number
  avgRageScore: number
  rageSpikes: number
  cooldownsTriggered: number
  retaliationAttempts: number
  incidentsByPhase: Record<string, number> | null
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatLapTime(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3)
}

function formatSectorTime(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  return seconds.toFixed(3) + 's'
}

const chartColors = {
  lapTime: '#e53935',
  rageScore: '#ff9800',
  incident: '#f43f5e',
  clean: '#10b981',
  throttle: '#ff5252',
  steering: '#ff9800',
  braking: '#42a5f5',
  proximity: '#ab47bc',
  sector1: '#42a5f5',
  sector2: '#66bb6a',
  sector3: '#ffa726',
}

// ── Lap Time Chart ──────────────────────────────────────────────────────────────

function LapTimeChart({ laps, lapAnalysis }: { laps: LapTelemetryData[]; lapAnalysis: LapAnalysis }) {
  const data = useMemo(() =>
    laps
      .filter(l => l.lapTime && l.lapTime > 0)
      .map(l => ({
        lap: l.lapNumber,
        time: l.lapTime!,
        incident: l.incidentCount > 0,
        rage: l.rageScore ?? 0,
      })),
    [laps],
  )

  if (data.length === 0) return null

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Timer size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Lap Times</h3>
        {lapAnalysis.lapTimeProgression !== 'unknown' && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            lapAnalysis.lapTimeProgression === 'improving' ? 'bg-emerald-500/20 text-emerald-400' :
            lapAnalysis.lapTimeProgression === 'degrading' ? 'bg-rose-500/20 text-rose-400' :
            'bg-blue-500/20 text-blue-400'
          }`}>
            {lapAnalysis.lapTimeProgression === 'improving' ? 'Getting Faster' :
             lapAnalysis.lapTimeProgression === 'degrading' ? 'Pace Dropping' : 'Consistent'}
          </span>
        )}
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-[var(--bg-panel)] rounded p-2.5">
          <div className="text-xs text-[var(--text-muted)]">Best</div>
          <div className="text-sm font-bold text-emerald-400 tabular-nums" style={{ fontFamily: 'var(--ff-mono)' }}>
            {formatLapTime(lapAnalysis.bestLapTime)}
          </div>
          {lapAnalysis.bestLap && <div className="text-xs text-[var(--text-muted)]">Lap {lapAnalysis.bestLap}</div>}
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-2.5">
          <div className="text-xs text-[var(--text-muted)]">Average</div>
          <div className="text-sm font-bold text-[var(--text)] tabular-nums" style={{ fontFamily: 'var(--ff-mono)' }}>
            {formatLapTime(lapAnalysis.avgLapTime)}
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-2.5">
          <div className="text-xs text-[var(--text-muted)]">Worst</div>
          <div className="text-sm font-bold text-rose-400 tabular-nums" style={{ fontFamily: 'var(--ff-mono)' }}>
            {formatLapTime(lapAnalysis.worstLapTime)}
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] rounded p-2.5">
          <div className="text-xs text-[var(--text-muted)]">Consistency</div>
          <div className={`text-sm font-bold ${lapAnalysis.consistency >= 80 ? 'text-emerald-400' : lapAnalysis.consistency >= 50 ? 'text-blue-400' : 'text-amber-400'}`}>
            {lapAnalysis.consistency.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="lapTimeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.lapTime} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColors.lapTime} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="lap" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickFormatter={(v: number) => formatLapTime(v)}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v: any) => `Lap ${v}`}
            formatter={(v: any) => [formatLapTime(v), 'Lap Time']}
          />
          {lapAnalysis.avgLapTime && (
            <ReferenceLine y={lapAnalysis.avgLapTime} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
          )}
          <Area type="monotone" dataKey="time" stroke={chartColors.lapTime} fill="url(#lapTimeGrad)" strokeWidth={2} dot={(props: any) => {
            const { cx, cy, payload } = props
            if (payload.incident) {
              return <circle key={props.key} cx={cx} cy={cy} r={5} fill={chartColors.incident} stroke="white" strokeWidth={1.5} />
            }
            return <circle key={props.key} cx={cx} cy={cy} r={2.5} fill={chartColors.lapTime} />
          }} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: chartColors.lapTime }} />
          Lap Time
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: chartColors.incident }} />
          Incident Lap
        </span>
      </div>
    </div>
  )
}

// ── Sector Comparison ───────────────────────────────────────────────────────────

function SectorComparison({ laps, lapAnalysis }: { laps: LapTelemetryData[]; lapAnalysis: LapAnalysis }) {
  const hasSectors = laps.some(l => l.sector1 || l.sector2 || l.sector3)
  if (!hasSectors) return null

  const data = laps
    .filter(l => l.sector1 && l.sector2 && l.sector3)
    .map(l => ({
      lap: l.lapNumber,
      s1: l.sector1!,
      s2: l.sector2!,
      s3: l.sector3!,
    }))

  if (data.length === 0) return null

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Sector Times</h3>
      </div>

      {/* Sector best/avg row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Sector 1', color: chartColors.sector1, key: 's1' as const },
          { label: 'Sector 2', color: chartColors.sector2, key: 's2' as const },
          { label: 'Sector 3', color: chartColors.sector3, key: 's3' as const },
        ].map(({ label, color, key }) => {
          const times = data.map(d => d[key])
          const best = Math.min(...times)
          const avg = times.reduce((a, b) => a + b, 0) / times.length
          const isFastest = lapAnalysis.fastestSector?.sector === (key === 's1' ? 1 : key === 's2' ? 2 : 3)
          const isSlowest = lapAnalysis.slowestSector?.sector === (key === 's1' ? 1 : key === 's2' ? 2 : 3)

          return (
            <div key={key} className="bg-[var(--bg-panel)] rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
                {isFastest && <span className="text-xs text-emerald-400 font-semibold">Strongest</span>}
                {isSlowest && <span className="text-xs text-amber-400 font-semibold">Weakest</span>}
              </div>
              <div className="text-sm font-bold text-[var(--text)] tabular-nums" style={{ fontFamily: 'var(--ff-mono)' }}>
                {formatSectorTime(best)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">avg {formatSectorTime(avg)}</div>
            </div>
          )
        })}
      </div>

      {/* Sector chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="lap" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(1) + 's'}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v: any) => `Lap ${v}`}
            formatter={(v: any, name: any) => [Number(v).toFixed(3) + 's', name === 's1' ? 'Sector 1' : name === 's2' ? 'Sector 2' : 'Sector 3']}
          />
          <Line type="monotone" dataKey="s1" stroke={chartColors.sector1} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="s2" stroke={chartColors.sector2} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="s3" stroke={chartColors.sector3} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Behavioral Radar ────────────────────────────────────────────────────────────

function BehavioralOverview({ laps, behavior }: { laps: LapTelemetryData[]; behavior: SessionBehaviorData }) {
  // Normalize behavioral metrics to 0-100
  const avgThrottle = laps.reduce((sum, l) => sum + (l.throttleAggression || 0), 0) / (laps.length || 1)
  const avgSteering = laps.reduce((sum, l) => sum + (l.steeringErraticism || 0), 0) / (laps.length || 1)
  const avgBraking = laps.reduce((sum, l) => sum + (l.brakingAggression || 0), 0) / (laps.length || 1)
  const avgProximity = laps.reduce((sum, l) => sum + (l.proximityChasing || 0), 0) / (laps.length || 1)

  const radarData = [
    { metric: 'Throttle', value: (avgThrottle / 25) * 100, fullMark: 100 },
    { metric: 'Steering', value: (avgSteering / 20) * 100, fullMark: 100 },
    { metric: 'Braking', value: (avgBraking / 20) * 100, fullMark: 100 },
    { metric: 'Proximity', value: (avgProximity / 25) * 100, fullMark: 100 },
  ]

  const hasAnyData = radarData.some(d => d.value > 0)
  if (!hasAnyData) return null

  const cleanPct = behavior.totalLaps > 0 ? (behavior.cleanLaps / behavior.totalLaps * 100) : 0

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Driving Style</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Radar chart */}
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Session" dataKey="value" stroke={chartColors.lapTime} fill={chartColors.lapTime} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--bg-panel)] rounded p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Clean Laps</div>
            <div className={`text-xl font-bold ${cleanPct >= 80 ? 'text-emerald-400' : cleanPct >= 50 ? 'text-blue-400' : 'text-amber-400'}`}>
              {cleanPct.toFixed(0)}%
            </div>
            <div className="text-xs text-[var(--text-muted)]">{behavior.cleanLaps}/{behavior.totalLaps}</div>
          </div>
          <div className="bg-[var(--bg-panel)] rounded p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Close Passes</div>
            <div className="text-xl font-bold text-[var(--text)]">{behavior.closePassCount}</div>
          </div>
          <div className="bg-[var(--bg-panel)] rounded p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Off-Tracks</div>
            <div className={`text-xl font-bold ${behavior.offTrackCount === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {behavior.offTrackCount}
            </div>
          </div>
          <div className="bg-[var(--bg-panel)] rounded p-3">
            <div className="text-xs text-[var(--text-muted)] mb-1">Spins</div>
            <div className={`text-xl font-bold ${behavior.spinCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {behavior.spinCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Rage Timeline ───────────────────────────────────────────────────────────────

function RageTimeline({ laps }: { laps: LapTelemetryData[] }) {
  const data = laps
    .filter(l => l.rageScore !== null)
    .map(l => ({
      lap: l.lapNumber,
      rage: l.rageScore ?? 0,
      incident: l.incidentCount > 0,
    }))

  if (data.length === 0) return null

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-[var(--border-accent)]" />
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Rage Timeline</h3>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="lap" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v: any) => `Lap ${v}`}
            formatter={(v: any) => [Number(v).toFixed(1), 'Rage Score']}
          />
          <ReferenceLine y={30} stroke="rgba(255,152,0,0.3)" strokeDasharray="4 4" />
          <Bar dataKey="rage" radius={[3, 3, 0, 0]} fill={chartColors.rageScore}>
            {data.map((entry, idx) => (
              <rect key={idx} fill={entry.rage > 50 ? '#f44336' : entry.rage > 30 ? '#ff9800' : '#4caf50'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function RaceDetailStats({
  laps,
  behavior,
  lapAnalysis,
}: {
  laps: LapTelemetryData[]
  behavior: SessionBehaviorData | null
  lapAnalysis: LapAnalysis
}) {
  if (laps.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center">
        <Timer size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-dim)]">
          No lap telemetry available for this session. Enable the RaceCor plugin to capture detailed lap data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <LapTimeChart laps={laps} lapAnalysis={lapAnalysis} />
      <SectorComparison laps={laps} lapAnalysis={lapAnalysis} />
      {behavior && <BehavioralOverview laps={laps} behavior={behavior} />}
      {laps.some(l => l.rageScore !== null) && <RageTimeline laps={laps} />}
    </div>
  )
}
