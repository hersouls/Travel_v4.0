// ============================================
// Form Draft Auto-Save Hook
// Periodically saves form state to localStorage
// and offers recovery on re-entry
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react'

const DRAFT_PREFIX = 'form_draft_'
const SAVE_INTERVAL = 5000 // 5 seconds
const MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours

interface UseFormDraftOptions<T, E = undefined> {
  key: string
  formData: T
  setFormData: (data: T) => void
  enabled?: boolean
  /** 폼 데이터와 함께 저장할 부가 값 (예: 위저드 단계 index). 하위호환: 누락 시 undefined */
  extra?: E
  /** 복원 시 저장돼 있던 부가 값으로 호출됨 (구 드래프트는 undefined) */
  onRestoreExtra?: (extra: E | undefined) => void
}

interface UseFormDraftReturn {
  hasDraft: boolean
  restoreDraft: () => void
  dismissDraft: () => void
  clearDraft: () => void
}

export function useFormDraft<T, E = undefined>({
  key,
  formData,
  setFormData,
  enabled = true,
  extra,
  onRestoreExtra,
}: UseFormDraftOptions<T, E>): UseFormDraftReturn {
  const storageKey = DRAFT_PREFIX + key
  const [hasDraft, setHasDraft] = useState(false)
  const draftDataRef = useRef<T | null>(null)
  const draftExtraRef = useRef<E | undefined>(undefined)
  const initialCheckDone = useRef(false)

  // 최신 extra / onRestoreExtra 를 저장 인터벌·복원 콜백에서 stale 없이 참조
  const extraRef = useRef(extra)
  extraRef.current = extra
  const onRestoreExtraRef = useRef(onRestoreExtra)
  onRestoreExtraRef.current = onRestoreExtra

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
            draftExtraRef.current = parsed.extra // 구 드래프트는 undefined
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
          JSON.stringify({ data: formData, extra: extraRef.current, savedAt: Date.now() }),
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
      onRestoreExtraRef.current?.(draftExtraRef.current)
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
