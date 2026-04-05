import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { buildTokens } from '@/lib/tokens/build'
import { uploadTokenBuild } from '@/lib/tokens/upload'

// POST /api/admin/tokens/build — Trigger SD build → Blob upload
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>
    const themeId = body.themeId || 'dark'

    // Build CSS for both platforms
    const results = await buildTokens(themeId)

    // Upload to Vercel Blob
    const uploads = await uploadTokenBuild(results, themeId)

    return NextResponse.json({
      success: true,
      themeId,
      builds: uploads,
    })
  } catch (error) {
    console.error('Token build failed:', error)
    return NextResponse.json(
      { error: 'Build failed', details: String(error) },
      { status: 500 }
    )
  }
}
