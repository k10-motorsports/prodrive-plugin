'use client'

import { useState } from 'react'
import type { YouTubeVideo } from '@/lib/youtube'
import { formatDuration, formatViews } from '@/lib/youtube'

interface VideoGridProps {
  videos: YouTubeVideo[]
  title?: string
}

const TYPE_LABELS = { video: 'Videos', short: 'Shorts', live: 'Live' } as const
const TYPE_FILTERS = ['video', 'short', 'live'] as const

export function VideoGrid({ videos, title = 'Latest Content' }: VideoGridProps) {
  const [filter, setFilter] = useState<string>('video')

  const filtered = videos.filter(v => v.type === filter)
  const availableTypes = new Set(videos.map(v => v.type))

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black">{title}</h2>
        <div className="flex gap-2">
          {TYPE_FILTERS.filter(t => availableTypes.has(t as any)).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition ${
                filter === t
                  ? 'bg-[var(--k10-red)] text-white'
                  : 'bg-white/5 text-[var(--text-dim)] hover:bg-white/10'
              }`}
            >
              {TYPE_LABELS[t as keyof typeof TYPE_LABELS]}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${
        filtered.some(v => v.type === 'short')
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {filtered.map(video => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[var(--text-muted)] py-12">No content yet</p>
      )}
    </section>
  )
}

function VideoCard({ video }: { video: YouTubeVideo }) {
  const isShort = video.type === 'short'

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden bg-white/[0.03] border border-[var(--border-subtle)] hover:border-[var(--border)] transition text-[var(--text)] hover:no-underline"
    >
      <div className={`relative ${isShort ? 'aspect-[9/16]' : 'aspect-video'} bg-black/40`}>
        <img
          src={video.thumbnails.high || video.thumbnails.medium || video.thumbnails.default}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {video.duration && !isShort && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-semibold">
            {formatDuration(video.duration)}
          </span>
        )}
        {video.type === 'live' && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[var(--k10-red)] text-[10px] font-bold uppercase">
            LIVE
          </span>
        )}
        {isShort && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[var(--k10-red)] text-[10px] font-bold uppercase">
            Short
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-[var(--text)] group-hover:text-[var(--k10-red)] transition-colors">
          {video.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
          {video.viewCount && <span>{formatViews(video.viewCount)} views</span>}
          <span>{formatRelativeTime(video.publishedAt)}</span>
        </div>
      </div>
    </a>
  )
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
