import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { buildTokens } from '@/lib/tokens/build'
import { uploadTokenBuild } from '@/lib/tokens/upload'

// POST /api/admin/tokens/build — Trigger SD build → Blob upload
// Body: { setSlug?: string }  (defaults to 'default')
// Builds combined CSS (dark base + light overrides) for both platforms.
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({})) as { setSlug?: string }
    const setSlug = body.setSlug || 'default'

    const results = await buildTokens(setSlug)

    // Upload to Vercel Blob
    const uploads = await uploadTokenBuild(results, setSlug, 'dark')

    return NextResponse.json({
      success: true,
      setSlug,
      themes: ['dark', 'light'],
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
