// ============================================
// Bulk Selection Hook
// Manages multi-select mode for lists
// ============================================

import { useState, useCallback, useMemo } from 'react'

export function useBulkSelection<T extends number | string>() {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      // Auto-exit selection mode when all deselected
      if (next.size === 0) {
        setIsSelectionMode(false)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: T[]) => {
    setSelectedIds(new Set(ids))
    if (ids.length > 0) setIsSelectionMode(true)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }, [])

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
  }, [])

  const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds])

  const count = useMemo(() => selectedIds.size, [selectedIds])
  const ids = useMemo(() => Array.from(selectedIds), [selectedIds])

  return {
    selectedIds: ids,
    isSelectionMode,
    count,
    toggle,
    selectAll,
    clearSelection,
    enterSelectionMode,
    isSelected,
  }
}
