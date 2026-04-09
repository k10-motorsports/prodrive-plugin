'use client'

import { useState } from 'react'
import { Settings, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'

interface DataManagementProps {
  totalSessions: number
  emptySessions: number
}

export default function DataManagement({ totalSessions, emptySessions }: DataManagementProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPurging, setIsPurging] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [currentEmpty, setCurrentEmpty] = useState(emptySessions)
  const [currentTotal, setCurrentTotal] = useState(totalSessions)

  async function handlePurge() {
    setShowConfirm(false)
    setIsPurging(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/sessions/manage?purge=empty', { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        setFeedback({ type: 'success', message: `Purged ${data.purged} empty session${data.purged !== 1 ? 's' : ''}` })
        setCurrentEmpty(0)
        setCurrentTotal(prev => prev - data.purged)
      } else {
        setFeedback({ type: 'error', message: data.error || 'Purge failed' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Network error — please try again' })
    } finally {
      setIsPurging(false)
    }
  }

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors mb-2"
      >
        <Settings size={14} />
        Data Management
        <span className="text-[10px]">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* Stats */}
            <div className="text-sm text-[var(--text-dim)]">
              <span className="font-medium text-[var(--text)]">{currentTotal}</span> total sessions
              {currentEmpty > 0 && (
                <span className="ml-3 text-amber-400">
                  <AlertTriangle size={12} className="inline mr-1 mb-0.5" />
                  {currentEmpty} empty (0 laps)
                </span>
              )}
            </div>

            {/* Purge button */}
            {currentEmpty > 0 && !showConfirm && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isPurging}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                  bg-red-500/10 text-red-400 border border-red-500/20
                  hover:bg-red-500/20 hover:border-red-500/30
                  disabled:opacity-50 transition-colors"
              >
                <Trash2 size={12} />
                Purge Empty Sessions
              </button>
            )}

            {/* Confirmation */}
            {showConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400">
                  Delete {currentEmpty} empty session{currentEmpty !== 1 ? 's' : ''}?
                </span>
                <button
                  onClick={handlePurge}
                  className="px-3 py-1 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Yes, purge
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-3 py-1 text-xs rounded-lg bg-[var(--bg)] text-[var(--text-dim)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`mt-3 flex items-center gap-1.5 text-xs ${
              feedback.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}>
              {feedback.type === 'success'
                ? <CheckCircle size={12} />
                : <AlertTriangle size={12} />
              }
              {feedback.message}
              {feedback.type === 'success' && (
                <span className="text-[var(--text-muted)] ml-2">Refresh the page to update the view.</span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
