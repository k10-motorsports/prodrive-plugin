'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon, RotateCcw, Check, AlertCircle } from 'lucide-react'

interface LogoCustomizerProps {
  customLogoUrl: string | null
  userToken: string
}

export default function LogoCustomizer({ customLogoUrl, userToken }: LogoCustomizerProps) {
  const [logoUrl, setLogoUrl] = useState(customLogoUrl || '')
  const [preview, setPreview] = useState(customLogoUrl || '')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Live preview update as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (logoUrl && logoUrl.startsWith('https://')) {
        setPreview(logoUrl)
      } else if (!logoUrl) {
        setPreview('')
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [logoUrl])

  const handleSave = async () => {
    if (!logoUrl) {
      setFeedback({ type: 'error', message: 'Please enter a valid HTTPS URL' })
      return
    }

    setIsLoading(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/user/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ logoUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        setFeedback({
          type: 'error',
          message: error.error || 'Failed to save logo URL',
        })
        return
      }

      setFeedback({
        type: 'success',
        message: 'Logo saved successfully!',
      })
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    setIsLoading(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/user/logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ logoUrl: '' }),
      })

      if (!response.ok) {
        const error = await response.json()
        setFeedback({
          type: 'error',
          message: error.error || 'Failed to reset logo',
        })
        return
      }

      setLogoUrl('')
      setPreview('')
      setFeedback({
        type: 'success',
        message: 'Logo reset to default',
      })
      setTimeout(() => setFeedback(null), 3000)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Network error. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="mb-12">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <ImageIcon size={18} className="text-[var(--k10-red)]" />
        Overlay Branding
      </h2>

      <div className="p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-6">
        {/* Preview */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text-secondary)]">Preview</label>
          <div className="w-full aspect-square max-w-xs p-4 rounded-lg bg-black/30 border border-[var(--border)] flex items-center justify-center">
            {preview ? (
              preview.toLowerCase().endsWith('.svg') ? (
                <img src={preview} alt="Custom logo" className="max-w-full max-h-full" />
              ) : (
                <img src={preview} alt="Custom logo" className="max-w-full max-h-full rounded" />
              )
            ) : (
              <div className="text-center">
                <ImageIcon size={32} className="mx-auto mb-2 text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)]">K10 Default Logo</p>
              </div>
            )}
          </div>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[var(--text-secondary)]">Custom Logo URL</label>
          <input
            type="text"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50 text-sm"
          />
          <p className="text-xs text-[var(--text-muted)]">
            Must be HTTPS. Supports PNG, JPG, and SVG formats. Max 500 characters.
          </p>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
              feedback.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-600'
                : 'bg-red-500/10 border border-red-500/30 text-red-600'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check size={16} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isLoading || !logoUrl}
            className="px-4 py-2 rounded-lg bg-[var(--k10-red)] text-white font-semibold text-sm uppercase tracking-wider hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Saving...' : 'Save Logo'}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading || !customLogoUrl}
            className="px-4 py-2 rounded-lg bg-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm uppercase tracking-wider hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <RotateCcw size={14} />
            Reset to Default
          </button>
        </div>
      </div>
    </section>
  )
}
