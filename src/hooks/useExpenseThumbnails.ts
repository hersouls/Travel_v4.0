// ============================================
// useExpenseThumbnails Hook
// Loads TravelLog thumbnails for expenses
// that were imported from travel log records
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react'
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

  // 항상 최신 매핑을 가리키는 ref (effect 의존성에서 제외해 불필요한 재실행 방지)
  const logIdToExpenseIdsRef = useRef(logIdToExpenseIds)
  logIdToExpenseIdsRef.current = logIdToExpenseIds

  // 매핑 "내용"의 안정적 시그니처 — expenses 배열이 재생성돼도 내용이 같으면 DB 재조회 안 함
  const mappingSig = useMemo(
    () =>
      Array.from(logIdToExpenseIds.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}:${v.join('.')}`)
        .join(','),
    [logIdToExpenseIds],
  )

  useEffect(() => {
    const map = logIdToExpenseIdsRef.current
    const logIds = Array.from(map.keys())
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
        const expenseIds = map.get(log.id)
        if (expenseIds) {
          for (const eid of expenseIds) {
            result[eid] = thumb
          }
        }
      }
      setThumbnailMap(result)
    }).catch(console.error)

    return () => { cancelled = true }
  }, [mappingSig])

  return thumbnailMap
}
