/**
 * YouTube Data API v3 integration for @k10motorsports channel.
 * Fetches videos, shorts, and livestreams for display on k10motorsports.racing.
 *
 * Requires YOUTUBE_API_KEY environment variable.
 * Channel: @k10motorsports
 */

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const CHANNEL_HANDLE = '@k10motorsports'

// Cache duration (revalidate every 30 minutes)
export const YOUTUBE_REVALIDATE = 1800

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  publishedAt: string
  thumbnails: {
    default: string
    medium: string
    high: string
    maxres?: string
  }
  duration?: string
  viewCount?: string
  likeCount?: string
  type: 'video' | 'short' | 'live'
  url: string
}

export interface YouTubeChannelInfo {
  id: string
  title: string
  description: string
  subscriberCount: string
  videoCount: string
  viewCount: string
  thumbnail: string
  banner?: string
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY environment variable not set')
  return key
}

async function apiFetch(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`)
  url.searchParams.set('key', getApiKey())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: YOUTUBE_REVALIDATE },
  })

  if (!res.ok) {
    console.error(`[YouTube API] ${endpoint} failed:`, res.status, await res.text())
    return null
  }

  return res.json()
}

/** Resolve the @k10motorsports handle to a channel ID */
async function resolveChannelId(): Promise<string | null> {
  const data = await apiFetch('channels', {
    part: 'id',
    forHandle: CHANNEL_HANDLE,
  })
  return data?.items?.[0]?.id || null
}

/** Fetch channel info (name, stats, thumbnail, banner) */
export async function getChannelInfo(): Promise<YouTubeChannelInfo | null> {
  const data = await apiFetch('channels', {
    part: 'snippet,statistics,brandingSettings',
    forHandle: CHANNEL_HANDLE,
  })

  const ch = data?.items?.[0]
  if (!ch) return null

  return {
    id: ch.id,
    title: ch.snippet.title,
    description: ch.snippet.description,
    subscriberCount: ch.statistics.subscriberCount,
    videoCount: ch.statistics.videoCount,
    viewCount: ch.statistics.viewCount,
    thumbnail: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url,
    banner: ch.brandingSettings?.image?.bannerExternalUrl,
  }
}

/** Fetch the latest videos from the channel */
export async function getLatestVideos(maxResults = 12): Promise<YouTubeVideo[]> {
  const channelId = await resolveChannelId()
  if (!channelId) return []

  // Search for recent uploads
  const searchData = await apiFetch('search', {
    part: 'snippet',
    channelId,
    order: 'date',
    maxResults: String(maxResults),
    type: 'video',
  })

  if (!searchData?.items?.length) return []

  // Get video details (duration, stats) in a batch
  const videoIds = searchData.items.map((i: any) => i.id.videoId).join(',')
  const detailsData = await apiFetch('videos', {
    part: 'contentDetails,statistics',
    id: videoIds,
  })

  const detailsMap = new Map<string, any>()
  for (const v of detailsData?.items || []) {
    detailsMap.set(v.id, v)
  }

  return searchData.items.map((item: any) => {
    const videoId = item.id.videoId
    const details = detailsMap.get(videoId)
    const duration = details?.contentDetails?.duration || ''

    // Classify: shorts are ≤60s vertical videos, lives have liveBroadcastContent
    const isShort = isShortDuration(duration)
    const isLive = item.snippet.liveBroadcastContent === 'live' || item.snippet.liveBroadcastContent === 'upcoming'

    return {
      id: videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnails: {
        default: item.snippet.thumbnails?.default?.url,
        medium: item.snippet.thumbnails?.medium?.url,
        high: item.snippet.thumbnails?.high?.url,
        maxres: item.snippet.thumbnails?.maxres?.url,
      },
      duration,
      viewCount: details?.statistics?.viewCount,
      likeCount: details?.statistics?.likeCount,
      type: isLive ? 'live' : isShort ? 'short' : 'video',
      url: isShort
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}`,
    } satisfies YouTubeVideo
  })
}

/** Check if an ISO 8601 duration is ≤60 seconds (typical shorts) */
function isShortDuration(iso: string): boolean {
  if (!iso) return false
  // PT1M or less, no H
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return false
  const h = parseInt(match[1] || '0')
  const m = parseInt(match[2] || '0')
  const s = parseInt(match[3] || '0')
  return h === 0 && m <= 1 && (m === 0 || s === 0)
}

/** Format ISO 8601 duration to human-readable (e.g., "2:34" or "1:05:23") */
export function formatDuration(iso: string): string {
  if (!iso) return ''
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const h = parseInt(match[1] || '0')
  const m = parseInt(match[2] || '0')
  const s = parseInt(match[3] || '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Format view count to human-readable (e.g., "1.2K", "340K", "1.1M") */
export function formatViews(count: string | undefined): string {
  if (!count) return ''
  const n = parseInt(count)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K'
  return n.toLocaleString()
}
