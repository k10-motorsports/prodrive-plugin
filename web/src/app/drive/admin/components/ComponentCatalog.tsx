'use client'

import { useState, ReactNode } from 'react'
import { SearchFilterBar, GameBadge, StatCard } from '@/app/drive/admin/components'
import IRatingSparkline from '@/app/drive/dashboard/IRatingSparkline'

// ── Mock SVG track path for previews ──
const MOCK_SVG_PATH = 'M50,15 C70,15 85,25 85,40 C85,55 75,60 70,70 C65,80 70,90 55,90 C40,90 35,80 30,70 C25,60 15,55 15,40 C15,25 30,15 50,15 Z'

// ── Component registry ─────────────────────────────────────────────

type Platform = 'web' | 'overlay'
type Category = 'admin' | 'dashboard' | 'shared' | 'driving' | 'race-info' | 'pit-strategy' | 'commentary' | 'visualization' | 'marketing'

interface ComponentEntry {
  name: string
  element?: string
  file: string
  platform: Platform
  category: Category
  description: string
  storyId?: string
  preview?: () => ReactNode
}

const SB = 'http://localhost:6006/?path=/story/'

// ── Overlay mockup helpers ──

function OverlayFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[hsla(0,0%,8%,0.90)] rounded-lg border border-[hsla(0,0%,100%,0.14)] font-[var(--ff)] ${className}`}>
      {children}
    </div>
  )
}

function OverlayLabel({ children }: { children: ReactNode }) {
  return <span className="text-[9px] uppercase tracking-wider text-white/45 font-medium">{children}</span>
}

// ── Registry ──

const components: ComponentEntry[] = [
  // ══════════════════════════════════════════
  // Web: Admin
  // ══════════════════════════════════════════
  {
    name: 'GameBadge',
    file: 'web/src/app/drive/admin/components.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Colored pill badge showing game name with semi-transparent tinted background.',
    storyId: 'admin-gamebadge--all-games',
    preview: () => (
      <div className="flex gap-2">
        <GameBadge game="iracing" />
        <GameBadge game="acc" />
      </div>
    ),
  },
  {
    name: 'StatCard',
    file: 'web/src/app/drive/admin/components.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Stat display with label and value. Supports color variants for positive/negative states.',
    storyId: 'admin-statcard--stats-row',
    preview: () => (
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Total" value={1247} />
        <StatCard label="OK" value={1221} color="green" />
        <StatCard label="Failed" value={26} color="red" />
        <StatCard label="Avg" value="142ms" color="muted" />
      </div>
    ),
  },
  {
    name: 'SearchFilterBar',
    file: 'web/src/app/drive/admin/components.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Search input with game filter dropdown and sort options. Used across Track Maps and Car Brands.',
    storyId: 'admin-searchfilterbar--default',
    preview: () => (
      <SearchFilterBar search="" onSearch={() => {}} game="" onGame={() => {}} sort="name-asc" onSort={() => {}} />
    ),
  },
  {
    name: 'OverviewCards',
    file: 'web/src/app/drive/admin/OverviewCards.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Admin dashboard overview with 4 summary cards. Hero artwork from commentary photos, small multiples (SVG tracks, logo circles, user avatars, log success bars).',
    preview: () => (
      <div className="grid grid-cols-2 gap-2">
        {[
          { title: 'TRACK MAPS', count: 15, color: '#e53935' },
          { title: 'CAR BRANDS', count: 20, color: '#e53935' },
          { title: 'USERS', count: 3, color: '#e53935' },
          { title: 'LOGS', count: 1247, color: '#e53935' },
        ].map(c => (
          <div key={c.title} className="border border-[var(--border)] rounded bg-[var(--bg-surface)] p-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[14px] font-bold text-[var(--k10-red)] uppercase">{c.title}</span>
              <span className="text-sm font-bold text-[var(--text-dim)] tabular-nums">{c.count}</span>
            </div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-5 h-5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)]" />
              ))}
              <span className="text-[8px] text-[var(--text-muted)] self-center ml-1">+{c.count - 4}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    name: 'TrackCard',
    file: 'web/src/app/drive/admin/tracks/TracksSection.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Track management card with SVG preview, editable display name, sector count toggle (3 ↔ 7), game badges, and delete action.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] p-4 flex gap-4 items-center">
        <svg viewBox="0 0 100 100" className="w-16 h-16 shrink-0">
          <path d={MOCK_SVG_PATH} fill="none" stroke="var(--border-accent)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-[var(--text)] mb-1">Spa-Francorchamps</h3>
          <div className="flex gap-2 items-center">
            <GameBadge game="iracing" />
            <span className="text-[14px] text-[var(--text-muted)]">7.004 km</span>
            <span className="text-[14px] px-1.5 py-0.5 rounded bg-[var(--bg-panel)] text-[var(--text-dim)] border border-[var(--border-subtle)]">3 sectors</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    name: 'LogoCard',
    file: 'web/src/app/drive/admin/brands/BrandsSection.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Brand logo card with SVG/PNG preview, color picker, game badges, opacity-tinted background, and clear-logo action.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg overflow-hidden" style={{ background: '#1e88e58C' }}>
        <div className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-lg font-bold text-white/80">B</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text)]">BMW</h3>
            <div className="flex gap-1.5 mt-1">
              <GameBadge game="iracing" />
              <GameBadge game="acc" />
            </div>
          </div>
          <div className="ml-auto w-6 h-6 rounded border border-[var(--border)] cursor-pointer" style={{ background: '#1e88e5' }} />
        </div>
      </div>
    ),
  },
  {
    name: 'MissingLogoCard',
    file: 'web/src/app/drive/admin/brands/BrandsSection.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Empty-state brand card for brands without uploaded logos. Shows brand name over color background with file upload.',
    preview: () => (
      <div className="border border-dashed border-[var(--border)] rounded-lg p-4 flex items-center gap-3 bg-[var(--bg-panel)]">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
          <span className="text-xs text-[var(--text-muted)]">+</span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-[var(--text-muted)]">Genesis</h3>
          <span className="text-[14px] text-[var(--text-muted)]">Upload SVG or PNG</span>
        </div>
      </div>
    ),
  },
  {
    name: 'AdminNav',
    file: 'web/src/app/drive/admin/AdminNav.tsx',
    platform: 'web',
    category: 'admin',
    description: 'Tab navigation with active route highlighting. Left-aligned data pages, right-aligned tool pages.',
    preview: () => (
      <div className="flex items-center border-b border-[var(--border)] text-[14px]">
        <div className="flex">
          {['Overview', 'Tracks', 'Brands', 'Users', 'Logs'].map((l, i) => (
            <span key={l} className={`px-3 py-1.5 font-medium uppercase border-b-2 -mb-[1px] ${i === 0 ? 'text-[var(--k10-red)] border-[var(--k10-red)]' : 'text-[var(--text-muted)] border-transparent'}`}>{l}</span>
          ))}
        </div>
        <div className="ml-auto flex">
          {['Styles', 'Components', 'Storybook ↗'].map(l => (
            <span key={l} className="px-3 py-1.5 font-medium uppercase text-[var(--text-muted)] border-b-2 border-transparent -mb-[1px]">{l}</span>
          ))}
        </div>
      </div>
    ),
  },

  // ══════════════════════════════════════════
  // Web: Dashboard
  // ══════════════════════════════════════════
  {
    name: 'IRatingSparkline',
    file: 'web/src/app/drive/dashboard/IRatingSparkline.tsx',
    platform: 'web',
    category: 'dashboard',
    description: 'Tiny SVG sparkline chart showing iRating trend. Color-coded: green (up), red (down), gray (flat).',
    storyId: 'dashboard-iratingsparkline--multiple-sparklines',
    preview: () => (
      <div className="flex flex-col gap-3">
        {[
          { label: 'Road', values: [1850, 1870, 1890, 1920, 1960, 2010], val: '2010', color: 'text-[var(--green)]' },
          { label: 'Oval', values: [1500, 1480, 1460, 1440, 1420, 1400], val: '1400', color: 'text-red-400' },
          { label: 'Dirt', values: [1200, 1210, 1205, 1208, 1202, 1206], val: '1206', color: 'text-[var(--text-dim)]' },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)] w-10">{r.label}</span>
            <IRatingSparkline values={r.values} />
            <span className={`text-xs font-mono ${r.color}`}>{r.val}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    name: 'RaceCard',
    file: 'web/src/app/drive/dashboard/RaceCard.tsx',
    platform: 'web',
    category: 'dashboard',
    description: 'Session history card with track photo background, SVG track outline, position badge (P1–P3 podium colors, DNF red), best lap, incidents, and iRating sparkline.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-[var(--bg-panel)] to-[var(--bg-elevated)] relative flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-14 h-14 opacity-30">
            <path d={MOCK_SVG_PATH} fill="none" stroke="var(--border-accent)" strokeWidth="2" />
          </svg>
        </div>
        <div className="p-3">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="text-sm font-bold text-[var(--text)]">Spa-Francorchamps</h4>
              <span className="text-[14px] text-[var(--text-muted)]">BMW M4 GT3 · Race</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">P2</span>
          </div>
          <div className="flex gap-4 text-[14px] text-[var(--text-dim)]">
            <span>2:18.435</span>
            <span>4x incidents</span>
            <IRatingSparkline values={[1900, 1920, 1950, 1970]} />
          </div>
        </div>
      </div>
    ),
  },
  {
    name: 'LogoCustomizer',
    file: 'web/src/app/drive/dashboard/LogoCustomizer.tsx',
    platform: 'web',
    category: 'dashboard',
    description: 'User-facing logo URL editor for custom overlay branding. Live preview, HTTPS validation, reset to default.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] p-4">
        <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wide mb-3">Custom Logo</h4>
        <div className="flex gap-3 items-center">
          <div className="w-10 h-10 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] flex items-center justify-center">
            <span className="text-[8px] text-[var(--text-muted)]">LOGO</span>
          </div>
          <input className="flex-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)]" placeholder="https://example.com/logo.png" readOnly />
          <button className="text-[14px] text-[var(--k10-red)] px-2 py-1 rounded border border-[var(--border-subtle)]">Reset</button>
        </div>
      </div>
    ),
  },

  // ══════════════════════════════════════════
  // Web: Marketing / Shared
  // ══════════════════════════════════════════
  {
    name: 'FeatureShowcase',
    file: 'web/src/components/telemetry/FeatureShowcase.tsx',
    platform: 'web',
    category: 'marketing',
    description: 'Auto-cycling feature carousel showing 13 overlay modules with screenshots and descriptions. 8-second cycle with manual selection.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] p-4">
        <div className="flex gap-1 mb-3 overflow-hidden">
          {['Tacho', 'Pedals', 'Fuel', 'Timing', 'Position', 'Board', 'AI'].map((f, i) => (
            <span key={f} className={`text-[8px] px-2 py-0.5 rounded-full shrink-0 ${i === 0 ? 'bg-[var(--k10-red)] text-white' : 'bg-[var(--bg-panel)] text-[var(--text-muted)]'}`}>{f}</span>
          ))}
        </div>
        <div className="h-16 bg-[var(--bg-panel)] rounded flex items-center justify-center">
          <span className="text-xs text-[var(--text-dim)]">Tachometer — RPM gauge with redline flash</span>
        </div>
      </div>
    ),
  },
  {
    name: 'TelemetryStatus',
    file: 'web/src/components/telemetry/TelemetryStatus.tsx',
    platform: 'web',
    category: 'shared',
    description: 'Live telemetry connection status with connection indicator, latency, track/car info, and real-time value grid.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-[var(--green)]" />
          <span className="text-xs text-[var(--text)]">Connected</span>
          <span className="text-[14px] text-[var(--text-muted)] ml-auto font-mono">12ms</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[{ l: 'GEAR', v: '4' }, { l: 'SPD', v: '142' }, { l: 'RPM', v: '7842' }, { l: 'POS', v: 'P3' }].map(c => (
            <div key={c.l} className="bg-[var(--bg-panel)] rounded px-2 py-1 text-center">
              <div className="text-[8px] text-[var(--text-muted)] uppercase">{c.l}</div>
              <div className="text-sm font-bold text-[var(--text)] font-mono">{c.v}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    name: 'ChannelBanner',
    file: 'web/src/components/youtube/ChannelBanner.tsx',
    platform: 'web',
    category: 'marketing',
    description: 'YouTube channel header with thumbnail, title, subscriber/video/view counts, and subscribe button.',
    preview: () => (
      <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--k10-red)] flex items-center justify-center text-white font-bold text-lg">K</div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-[var(--text)]">K10 Motorsports</h4>
          <span className="text-[14px] text-[var(--text-muted)]">2.4K subscribers · 89 videos</span>
        </div>
        <button className="text-[14px] font-bold bg-[var(--k10-red)] text-white px-3 py-1 rounded">Subscribe</button>
      </div>
    ),
  },
  {
    name: 'VideoGrid',
    file: 'web/src/components/youtube/VideoGrid.tsx',
    platform: 'web',
    category: 'marketing',
    description: 'Responsive video grid with type filtering (Videos/Shorts/Live). Cards show thumbnail, title, duration, view count.',
    preview: () => (
      <div>
        <div className="flex gap-2 mb-2">
          {['Videos', 'Shorts', 'Live'].map((t, i) => (
            <span key={t} className={`text-[9px] px-2 py-0.5 rounded ${i === 0 ? 'bg-white/10 text-white' : 'text-[var(--text-muted)]'}`}>{t}</span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['Race Recap: Spa 24h', 'Setup Guide: GT3', 'Livery Tutorial'].map(t => (
            <div key={t} className="rounded overflow-hidden border border-[var(--border-subtle)]">
              <div className="h-10 bg-[var(--bg-panel)] flex items-end justify-end p-1">
                <span className="text-[7px] bg-black/70 text-white px-1 rounded">12:34</span>
              </div>
              <div className="p-1.5">
                <p className="text-[8px] text-[var(--text)] leading-tight truncate">{t}</p>
                <p className="text-[7px] text-[var(--text-muted)]">1.2K views</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ══════════════════════════════════════════
  // Overlay: Driving
  // ══════════════════════════════════════════
  {
    name: 'Tachometer',
    element: 'racecor-tachometer',
    file: 'racecor-overlay/modules/components/tachometer.js',
    platform: 'overlay',
    category: 'driving',
    description: 'RPM gauge with segmented color bar (green/yellow/red zones), large gear display, speed readout. Flashes at 91%+ RPM.',
    preview: () => (
      <OverlayFrame className="p-3 flex items-center gap-3">
        <div className="flex gap-[2px] h-5 items-end">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="w-1.5 rounded-sm" style={{
              height: `${8 + i * 0.6}px`,
              background: i < 12 ? '#43a047' : i < 16 ? '#ffb300' : '#e53935',
              opacity: i < 14 ? 1 : 0.3,
            }} />
          ))}
        </div>
        <span className="text-3xl font-black text-white font-mono">4</span>
        <div className="text-right ml-auto">
          <div className="text-lg font-bold text-white font-mono leading-none">142</div>
          <div className="text-[8px] text-white/45 uppercase">mph</div>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'DriveHUD',
    element: 'racecor-drive-hud',
    file: 'racecor-overlay/modules/components/drive-hud.js',
    platform: 'overlay',
    category: 'driving',
    description: '3-column driving display: track map with player/opponent dots, position/lap delta/sector times, incident counter. Supports 3 or 7 sectors.',
    preview: () => (
      <OverlayFrame className="p-3 grid grid-cols-3 gap-2">
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-16 h-16">
            <path d={MOCK_SVG_PATH} fill="none" stroke="white" strokeWidth="1.5" opacity="0.3" />
            <circle cx="55" cy="40" r="3" fill="#00acc1" />
            <circle cx="45" cy="60" r="2" fill="white" opacity="0.5" />
            <circle cx="65" cy="35" r="2" fill="white" opacity="0.5" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <div className="text-lg font-black text-white">P3</div>
          <div className="text-xs font-mono text-[#43a047]">−0.312</div>
          <div className="flex gap-0.5 justify-center">
            <span className="text-[7px] px-1 py-0.5 rounded bg-[#43a047]/20 text-[#43a047] font-mono">28.4</span>
            <span className="text-[7px] px-1 py-0.5 rounded bg-[#ffb300]/20 text-[#ffb300] font-mono">31.2</span>
            <span className="text-[7px] px-1 py-0.5 rounded bg-white/10 text-white/50 font-mono">—</span>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="text-[8px] text-white/45 uppercase">INC</div>
            <div className="text-lg font-bold text-[#ffb300] font-mono">4x</div>
          </div>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'PedalCurves',
    element: 'racecor-pedal-curves',
    file: 'racecor-overlay/modules/components/pedal-curves.js',
    platform: 'overlay',
    category: 'driving',
    description: 'Canvas-based pedal input visualization with throttle/brake/clutch curves, histogram overlay, and response curve display.',
    preview: () => (
      <OverlayFrame className="p-3 flex gap-3">
        {[
          { label: 'THR', pct: 82, color: '#43a047' },
          { label: 'BRK', pct: 0, color: '#e53935' },
          { label: 'CLT', pct: 0, color: '#1e88e5' },
        ].map(p => (
          <div key={p.label} className="flex-1">
            <div className="text-[8px] text-white/45 text-center mb-1">{p.label}</div>
            <div className="h-14 bg-white/5 rounded relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 rounded-b transition-all" style={{ height: `${p.pct}%`, background: p.color, opacity: 0.7 }} />
            </div>
            <div className="text-[9px] text-white/55 text-center mt-1 font-mono">{p.pct}%</div>
          </div>
        ))}
      </OverlayFrame>
    ),
  },
  {
    name: 'Datastream',
    element: 'racecor-datastream',
    file: 'racecor-overlay/modules/components/datastream.js',
    platform: 'overlay',
    category: 'driving',
    description: 'Telemetry readout panel with G-force diamond, yaw rate waveform, steering torque, track temperature, lap delta.',
    preview: () => (
      <OverlayFrame className="p-3">
        <div className="flex gap-3 items-center">
          <div className="relative w-12 h-12 border border-white/14 rounded bg-white/5">
            <div className="absolute w-1.5 h-1.5 rounded-full bg-[#00acc1]" style={{ left: '60%', top: '45%' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[1px] h-full bg-white/10" />
            </div>
            <div className="absolute inset-0 flex items-center">
              <div className="h-[1px] w-full bg-white/10" />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[
              { l: 'LAT G', v: '1.2', color: '#00acc1' },
              { l: 'LON G', v: '-0.4', color: '#ffb300' },
              { l: 'YAW', v: '12.3°/s', color: 'white' },
              { l: 'TRACK', v: '42°C', color: '#fb8c00' },
            ].map(r => (
              <div key={r.l} className="flex justify-between text-[8px]">
                <span className="text-white/45 uppercase">{r.l}</span>
                <span className="font-mono" style={{ color: r.color }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'SectorHUD',
    element: 'racecor-sector-hud',
    file: 'racecor-overlay/modules/components/sector-hud.js',
    platform: 'overlay',
    category: 'driving',
    description: 'Sector time display with color coding: green (faster), amber (slower), red (much slower), purple (personal best).',
    preview: () => (
      <OverlayFrame className="p-2 flex gap-1">
        {[
          { s: 'S1', t: '28.412', color: '#43a047' },
          { s: 'S2', t: '31.204', color: '#7c6cf0' },
          { s: 'S3', t: '—', color: 'rgba(255,255,255,0.45)' },
        ].map(s => (
          <div key={s.s} className="flex-1 text-center bg-white/5 rounded px-2 py-1.5">
            <div className="text-[7px] text-white/45 uppercase">{s.s}</div>
            <div className="text-xs font-mono font-bold" style={{ color: s.color }}>{s.t}</div>
          </div>
        ))}
      </OverlayFrame>
    ),
  },

  // ══════════════════════════════════════════
  // Overlay: Race Info
  // ══════════════════════════════════════════
  {
    name: 'Leaderboard',
    element: 'racecor-leaderboard',
    file: 'racecor-overlay/modules/components/leaderboard.js',
    platform: 'overlay',
    category: 'race-info',
    description: 'Full standings table with driver names, positions, gaps, iRating, and Canvas-rendered sparkline history.',
    preview: () => (
      <OverlayFrame className="p-2">
        {[
          { pos: 1, name: 'M. Verstappen', gap: 'Leader', ir: '5.2k', me: false },
          { pos: 2, name: 'L. Hamilton', gap: '+1.234', ir: '4.8k', me: false },
          { pos: 3, name: 'alternatekev', gap: '+3.891', ir: '2.0k', me: true },
          { pos: 4, name: 'S. Leclerc', gap: '+5.102', ir: '4.5k', me: false },
        ].map(d => (
          <div key={d.pos} className={`grid grid-cols-[20px_1fr_50px_36px] gap-1 py-1 px-2 text-[9px] items-center ${d.me ? 'bg-[#00acc1]/10 rounded' : ''}`}>
            <span className="font-bold text-white/80 font-mono">{d.pos}</span>
            <span className={d.me ? 'text-[#00acc1] font-bold' : 'text-white/69'}>{d.name}</span>
            <span className="text-right text-white/55 font-mono">{d.gap}</span>
            <span className="text-right text-white/45 font-mono">{d.ir}</span>
          </div>
        ))}
      </OverlayFrame>
    ),
  },
  {
    name: 'PositionCard',
    element: 'racecor-position-card',
    file: 'racecor-overlay/modules/components/position-card.js',
    platform: 'overlay',
    category: 'race-info',
    description: 'Current position display (P1, P2, etc.) with iRating and Safety Rating. Cycles through rating categories.',
    preview: () => (
      <OverlayFrame className="p-3 text-center">
        <div className="text-[8px] text-white/45 uppercase mb-1">Position</div>
        <div className="text-3xl font-black text-white leading-none">P3</div>
        <div className="text-[8px] text-white/45 mt-1">of 22</div>
        <div className="flex justify-center gap-3 mt-2 pt-2 border-t border-white/10">
          <div><div className="text-[7px] text-white/45">iRating</div><div className="text-xs font-mono text-white font-bold">2,014</div></div>
          <div><div className="text-[7px] text-white/45">SR</div><div className="text-xs font-mono text-[#43a047] font-bold">A 3.42</div></div>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'GapDisplay',
    element: 'racecor-gap-display',
    file: 'racecor-overlay/modules/components/gap-display.js',
    platform: 'overlay',
    category: 'race-info',
    description: 'Time gap to car ahead/behind with driver names. Color-coded: green shrinking, red growing.',
    preview: () => (
      <OverlayFrame className="p-2 space-y-1">
        <div className="flex justify-between items-center text-[9px] px-2 py-1 bg-white/5 rounded">
          <span className="text-white/45">▲ L. Hamilton</span>
          <span className="font-mono font-bold text-[#e53935]">+1.234</span>
        </div>
        <div className="flex justify-between items-center text-[9px] px-2 py-1 bg-white/5 rounded">
          <span className="text-white/45">▼ S. Leclerc</span>
          <span className="font-mono font-bold text-[#43a047]">−2.891</span>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'Incidents',
    element: 'racecor-incidents',
    file: 'racecor-overlay/modules/components/incidents.js',
    platform: 'overlay',
    category: 'race-info',
    description: 'Incident counter with penalty and disqualification threshold indicators. Flashes on new incidents.',
    preview: () => (
      <OverlayFrame className="p-3 text-center w-fit mx-auto">
        <div className="text-[8px] text-white/45 uppercase">Incidents</div>
        <div className="text-2xl font-bold text-[#ffb300] font-mono">4x</div>
        <div className="flex gap-3 mt-1 text-[7px]">
          <span className="text-white/35">Pen: 17x</span>
          <span className="text-white/35">DQ: 25x</span>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'RaceEnd',
    element: 'racecor-race-end',
    file: 'racecor-overlay/modules/components/race-end.js',
    platform: 'overlay',
    category: 'race-info',
    description: 'Post-race results screen: finishing position, best lap, incidents, iRating/SR delta. Auto-hides after 30s.',
    preview: () => (
      <OverlayFrame className="p-4 text-center">
        <div className="text-[8px] text-white/45 uppercase tracking-wider mb-1">Checkered Flag</div>
        <div className="text-3xl font-black text-white">P3</div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-[8px]">
          <div><div className="text-white/45">Best Lap</div><div className="text-xs font-mono text-white">2:18.4</div></div>
          <div><div className="text-white/45">iRating</div><div className="text-xs font-mono text-[#43a047]">+47</div></div>
          <div><div className="text-white/45">SR</div><div className="text-xs font-mono text-[#43a047]">+0.12</div></div>
        </div>
      </OverlayFrame>
    ),
  },

  // ══════════════════════════════════════════
  // Overlay: Pit & Strategy
  // ══════════════════════════════════════════
  {
    name: 'Pitbox',
    element: 'racecor-pitbox',
    file: 'racecor-overlay/modules/components/pitbox.js',
    platform: 'overlay',
    category: 'pit-strategy',
    description: 'Tabbed pit strategy panel: Fuel, Tires, Strategy tabs. Fuel consumption, tire wear/selection, pit window timing.',
    preview: () => (
      <OverlayFrame className="overflow-hidden">
        <div className="flex text-[8px] border-b border-white/14">
          {['Fuel', 'Tires', 'Strategy'].map((t, i) => (
            <span key={t} className={`flex-1 text-center py-1.5 uppercase font-medium ${i === 0 ? 'text-white bg-white/10' : 'text-white/45'}`}>{t}</span>
          ))}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex justify-between text-[9px]"><span className="text-white/45">Level</span><span className="font-mono text-[#43a047]">68%</span></div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#43a047]" style={{ width: '68%' }} /></div>
          <div className="flex justify-between text-[9px]"><span className="text-white/45">Per Lap</span><span className="font-mono text-white/69">2.4L</span></div>
          <div className="flex justify-between text-[9px]"><span className="text-white/45">Laps Left</span><span className="font-mono text-white/69">14.2</span></div>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'FuelGauge',
    element: 'racecor-fuel-gauge',
    file: 'racecor-overlay/modules/components/fuel-gauge.js',
    platform: 'overlay',
    category: 'pit-strategy',
    description: 'Fuel level with consumption rate per lap and laps remaining estimate. Color transitions green → amber → red.',
    preview: () => (
      <OverlayFrame className="p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <OverlayLabel>Fuel</OverlayLabel>
            <div className="h-3 bg-white/10 rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#43a047] to-[#ffb300]" style={{ width: '42%' }} />
            </div>
          </div>
          <span className="text-sm font-mono font-bold text-[#ffb300]">42%</span>
        </div>
        <div className="flex justify-between mt-2 text-[8px] text-white/45">
          <span>2.4L/lap</span>
          <span className="font-mono text-[#ffb300]">8.7 laps</span>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'TireGrid',
    element: 'racecor-tire-grid',
    file: 'racecor-overlay/modules/components/tire-grid.js',
    platform: 'overlay',
    category: 'pit-strategy',
    description: '2×2 tire grid: temperature, wear percentage, and compound indicator for each wheel position.',
    preview: () => (
      <OverlayFrame className="p-3">
        <div className="grid grid-cols-2 gap-1">
          {[
            { pos: 'FL', temp: 92, wear: 88, color: '#43a047' },
            { pos: 'FR', temp: 96, temp_color: '#ffb300', wear: 82, color: '#43a047' },
            { pos: 'RL', temp: 88, wear: 91, color: '#43a047' },
            { pos: 'RR', temp: 94, wear: 74, color: '#ffb300' },
          ].map(t => (
            <div key={t.pos} className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-[7px] text-white/45">{t.pos}</div>
              <div className="text-[14px] font-mono font-bold" style={{ color: t.color }}>{t.wear}%</div>
              <div className="text-[7px] font-mono text-white/55">{t.temp}°C</div>
            </div>
          ))}
        </div>
      </OverlayFrame>
    ),
  },

  // ══════════════════════════════════════════
  // Overlay: Commentary & Status
  // ══════════════════════════════════════════
  {
    name: 'Commentary',
    element: 'racecor-commentary',
    file: 'racecor-overlay/modules/components/commentary.js',
    platform: 'overlay',
    category: 'commentary',
    description: 'AI commentary text panel with dynamic sentiment coloring (hue-based). Auto-shows on new messages with slide-in animation.',
    preview: () => (
      <div className="rounded-lg p-3 border" style={{ background: 'hsla(145, 40%, 12%, 0.90)', borderColor: 'hsla(145, 50%, 40%, 0.3)' }}>
        <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: 'hsla(145, 60%, 60%, 0.8)' }}>Overtake Analysis</div>
        <div className="text-xs text-white/80 leading-relaxed">Clean move into La Source! Used the slipstream down Kemmel to get alongside before braking.</div>
        <div className="text-[7px] text-white/35 mt-1">Lap 12 · Turn 1</div>
      </div>
    ),
  },
  {
    name: 'CommentaryViz',
    element: 'racecor-commentary-viz',
    file: 'racecor-overlay/modules/components/commentary-viz.js',
    platform: 'overlay',
    category: 'commentary',
    description: 'Enhanced commentary with Canvas-based telemetry visualization charts and backdrop track image.',
    preview: () => (
      <div className="rounded-lg overflow-hidden border" style={{ background: 'hsla(200, 40%, 12%, 0.90)', borderColor: 'hsla(200, 50%, 40%, 0.3)' }}>
        <div className="h-12 bg-white/5 flex items-center justify-center">
          <svg viewBox="0 0 100 20" className="w-full h-4 px-4">
            <polyline points="0,15 15,12 30,8 45,10 60,5 75,8 90,3 100,6" fill="none" stroke="#00acc1" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="p-3">
          <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: 'hsla(200, 60%, 60%, 0.8)' }}>Speed Analysis</div>
          <div className="text-[14px] text-white/80 leading-relaxed">Top speed through speed trap: 287 km/h — 4 km/h faster than the field average.</div>
        </div>
      </div>
    ),
  },
  {
    name: 'RaceControl',
    element: 'racecor-race-control',
    file: 'racecor-overlay/modules/components/race-control.js',
    platform: 'overlay',
    category: 'commentary',
    description: 'Full-width flag banner (yellow, red, checkered, black, meatball) with animated stripe pattern and auto-dismiss.',
    preview: () => (
      <div className="rounded-lg overflow-hidden">
        <div className="py-2 px-4 text-center font-bold text-sm uppercase tracking-wider" style={{ background: 'linear-gradient(90deg, hsl(48,90%,55%) 0%, hsl(48,90%,45%) 100%)', color: '#000' }}>
          ⚠ Full Course Yellow — Incident T4
        </div>
      </div>
    ),
  },

  // ══════════════════════════════════════════
  // Overlay: Visualization
  // ══════════════════════════════════════════
  {
    name: 'DriverProfile',
    element: 'racecor-driver-profile',
    file: 'racecor-overlay/modules/components/driver-profile.js',
    platform: 'overlay',
    category: 'visualization',
    description: 'Driver analytics panel with iRating/SR trend sparklines and session statistics.',
    preview: () => (
      <OverlayFrame className="p-3">
        <div className="text-sm font-black text-white mb-2" style={{ fontFamily: 'var(--ff-display, sans-serif)' }}>alternatekev</div>
        <div className="flex gap-4">
          <div>
            <div className="text-[7px] text-white/45 uppercase">iRating</div>
            <div className="text-lg font-mono font-bold text-white">2,014</div>
            <svg viewBox="0 0 60 20" className="w-14 h-4 mt-1"><polyline points="0,18 10,15 20,12 30,14 40,10 50,8 60,5" fill="none" stroke="#43a047" strokeWidth="1.5" /></svg>
          </div>
          <div>
            <div className="text-[7px] text-white/45 uppercase">Safety</div>
            <div className="text-lg font-mono font-bold text-[#1e88e5]">A 3.42</div>
            <svg viewBox="0 0 60 20" className="w-14 h-4 mt-1"><polyline points="0,12 10,10 20,11 30,8 40,6 50,7 60,4" fill="none" stroke="#1e88e5" strokeWidth="1.5" /></svg>
          </div>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'RaceTimeline',
    element: 'racecor-race-timeline',
    file: 'racecor-overlay/modules/components/race-timeline.js',
    platform: 'overlay',
    category: 'visualization',
    description: 'Position history heat-map strip showing position changes throughout the race.',
    preview: () => (
      <OverlayFrame className="p-2">
        <OverlayLabel>Position History</OverlayLabel>
        <div className="flex gap-[1px] mt-1 h-5">
          {[8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3].map((pos, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{
              background: pos <= 3 ? '#43a047' : pos <= 5 ? '#ffb300' : '#e53935',
              opacity: 0.3 + (1 - pos / 10) * 0.7,
            }} />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[7px] text-white/35">
          <span>Lap 1</span>
          <span>Lap 20</span>
        </div>
      </OverlayFrame>
    ),
  },
  {
    name: 'WebGL FX',
    element: 'racecor-webgl-fx',
    file: 'racecor-overlay/modules/components/webgl-fx.js',
    platform: 'overlay',
    category: 'visualization',
    description: 'WebGL2 effects engine for glow, bloom, and ambient lighting post-processing.',
    preview: () => (
      <OverlayFrame className="p-3 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{
          background: 'radial-gradient(ellipse at 30% 50%, rgba(229,57,53,0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(30,136,229,0.3) 0%, transparent 60%)',
        }} />
        <div className="relative text-center">
          <div className="text-[8px] text-white/45 uppercase tracking-wider">WebGL Post-Processing</div>
          <div className="text-[14px] text-white/60 mt-1">Bloom · Glow · Ambient Light</div>
          <div className="flex justify-center gap-3 mt-2">
            {['R: 80', 'G: 100', 'B: 140'].map(c => (
              <span key={c} className="text-[7px] font-mono text-white/35">{c}</span>
            ))}
          </div>
        </div>
      </OverlayFrame>
    ),
  },
]

// ── Category metadata ──

const categoryMeta: Record<Category, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400' },
  dashboard: { label: 'Dashboard', color: 'bg-blue-500/20 text-blue-400' },
  shared: { label: 'Shared', color: 'bg-green-500/20 text-green-400' },
  marketing: { label: 'Marketing', color: 'bg-amber-500/20 text-amber-400' },
  driving: { label: 'Driving', color: 'bg-cyan-500/20 text-cyan-400' },
  'race-info': { label: 'Race Info', color: 'bg-purple-500/20 text-purple-400' },
  'pit-strategy': { label: 'Pit & Strategy', color: 'bg-orange-500/20 text-orange-400' },
  commentary: { label: 'Commentary', color: 'bg-pink-500/20 text-pink-400' },
  visualization: { label: 'Visualization', color: 'bg-indigo-500/20 text-indigo-400' },
}

// ── Render ──

function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`text-[14px] font-mono px-1.5 py-0.5 rounded ${
      platform === 'web' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
    }`}>
      {platform === 'web' ? 'React' : 'Web Component'}
    </span>
  )
}

function CategoryBadge({ category }: { category: Category }) {
  const meta = categoryMeta[category]
  return <span className={`text-[14px] font-mono px-1.5 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
}

function ComponentCard({ entry }: { entry: ComponentEntry }) {
  const storyUrl = entry.storyId ? `${SB}${entry.storyId}` : null

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--bg-surface)] hover:border-[var(--border-accent)] transition-colors overflow-hidden">
      {entry.preview && (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg)] p-4">
          {entry.preview()}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1.5">
          <div>
            <h3 className="text-sm font-bold text-[var(--text)]">{entry.name}</h3>
            {entry.element && (
              <code className="text-[9px] text-[var(--text-muted)] font-mono">&lt;{entry.element}&gt;</code>
            )}
          </div>
          <div className="flex gap-1.5">
            <PlatformBadge platform={entry.platform} />
            <CategoryBadge category={entry.category} />
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-dim)] mb-2 leading-relaxed">{entry.description}</p>
        <div className="flex items-center justify-between">
          <code className="text-[9px] text-[var(--text-muted)] font-mono truncate">{entry.file}</code>
          {storyUrl && (
            <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-[var(--purple)] hover:underline ml-3 shrink-0">
              Storybook ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

type Filter = 'all' | 'web' | 'overlay'

export default function ComponentCatalog() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = components.filter(c => {
    if (filter !== 'all' && c.platform !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.includes(q) || (c.element?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  const grouped = new Map<Category, ComponentEntry[]>()
  for (const c of filtered) {
    const list = grouped.get(c.category) || []
    list.push(c)
    grouped.set(c.category, list)
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <div className="flex gap-1 border-b border-[var(--border)]">
          {([
            { id: 'all' as Filter, label: 'All', count: components.length },
            { id: 'web' as Filter, label: 'Web', count: components.filter(c => c.platform === 'web').length },
            { id: 'overlay' as Filter, label: 'Overlay', count: components.filter(c => c.platform === 'overlay').length },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)} className={`px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors border-b-2 -mb-[1px] ${
              filter === tab.id ? 'text-[var(--text)] border-[var(--text)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-dim)]'
            }`}>
              {tab.label} <span className="text-[14px] text-[var(--text-muted)] ml-1">{tab.count}</span>
            </button>
          ))}
        </div>
        <input type="text" placeholder="Search components…" value={search} onChange={e => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded-md bg-[var(--bg-panel)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-accent)] w-64" />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="text-xs text-[var(--text-muted)]">
          <strong className="text-[var(--text)]">{filtered.length}</strong> components
          {' · '}<strong className="text-blue-400">{filtered.filter(c => c.platform === 'web').length}</strong> React
          {' · '}<strong className="text-purple-400">{filtered.filter(c => c.platform === 'overlay').length}</strong> Web Components
        </div>
        <a href="http://localhost:6006" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[var(--purple)] hover:underline">
          Open Storybook ↗
        </a>
      </div>

      {Array.from(grouped.entries()).map(([category, entries]) => (
        <section key={category} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <CategoryBadge category={category} />
            <span className="text-xs text-[var(--text-muted)]">{entries.length} components</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entries.map(entry => (
              <ComponentCard key={`${entry.name}-${entry.platform}`} entry={entry} />
            ))}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] italic py-12 text-center">No components match your search.</p>
      )}
    </div>
  )
}
