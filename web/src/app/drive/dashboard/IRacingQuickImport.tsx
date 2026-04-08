'use client'

import { useState, useCallback } from 'react'
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react'

type ImportResult = {
  success: boolean
  imported?: { sessions: number; ratings: number }
  received?: { races: number; careerSummary: number }
  trackMappings?: Record<string, string>
  errors?: string[]
  error?: string
}

export default function IRacingQuickImport() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const processPayload = useCallback(async (raw: string) => {
    setStatus('uploading')
    setResult(null)

    try {
      let payload = JSON.parse(raw)

      if (Array.isArray(payload)) {
        while (payload.length === 1 && Array.isArray(payload[0])) {
          payload = payload[0]
        }
      }

      const body = Array.isArray(payload)
        ? { recentRaces: payload }
        : payload

      if (body.cust_id && !body.custId) {
        body.custId = body.cust_id
        body.displayName = body.display_name || body.displayName || ''
      }

      const res = await fetch('/api/iracing/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: ImportResult = await res.json()

      if (res.ok && data.success) {
        setStatus('success')
        setResult(data)
      } else {
        setStatus('error')
        setResult(data)
      }
    } catch (err: any) {
      setStatus('error')
      setResult({ success: false, error: err.message || 'Invalid JSON' })
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = () => processPayload(reader.result as string)
      reader.readAsText(file)
    }
  }, [processPayload])

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = () => processPayload(reader.result as string)
      reader.readAsText(file)
    }
  }, [processPayload])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      e.preventDefault()
      setFileName(null)
      processPayload(text)
    }
  }, [processPayload])

  const reset = () => {
    setStatus('idle')
    setResult(null)
    setFileName(null)
  }

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-3"
      style={{ width: '420px', flexShrink: 0 }}
    >
      {status === 'idle' && (
        <div className="flex items-center gap-4">
          {/* Instructions */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Upload size={12} className="text-[var(--border-accent)] shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Import iRacing Data
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Go to <span className="text-[var(--text-dim)]">iRacing &rarr; Results &rarr; Download JSON</span> and drop the file here. Tracks are auto-mapped to your Pro Drive library.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onPaste={handlePaste}
            tabIndex={0}
            onClick={() => document.getElementById('iracing-quick-file')?.click()}
            className="cursor-pointer rounded-lg p-3 text-center transition-colors shrink-0"
            style={{
              width: '100px',
              border: `1.5px dashed ${dragOver ? 'var(--k10-red)' : 'var(--border)'}`,
              background: dragOver ? 'rgba(229, 57, 53, 0.05)' : 'transparent',
            }}
          >
            <input
              id="iracing-quick-file"
              type="file"
              accept=".json"
              onChange={handleFile}
              className="hidden"
            />
            <Upload size={14} className="mx-auto mb-1 text-[var(--text-muted)]" />
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              Drop .json
            </p>
          </div>
        </div>
      )}

      {status === 'uploading' && (
        <div className="flex items-center gap-2 py-1">
          <Loader2 size={14} className="animate-spin text-[var(--border-accent)]" />
          <span className="text-xs text-[var(--text-dim)]">
            Importing{fileName ? ` ${fileName}` : ''}...
          </span>
        </div>
      )}

      {status === 'success' && result && (
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-1.5">
            <Check size={13} style={{ color: '#66bb6a' }} />
            <span className="text-xs font-semibold" style={{ color: '#66bb6a' }}>
              {result.imported?.sessions ?? 0} sessions imported
            </span>
            {result.trackMappings && (
              <span className="text-[10px] text-[var(--text-muted)] ml-1">
                · {Object.keys(result.trackMappings).length} tracks mapped
              </span>
            )}
          </div>
          <button
            onClick={reset}
            className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            Import more
          </button>
        </div>
      )}

      {status === 'error' && result && (
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle size={13} className="shrink-0" style={{ color: '#ef5350' }} />
            <span className="text-xs text-[var(--text-dim)] truncate">
              {result.error || 'Import failed'}
            </span>
          </div>
          <button
            onClick={reset}
            className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0 ml-3"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
