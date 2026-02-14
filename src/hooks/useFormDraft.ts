// ============================================
// Form Draft Auto-Save Hook
// Periodically saves form state to localStorage
// and offers recovery on re-entry
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react'

const DRAFT_PREFIX = 'form_draft_'
const SAVE_INTERVAL = 5000 // 5 seconds
const MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

interface UseFormDraftOptions<T> {
  key: string
  formData: T
  setFormData: (data: T) => void
  enabled?: boolean
}

interface UseFormDraftReturn {
  hasDraft: boolean
  restoreDraft: () => void
  dismissDraft: () => void
  clearDraft: () => void
}

export function useFormDraft<T>({
  key,
  formData,
  setFormData,
  enabled = true,
}: UseFormDraftOptions<T>): UseFormDraftReturn {
  const storageKey = DRAFT_PREFIX + key
  const [hasDraft, setHasDraft] = useState(false)
  const draftDataRef = useRef<T | null>(null)
  const initialCheckDone = useRef(false)

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled || initialCheckDone.current) return
    initialCheckDone.current = true

    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.data && parsed?.savedAt) {
          const age = Date.now() - parsed.savedAt
          if (age < MAX_AGE) {
            draftDataRef.current = parsed.data
            setHasDraft(true)
            return
          }
        }
        localStorage.removeItem(storageKey)
      }
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [storageKey, enabled])

  // Auto-save periodically
  useEffect(() => {
    if (!enabled) return

    const intervalId = setInterval(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ data: formData, savedAt: Date.now() })
        )
      } catch {
        // localStorage full, ignore
      }
    }, SAVE_INTERVAL)

    return () => clearInterval(intervalId)
  }, [storageKey, formData, enabled])

  const restoreDraft = useCallback(() => {
    if (draftDataRef.current) {
      setFormData(draftDataRef.current)
      setHasDraft(false)
    }
  }, [setFormData])

  const dismissDraft = useCallback(() => {
    setHasDraft(false)
    draftDataRef.current = null
    localStorage.removeItem(storageKey)
  }, [storageKey])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey)
  }, [storageKey])

  return { hasDraft, restoreDraft, dismissDraft, clearDraft }
}
