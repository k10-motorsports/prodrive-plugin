/**
 * Track map CSV → SVG normalization pipeline.
 * Mirrors the C# TrackMapProvider algorithm:
 *   1. Parse worldX, worldZ, lapDistPct from CSV
 *   2. Normalize to 0–100 viewBox with 5% padding (uniform scale)
 *   3. Convert via Catmull-Rom → cubic Bézier spline
 */

interface TrackPoint {
  x: number
  y: number
  lapDistPct: number
}

/** Parse CSV (worldX,worldZ,lapDistPct per line, optional header) */
export function parseCsv(csv: string): TrackPoint[] {
  const lines = csv.trim().split('\n').filter(l => l.trim().length > 0)
  const points: TrackPoint[] = []

  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim())
    if (parts.length < 3) continue
    const x = parseFloat(parts[0])
    const z = parseFloat(parts[1])
    const pct = parseFloat(parts[2])
    if (isNaN(x) || isNaN(z)) continue
    points.push({ x, y: z, lapDistPct: isNaN(pct) ? 0 : pct })
  }

  return points
}

/** Normalize points to 0–100 viewBox with 5% padding, uniform scale */
function normalize(points: TrackPoint[]): TrackPoint[] {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  let rangeX = maxX - minX
  let rangeY = maxY - minY
  if (rangeX < 0.01) rangeX = 1
  if (rangeY < 0.01) rangeY = 1

  // Uniform scale to fit in 90×90 (5% padding each side)
  const scale = 90.0 / Math.max(rangeX, rangeY)
  const offsetX = (100.0 - rangeX * scale) / 2.0
  const offsetY = (100.0 - rangeY * scale) / 2.0

  return points.map(p => ({
    x: (p.x - minX) * scale + offsetX,
    y: (p.y - minY) * scale + offsetY,
    lapDistPct: p.lapDistPct,
  }))
}

/** Build SVG path using Catmull-Rom → cubic Bézier conversion */
function buildSvgPath(pts: TrackPoint[]): string {
  if (pts.length < 2) return ''

  const f = (n: number) => n.toFixed(2)
  let path = `M ${f(pts[0].x)},${f(pts[0].y)}`

  for (let i = 0; i < pts.length; i++) {
    const i0 = (i - 1 + pts.length) % pts.length
    const i1 = i
    const i2 = (i + 1) % pts.length
    const i3 = (i + 2) % pts.length

    // Catmull-Rom control points → Bézier control points
    const x1 = pts[i1].x + (pts[i2].x - pts[i0].x) / 6.0
    const y1 = pts[i1].y + (pts[i2].y - pts[i0].y) / 6.0
    const x2 = pts[i2].x - (pts[i3].x - pts[i1].x) / 6.0
    const y2 = pts[i2].y - (pts[i3].y - pts[i1].y) / 6.0

    path += ` C ${f(x1)},${f(y1)} ${f(x2)},${f(y2)} ${f(pts[i2].x)},${f(pts[i2].y)}`
  }

  return path + ' Z'
}

/** Generate inline SVG preview element */
export function generateSvgPreview(svgPath: string, trackName: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
  <title>${trackName}</title>
  <path d="${svgPath}" fill="none" stroke="#e53935" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

/** Full pipeline: CSV string → { svgPath, pointCount, svgPreview } */
export function csvToSvg(csv: string, trackName: string) {
  const raw = parseCsv(csv)
  if (raw.length < 10) {
    throw new Error(`Too few points (${raw.length}). Need at least 10.`)
  }

  const normalized = normalize(raw)
  const svgPath = buildSvgPath(normalized)
  const svgPreview = generateSvgPreview(svgPath, trackName)

  return {
    svgPath,
    pointCount: raw.length,
    svgPreview,
  }
}
