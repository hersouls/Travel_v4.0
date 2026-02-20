// ============================================
// Travel Log View Hook
// Sorting, filtering, searching, pagination logic
// extracted from TravelLog page
// ============================================

import type { ExpenseCategory, TravelLog, TravelLogType } from '@/types'
import { useMemo } from 'react'
import { calculateTripDistance, countUniqueLocations } from '@/utils/distanceCalculation'

export type SortOrder = 'newest' | 'oldest'

export interface DaySummary {
  total: number
  photoCount: number
  receiptCount: number
  memoCount: number
}

interface UseTravelLogViewParams {
  logs: TravelLog[]
  totalDays: number
  sortOrder: SortOrder
  activeFilter: TravelLogType | 'all'
  categoryFilter: ExpenseCategory | null
  searchQuery: string
  loadedDayCount: number
}

interface UseTravelLogViewReturn {
  sortedDays: number[]
  visibleDays: number[]
  logsByDay: Record<number, TravelLog[]>
  filteredLogsByDay: Record<number, TravelLog[]>
  dayExpenses: Record<number, Record<string, number>>
  daySummaries: Record<number, DaySummary>
  hasMoreDays: boolean
  totalFilteredCount: number
  dayDistances: Map<number, number>
  totalTripDistance: number
  uniqueLocationCount: number
}

export function useTravelLogView({
  logs,
  totalDays,
  sortOrder,
  activeFilter,
  categoryFilter,
  searchQuery,
  loadedDayCount,
}: UseTravelLogViewParams): UseTravelLogViewReturn {
  // Generate sorted days array
  const sortedDays = useMemo(() => {
    const d = Array.from({ length: totalDays }, (_, i) => i + 1)
    return sortOrder === 'newest' ? d.reverse() : d
  }, [totalDays, sortOrder])

  // Group logs by day and sort within each day
  const logsByDay = useMemo(() => {
    const grouped: Record<number, TravelLog[]> = {}
    for (const log of logs) {
      if (!grouped[log.day]) grouped[log.day] = []
      grouped[log.day].push(log)
    }
    for (const day of Object.keys(grouped)) {
      const d = Number.parseInt(day)
      grouped[d].sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        return sortOrder === 'newest' ? -diff : diff
      })
    }
    return grouped
  }, [logs, sortOrder])

  // Day summaries (for accordion headers)
  const daySummaries = useMemo(() => {
    const result: Record<number, DaySummary> = {}
    for (const [dayStr, dayLogs] of Object.entries(logsByDay)) {
      const day = Number.parseInt(dayStr)
      result[day] = {
        total: dayLogs.length,
        photoCount: dayLogs.filter((l) => l.type === 'photo').length,
        receiptCount: dayLogs.filter((l) => l.type === 'receipt').length,
        memoCount: dayLogs.filter((l) => l.type === 'memo').length,
      }
    }
    return result
  }, [logsByDay])

  // Day expense subtotals
  const dayExpenses = useMemo(() => {
    const result: Record<number, Record<string, number>> = {}
    for (const log of logs) {
      if (log.type !== 'receipt' || !log.expense) continue
      if (!result[log.day]) result[log.day] = {}
      const { currency, totalAmount } = log.expense
      result[log.day][currency] = (result[log.day][currency] || 0) + totalAmount
    }
    return result
  }, [logs])

  // Apply all filters (type + category + search)
  const filteredLogsByDay = useMemo(() => {
    if (activeFilter === 'all' && !categoryFilter && !searchQuery.trim()) {
      return logsByDay
    }
    const result: Record<number, TravelLog[]> = {}
    for (const [dayStr, dayLogs] of Object.entries(logsByDay)) {
      let filtered = dayLogs

      if (activeFilter !== 'all') {
        filtered = filtered.filter((l) => l.type === activeFilter)
      }

      if (categoryFilter) {
        filtered = filtered.filter(
          (l) => l.type === 'receipt' && l.expense?.category === categoryFilter,
        )
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (l) =>
            l.placeName?.toLowerCase().includes(q) ||
            l.memo?.toLowerCase().includes(q) ||
            l.expense?.storeName?.toLowerCase().includes(q) ||
            l.address?.toLowerCase().includes(q),
        )
      }

      if (filtered.length > 0) {
        result[Number.parseInt(dayStr)] = filtered
      }
    }
    return result
  }, [logsByDay, activeFilter, categoryFilter, searchQuery])

  // Visible days (infinite scroll, bypassed during search)
  const visibleDays = useMemo(() => {
    if (searchQuery.trim()) return sortedDays
    return sortedDays.slice(0, loadedDayCount)
  }, [sortedDays, loadedDayCount, searchQuery])

  const hasMoreDays = useMemo(() => {
    if (searchQuery.trim()) return false
    return loadedDayCount < sortedDays.length
  }, [loadedDayCount, sortedDays.length, searchQuery])

  // Total filtered count (for search result badge)
  const totalFilteredCount = useMemo(() => {
    let count = 0
    for (const dayLogs of Object.values(filteredLogsByDay)) {
      count += dayLogs.length
    }
    return count
  }, [filteredLogsByDay])

  // Distance calculations
  const { dayDistances, totalTripDistance } = useMemo(() => {
    const result = calculateTripDistance(logs)
    return {
      dayDistances: result.dayDistances,
      totalTripDistance: result.totalMeters,
    }
  }, [logs])

  const uniqueLocationCount = useMemo(() => countUniqueLocations(logs), [logs])

  return {
    sortedDays,
    visibleDays,
    logsByDay,
    filteredLogsByDay,
    dayExpenses,
    daySummaries,
    hasMoreDays,
    totalFilteredCount,
    dayDistances,
    totalTripDistance,
    uniqueLocationCount,
  }
}
