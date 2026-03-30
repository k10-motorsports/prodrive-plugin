'use client'

import { useEffect, useRef, useState } from 'react'
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
]

/**
 * Full-bleed dashboard embed — no zoom, no scaling.
 * The iframe renders the dashboard at its natural ~904px width.
 * Telemetry data is sent via postMessage.
 */
export function DashboardEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { data, status } = useTelemetry()
  const [carIndex, setCarIndex] = useState(0)

  // ── Cycle car model every 10 seconds ──
  useEffect(() => {
    const iv = setInterval(() => {
      setCarIndex((i) => (i + 1) % SHOWCASE_CARS.length)
    }, 10_000)
    return () => clearInterval(iv)
  }, [])

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
    <div className="w-full">
      <div className="relative w-full overflow-hidden">
        {status !== 'live' && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-sm text-[var(--text-dim)] animate-pulse">
              Connecting to telemetry…
            </span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/_demo/dashboard-embed.html"
          title="K10 Motorsports Dashboard Demo"
          className="border-0 block w-full"
          sandbox="allow-scripts allow-same-origin"
          style={{
            background: '#0a0a14',
            height: '330px',
            opacity: status === 'live' ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}
