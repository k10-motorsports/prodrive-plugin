'use client'

import { useEffect, useRef, useState } from 'react'
import { useTelemetry } from './TelemetryProvider'

/**
 * Full-bleed dashboard embed. The iframe loads the real HUD at 100% width;
 * a zoom-to-fit script inside the iframe scales the ~904px dashboard to
 * fill whatever width the browser gives it, then posts its final pixel
 * height back so we can size the container correctly.
 */
export function DashboardEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { data, status } = useTelemetry()
  const [height, setHeight] = useState(280) // sensible initial guess

  // ── Listen for height reports from the iframe's zoom-to-fit script ──
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'k10-resize' && typeof e.data.height === 'number') {
        setHeight(e.data.height)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // ── Post telemetry data to iframe on every update ──
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !data) return
    iframe.contentWindow.postMessage(
      { type: 'k10-telemetry', snapshot: data },
      '*',
    )
  }, [data])

  return (
    <div className="w-full" style={{ background: '#000' }}>
      <div className="relative w-full overflow-hidden" style={{ height }}>
        {status !== 'live' && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: '#000' }}
          >
            <span className="text-sm text-[var(--text-dim)] animate-pulse">
              Connecting to telemetry…
            </span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/_demo/dashboard-embed.html"
          title="K10 Motorsports Dashboard Demo"
          className="border-0 block"
          sandbox="allow-scripts allow-same-origin"
          style={{
            background: '#000',
            width: '100%',
            height: '100%',
            opacity: status === 'live' ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}
