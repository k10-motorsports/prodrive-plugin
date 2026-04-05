import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getTokenCssUrl } from '@/lib/tokens/get-token-css-url'

// GET /api/admin/tokens/css-url?set=mclaren
// Returns the Vercel Blob URL for the latest built CSS for the given set.
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const setSlug = request.nextUrl.searchParams.get('set') || 'default'

  const url = await getTokenCssUrl(setSlug)

  return NextResponse.json({ url })
}
