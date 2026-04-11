'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, LogOut, ChevronDown, Upload, Check, AlertCircle, Loader2 } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import ThemeSetSelector from '@/components/ThemeSetSelector'

interface UserMenuProps {
  user: {
    name: string
    image?: string | null
    isAdmin: boolean
    isPluginConnected: boolean
  }
  signOutAction: () => Promise<void>
}

export default function UserMenu({ user, signOutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [importMsg, setImportMsg] = useState<string | null>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('uploading')
    setImportMsg(null)
    try {
      const raw = await file.text()
      let payload = JSON.parse(raw)
      if (Array.isArray(payload)) {
        while (payload.length === 1 && Array.isArray(payload[0])) payload = payload[0]
      }
      const body = Array.isArray(payload) ? { recentRaces: payload } : payload
      if (body.cust_id && !body.custId) {
        body.custId = body.cust_id
        body.displayName = body.display_name || body.displayName || ''
      }
      const res = await fetch('/api/iracing/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setImportStatus('success')
        setImportMsg(`${data.imported?.sessions ?? 0} sessions imported`)
        setTimeout(() => { setImportStatus('idle'); setImportMsg(null) }, 3000)
      } else {
        setImportStatus('error')
        setImportMsg(data.error || 'Import failed')
        setTimeout(() => { setImportStatus('idle'); setImportMsg(null) }, 4000)
      }
    } catch (err: any) {
      setImportStatus('error')
      setImportMsg(err.message || 'Invalid JSON')
      setTimeout(() => { setImportStatus('idle'); setImportMsg(null) }, 4000)
    }
    // Reset file input so the same file can be re-selected
    e.target.value = ''
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer hover:bg-[var(--bg-surface)]"
      >
        {/* Connection status dot */}
        {user.isPluginConnected && (
          <span
            className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
            title="SimHub connected"
          />
        )}
        {user.image && (
          <img src={user.image} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
        )}
        <span className="text-xs text-[var(--text-secondary)] font-medium">{user.name}</span>
        <ChevronDown
          size={12}
          className="text-[var(--text-muted)]"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 220,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            zIndex: 100,
            padding: '8px 0',
          }}
        >
          {/* Theme section */}
          <div className="px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Theme
            </div>
            <div className="flex flex-col gap-2">
              <ThemeSetSelector />
              <ThemeToggle />
            </div>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[var(--border)]" />

          {/* iRacing Import */}
          <div className="px-3 py-1.5">
            {importStatus === 'idle' && (
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer">
                <Upload size={14} />
                Import iRacing Data
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            )}
            {importStatus === 'uploading' && (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-[var(--border-accent)]" />
                <span className="text-xs text-[var(--text-dim)]">Importing...</span>
              </div>
            )}
            {importStatus === 'success' && (
              <div className="flex items-center gap-1.5">
                <Check size={13} style={{ color: '#66bb6a' }} />
                <span className="text-xs font-medium" style={{ color: '#66bb6a' }}>{importMsg}</span>
              </div>
            )}
            {importStatus === 'error' && (
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} style={{ color: '#ef5350' }} />
                <span className="text-xs text-[var(--text-dim)]">{importMsg}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-[var(--border)]" />

          {/* Admin link */}
          {user.isAdmin && (
            <a
              href="/drive/admin"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--k10-red)] transition-colors hover:bg-[var(--bg-surface)]"
              onClick={() => setOpen(false)}
            >
              <Settings size={14} />
              Admin
            </a>
          )}

          {/* Sign out */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
