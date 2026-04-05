import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { buildTokens } from '@/lib/tokens/build'
import { uploadTokenBuild } from '@/lib/tokens/upload'

// POST /api/admin/tokens/build — Trigger SD build → Blob upload
// Builds combined CSS (dark base + light overrides) for both platforms.
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Always build combined dark+light CSS
    // The themeId stored in tokenBuilds is 'dark' (the base theme)
    // but the blob itself contains both :root and [data-theme="light"] blocks
    const results = await buildTokens('dark')

    // Upload to Vercel Blob
    const uploads = await uploadTokenBuild(results, 'dark')

    return NextResponse.json({
      success: true,
      themeId: 'dark',
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
