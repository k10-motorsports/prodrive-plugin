import type { YouTubeChannelInfo } from '@/lib/youtube'
import { formatViews } from '@/lib/youtube'

interface ChannelBannerProps {
  channel: YouTubeChannelInfo
}

export function ChannelBanner({ channel }: ChannelBannerProps) {
  return (
    <div className="flex items-center gap-5 mb-8">
      <img
        src={channel.thumbnail}
        alt={channel.title}
        className="w-16 h-16 rounded-full border-2 border-[var(--k10-red)]/30"
      />
      <div>
        <a
          href={`https://www.youtube.com/@k10motorsports`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl font-black text-[var(--text)] hover:text-[var(--k10-red)] hover:no-underline transition-colors"
        >
          {channel.title}
        </a>
        <div className="flex gap-4 mt-1 text-xs text-[var(--text-muted)]">
          <span>{formatViews(channel.subscriberCount)} subscribers</span>
          <span>{channel.videoCount} videos</span>
          <span>{formatViews(channel.viewCount)} views</span>
        </div>
      </div>
      <a
        href="https://www.youtube.com/@k10motorsports?sub_confirmation=1"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto px-5 py-2 rounded-lg bg-[var(--k10-red)] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 hover:no-underline transition"
      >
        Subscribe
      </a>
    </div>
  )
}
