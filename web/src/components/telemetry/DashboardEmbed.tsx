'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTelemetry } from './TelemetryProvider'

/** Cars to cycle through — one every 10 seconds */
const SHOWCASE_CARS = [
  'McLaren 720S GT3',
  'Ferrari 296 GT3',
  'Porsche 911 GT3 R',
  'Mercedes-AMG GT3',
  'Audi R8 LMS GT3',
  'Lamborghini Huracán GT3',
  'Aston Martin Vantage GT3',
  'BMW M4 GT3',
  'Chevrolet Corvette Z06 GT3.R',
  'Cadillac V-Series.R',
  'Ford Mustang GT3',
  'Toyota GR86',
  'Honda Civic Type R',
  'Lotus Emira GT4',
  'Radical SR10',
]

/**
 * Full-bleed dashboard embed. The iframe loads the real HUD; a zoom-to-fit
 * script inside it scales the ~904px dashboard to fill whatever width we
 * give it. The parent (this component) owns the resize loop — the iframe
 * never listens to its own resize event (that would loop, since zoom
 * changes trigger resize).
 *
 * Protocol:
 *   parent → iframe: { type: 'k10-container-width', width }
 *   iframe → parent: { type: 'k10-ready', naturalWidth }
 *   iframe → parent: { type: 'k10-resize', height }
 */
export function DashboardEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastWidthRef = useRef(0)
  const { data, status } = useTelemetry()
  const [height, setHeight] = useState(280)
  const [carIndex, setCarIndex] = useState(0)

  // ── Cycle car model every 10 seconds ──
  useEffect(() => {
    const iv = setInterval(() => {
      setCarIndex((i) => (i + 1) % SHOWCASE_CARS.length)
    }, 10_000)
    return () => clearInterval(iv)
  }, [])

  // Send container width to iframe, but ONLY when width actually changes.
  // Height changes (from setHeight) must NOT re-trigger this.
  const sendWidth = useCallback(() => {
    const el = containerRef.current
    const iframe = iframeRef.current
    if (!el || !iframe?.contentWindow) return
    const w = el.clientWidth
    if (w === lastWidthRef.current) return // width unchanged — skip
    lastWidthRef.current = w
    iframe.contentWindow.postMessage(
      { type: 'k10-container-width', width: w },
      '*',
    )
  }, [])

  // ── Listen for messages from iframe ──
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data?.type) return
      if (e.data.type === 'k10-resize' && typeof e.data.height === 'number') {
        setHeight(e.data.height)
      }
      // iframe measured its natural width and is ready — send ours
      if (e.data.type === 'k10-ready') {
        sendWidth()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendWidth])

  // ── ResizeObserver: when container width changes, tell iframe ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => sendWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [sendWidth])

  // ── Post telemetry data to iframe, with car model overridden ──
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !data) return
    const snapshot = {
      ...data,
      'DataCorePlugin.GameData.CarModel': SHOWCASE_CARS[carIndex],
      'K10Motorsports.Plugin.Demo.CarModel': SHOWCASE_CARS[carIndex],
    }
    iframe.contentWindow.postMessage(
      { type: 'k10-telemetry', snapshot },
      '*',
    )
  }, [data, carIndex])

  return (
    <div ref={containerRef} className="w-full" style={{ background: '#000' }}>
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
