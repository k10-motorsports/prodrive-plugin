'use client'

export default function PreviewPanel() {
  return (
    <div className="mt-8 border-t border-[var(--border)] pt-8">
      <h2 className="text-lg font-bold tracking-wide uppercase text-[var(--text)] mb-4">
        Live Preview
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        This panel uses CSS variables — edits above reflect here in real-time.
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Color & Background preview */}
        <div className="space-y-6">
          {/* Background layers */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Background Layers
            </h3>
            <div
              className="p-4 rounded-lg"
              style={{ background: 'var(--bg)', borderRadius: 'var(--corner-r)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>--bg</span>
              <div
                className="mt-2 p-3 rounded-md"
                style={{ background: 'var(--bg-surface)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>--bg-surface</span>
                <div
                  className="mt-2 p-3 rounded-md"
                  style={{ background: 'var(--bg-panel)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>--bg-panel</span>
                  <div
                    className="mt-2 p-3 rounded-md"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>--bg-elevated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text hierarchy */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Text Hierarchy
            </h3>
            <div className="p-4 rounded-lg space-y-2" style={{ background: 'var(--bg)' }}>
              <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff)', fontWeight: 700 }}>
                Primary Text — Race Position P1
              </p>
              <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff)' }}>
                Secondary — Gap to leader: +1.234s
              </p>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--ff)' }}>
                Dim — Last lap 1:32.456
              </p>
              <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff)' }}>
                Muted — Session best by Driver Name
              </p>
            </div>
          </div>

          {/* Borders */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Borders
            </h3>
            <div className="flex gap-3">
              <div
                className="w-20 h-12 rounded-md flex items-center justify-center"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>default</span>
              </div>
              <div
                className="w-20 h-12 rounded-md flex items-center justify-center"
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-panel)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>subtle</span>
              </div>
              <div
                className="w-20 h-12 rounded-md flex items-center justify-center"
                style={{ border: '2px solid var(--border-accent)', background: 'var(--bg-panel)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>accent</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Components & semantic colors */}
        <div className="space-y-6">
          {/* Semantic colors */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Semantic Colors
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Red', var: '--red' },
                { name: 'Green', var: '--green' },
                { name: 'Blue', var: '--blue' },
                { name: 'Amber', var: '--amber' },
                { name: 'Purple', var: '--purple' },
                { name: 'Cyan', var: '--cyan' },
                { name: 'Orange', var: '--orange' },
              ].map((c) => (
                <div
                  key={c.var}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{ background: `color-mix(in srgb, var(${c.var}) 20%, transparent)` }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: `var(${c.var})` }}
                  />
                  <span className="text-xs font-semibold" style={{ color: `var(${c.var})` }}>
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Component mockups */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Component Mockups
            </h3>

            {/* Panel card */}
            <div
              className="p-4 mb-3"
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--corner-r)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--ff)',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  LEADERBOARD
                </span>
                <span
                  className="px-2 py-0.5 text-xs font-bold rounded"
                  style={{
                    background: 'var(--green)',
                    color: '#fff',
                    borderRadius: 'var(--corner-r-sm)',
                  }}
                >
                  LIVE
                </span>
              </div>
              <div className="space-y-1">
                {[
                  { pos: 'P1', name: 'K. Conboy', gap: 'Leader', color: 'var(--purple)' },
                  { pos: 'P2', name: 'M. Verstappen', gap: '+1.234', color: 'var(--text-secondary)' },
                  { pos: 'P3', name: 'L. Hamilton', gap: '+3.456', color: 'var(--text-secondary)' },
                ].map((driver) => (
                  <div
                    key={driver.pos}
                    className="flex items-center justify-between py-1 px-2 rounded"
                    style={{
                      background: 'var(--bg)',
                      borderRadius: 'var(--corner-r-sm)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          color: driver.color,
                          fontFamily: 'var(--ff-mono)',
                          fontWeight: 800,
                          fontSize: '13px',
                        }}
                      >
                        {driver.pos}
                      </span>
                      <span
                        style={{
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--ff)',
                          fontSize: '12px',
                        }}
                      >
                        {driver.name}
                      </span>
                    </div>
                    <span
                      style={{
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--ff-mono)',
                        fontSize: '11px',
                      }}
                    >
                      {driver.gap}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons row */}
            <div className="flex gap-2 mb-3">
              <button
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
                style={{
                  background: 'var(--red)',
                  borderRadius: 'var(--corner-r-sm)',
                }}
              >
                Danger
              </button>
              <button
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
                style={{
                  background: 'var(--green)',
                  borderRadius: 'var(--corner-r-sm)',
                }}
              >
                Success
              </button>
              <button
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--corner-r-sm)',
                }}
              >
                Ghost
              </button>
            </div>

            {/* Typography samples */}
            <div
              className="p-3 space-y-1"
              style={{ background: 'var(--bg)', borderRadius: 'var(--corner-r)' }}
            >
              <p
                style={{
                  fontFamily: 'var(--ff-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Display Font
              </p>
              <p
                style={{
                  fontFamily: 'var(--ff)',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                }}
              >
                Body text in Barlow Condensed
              </p>
              <p
                style={{
                  fontFamily: 'var(--ff-mono)',
                  fontSize: '13px',
                  color: 'var(--purple)',
                }}
              >
                1:32.456 -0.312s
              </p>
            </div>
          </div>

          {/* Border radius preview */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Border Radii
            </h3>
            <div className="flex gap-3">
              <div className="text-center">
                <div
                  className="w-16 h-16 mb-1"
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--corner-r)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>default</span>
              </div>
              <div className="text-center">
                <div
                  className="w-16 h-16 mb-1"
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--corner-r-sm)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>small</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
