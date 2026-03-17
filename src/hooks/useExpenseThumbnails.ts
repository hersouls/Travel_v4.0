// ============================================
// useExpenseThumbnails Hook
// Loads TravelLog thumbnails for expenses
// that were imported from travel log records
// ============================================

import { useEffect, useMemo, useState } from 'react'
import type { Expense } from '@/types'
import { getTravelLogsByIds } from '@/services/database'

/**
 * Given a list of expenses, resolve thumbnails from linked TravelLogs.
 * Returns a map of expenseId → base64 thumbnail string.
 */
export function useExpenseThumbnails(expenses: Expense[]): Record<number, string> {
  const [thumbnailMap, setThumbnailMap] = useState<Record<number, string>>({})

  // Collect sourceLogId → expenseId mappings
  const logIdToExpenseIds = useMemo(() => {
    const map = new Map<number, number[]>()
    for (const e of expenses) {
      if (e.sourceLogId && e.id) {
        const arr = map.get(e.sourceLogId) || []
        arr.push(e.id)
        map.set(e.sourceLogId, arr)
      }
    }
    return map
  }, [expenses])

  const logIds = useMemo(
    () => Array.from(logIdToExpenseIds.keys()),
    [logIdToExpenseIds],
  )

  useEffect(() => {
    if (logIds.length === 0) {
      setThumbnailMap({})
      return
    }

    let cancelled = false

    getTravelLogsByIds(logIds).then((logs) => {
      if (cancelled) return
      const result: Record<number, string> = {}
      for (const log of logs) {
        const thumb = log.thumbnailPhoto || log.photo
        if (!log.id || !thumb) continue
        const expenseIds = logIdToExpenseIds.get(log.id)
        if (expenseIds) {
          for (const eid of expenseIds) {
            result[eid] = thumb
          }
        }
      }
      setThumbnailMap(result)
    }).catch(console.error)

    return () => { cancelled = true }
  }, [logIds, logIdToExpenseIds])

  return thumbnailMap
}
