import { NextRequest, NextResponse } from 'next/server'
import { getCarClass, getModelPath, getClassInfo, type CarClass } from '@/lib/car-models'
import { renderCarImage } from '@/lib/car-renderer'
import { join } from 'path'

/**
 * GET /api/cars/render?carClass=gt3&paintUrl=...
 *
 * Renders a 3D car model and returns a PNG image.
 *
 * Query params:
 *   carClass  — Car class ID (gt3, gtp, lmp2, formula, sports)
 *   carName   — Alternative: iRacing car name, auto-mapped to class
 *   paintUrl  — Optional URL to a PNG paint texture to apply
 *
 * Returns: image/png (800x500) with cache headers
 *
 * Rendering: Software rasterizer (Three.js scene → pixel buffer → sharp PNG)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  let carClass = params.get('carClass') as CarClass | null
  const carName = params.get('carName')
  const paintUrl = params.get('paintUrl')

  // Resolve car class from name if not provided directly
  if (!carClass && carName) {
    carClass = getCarClass(carName)
  }
  if (!carClass) {
    carClass = 'sports'
  }

  const classInfo = getClassInfo(carClass)
  if (!classInfo) {
    return NextResponse.json({ error: 'unknown car class' }, { status: 400 })
  }

  try {
    // Resolve model path — GLB files in /public/models/cars/
    const modelPath = join(process.cwd(), 'public', 'models', 'cars', classInfo.modelFile)

    const png = await renderCarImage({
      carClass,
      modelPath,
      paintUrl: paintUrl || undefined,
    })

    return new NextResponse(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('[cars/render] Error:', error)

    // Fallback: return SVG placeholder on render failure
    const accentColors: Record<CarClass, string> = {
      gt3: '#00acc1',
      gtp: '#e53935',
      lmp2: '#1e88e5',
      formula: '#ffb300',
      sports: '#43a047',
    }
    const accent = accentColors[carClass] ?? '#00acc1'
    const modelRelPath = getModelPath(carClass)
    const errMsg = error instanceof Error ? error.message : 'unknown'

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d0d1a"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
  </defs>
  <rect width="800" height="500" fill="url(#bg)" rx="12"/>
  <rect x="40" y="40" width="120" height="36" rx="6" fill="${accent}" fill-opacity="0.2" stroke="${accent}" stroke-opacity="0.4"/>
  <text x="100" y="63" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="${accent}">${classInfo.name}</text>
  <text x="400" y="260" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white" fill-opacity="0.5">${classInfo.name}</text>
  <text x="400" y="300" text-anchor="middle" font-family="monospace" font-size="11" fill="white" fill-opacity="0.2">Model: ${modelRelPath}</text>
  <text x="400" y="330" text-anchor="middle" font-family="monospace" font-size="10" fill="#e53935" fill-opacity="0.4">Render fallback: ${errMsg.substring(0, 60)}</text>
</svg>`

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
