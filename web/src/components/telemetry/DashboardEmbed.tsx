/**
 * Static dashboard embed — displays a placeholder screenshot.
 * No iframes, no telemetry polling, just a simple responsive image.
 */
export function DashboardEmbed() {
  return (
    <div className="w-full">
      <div className="relative w-full overflow-hidden" style={{ background: '#0a0a14' }}>
        <img
          src="/screenshots/dashboard-full.png"
          alt="RaceCor.io Dashboard"
          className="block w-full"
          style={{ height: '330px', objectFit: 'cover' }}
        />
      </div>
    </div>
  )
}
