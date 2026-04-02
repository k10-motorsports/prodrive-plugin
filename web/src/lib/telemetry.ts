// K10 Motorsports — Telemetry types & API config
//
// The web-api returns a flat JSON blob keyed by SimHub-style property paths.
// Every value is either a string or a number — no nesting.
// Components that consume telemetry should read individual keys via the
// `useTelemetry()` hook rather than coupling to the full shape.

/** Raw snapshot from the mock telemetry API — flat key→value map. */
export type TelemetrySnapshot = Record<string, string | number>

/** Polling interval in ms — 50 ms ≈ 20 fps, smooth enough for gauges. */
export const TELEMETRY_POLL_MS = 50

/** Base URL of the telemetry API. */
const isDev = process.env.NODE_ENV === 'development'
export const TELEMETRY_API_URL = isDev
  ? 'http://localhost:3001/api/racecor-io-pro-drive'
  : 'https://api.k10motorsports.racing/api/racecor-io-pro-drive'
