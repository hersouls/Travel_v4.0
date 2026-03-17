// ============================================
// Expense View Hook
// Sorting, filtering, searching, pagination logic
// for the dedicated Expense page
// ============================================

import { useMemo } from 'react'
import type { Expense, ExpenseCategory, ExpenseSubCategory, PaymentMethod } from '@/types'

export type ExpenseSortOrder = 'newest' | 'oldest'

export interface ExpenseDaySummary {
  total: number
  expenseCount: number
  totals: Record<string, number> // currency → total
}

const CATEGORY_ORDER: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'shopping', 'attraction', 'other']

export interface ExpenseCategoryGroup {
  category: ExpenseCategory
  expenseCount: number
  totals: Record<string, number>  // currency → total
  expensesByDay: Record<number, Expense[]>
  sortedDays: number[]
}

export interface ExpenseTripTotals {
  currencyTotals: { currency: string; total: number }[]
  categoryTotals: {
    category: ExpenseCategory
    totals: Record<string, number>
    count: number
  }[]
  totalCount: number
}

interface UseExpenseViewParams {
  expenses: Expense[]
  totalDays: number
  sortOrder: ExpenseSortOrder
  categoryFilter: ExpenseCategory | null
  subCategoryFilter: ExpenseSubCategory | null
  searchQuery: string
  loadedDayCount: number
  paymentMethodFilter?: PaymentMethod | null
}

interface UseExpenseViewReturn {
  sortedDays: number[]
  visibleDays: number[]
  expensesByDay: Record<number, Expense[]>
  filteredExpensesByDay: Record<number, Expense[]>
  daySummaries: Record<number, ExpenseDaySummary>
  tripTotals: ExpenseTripTotals
  hasMoreDays: boolean
  totalFilteredCount: number
  filteredCategoryGroups: ExpenseCategoryGroup[]
}

export function useExpenseView({
  expenses,
  totalDays,
  sortOrder,
  categoryFilter,
  subCategoryFilter,
  searchQuery,
  loadedDayCount,
  paymentMethodFilter,
}: UseExpenseViewParams): UseExpenseViewReturn {
  // Generate sorted days array
  const sortedDays = useMemo(() => {
    const d = Array.from({ length: totalDays }, (_, i) => i + 1)
    return sortOrder === 'newest' ? d.reverse() : d
  }, [totalDays, sortOrder])

  // Group expenses by day and sort within each day
  const expensesByDay = useMemo(() => {
    const grouped: Record<number, Expense[]> = {}
    for (const expense of expenses) {
      if (!grouped[expense.day]) grouped[expense.day] = []
      grouped[expense.day].push(expense)
    }
    for (const day of Object.keys(grouped)) {
      const d = Number.parseInt(day)
      grouped[d].sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        return sortOrder === 'newest' ? -diff : diff
      })
    }
    return grouped
  }, [expenses, sortOrder])

  // Day summaries (for accordion headers)
  const daySummaries = useMemo(() => {
    const result: Record<number, ExpenseDaySummary> = {}
    for (const [dayStr, dayExpenses] of Object.entries(expensesByDay)) {
      const day = Number.parseInt(dayStr)
      const totals: Record<string, number> = {}
      for (const e of dayExpenses) {
        totals[e.currency] = (totals[e.currency] || 0) + e.totalAmount
      }
      result[day] = {
        total: dayExpenses.length,
        expenseCount: dayExpenses.length,
        totals,
      }
    }
    return result
  }, [expensesByDay])

  // Trip-wide totals
  const tripTotals = useMemo(() => {
    const curMap = new Map<string, number>()
    const catMap = new Map<ExpenseCategory, { totals: Record<string, number>; count: number }>()

    for (const expense of expenses) {
      // Currency totals
      curMap.set(expense.currency, (curMap.get(expense.currency) || 0) + expense.totalAmount)

      // Category totals
      const cat = catMap.get(expense.category) || { totals: {}, count: 0 }
      cat.totals[expense.currency] = (cat.totals[expense.currency] || 0) + expense.totalAmount
      cat.count++
      catMap.set(expense.category, cat)
    }

    const currencyTotals = Array.from(curMap.entries())
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => b.total - a.total)

    const categoryTotals = Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => {
        const aTotal = Object.values(a.totals).reduce((s, v) => s + v, 0)
        const bTotal = Object.values(b.totals).reduce((s, v) => s + v, 0)
        return bTotal - aTotal
      })

    return { currencyTotals, categoryTotals, totalCount: expenses.length }
  }, [expenses])

  // Apply all filters (category + subcategory + search + paymentMethod)
  const filteredExpensesByDay = useMemo(() => {
    if (!categoryFilter && !subCategoryFilter && !searchQuery.trim() && !paymentMethodFilter) {
      return expensesByDay
    }
    const result: Record<number, Expense[]> = {}
    for (const [dayStr, dayExpenses] of Object.entries(expensesByDay)) {
      let filtered = dayExpenses

      if (categoryFilter) {
        filtered = filtered.filter((e) => e.category === categoryFilter)
      }

      if (subCategoryFilter) {
        filtered = filtered.filter((e) => e.subCategory === subCategoryFilter)
      }

      if (paymentMethodFilter) {
        filtered = filtered.filter((e) => e.paymentMethod === paymentMethodFilter)
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (e) =>
            e.storeName?.toLowerCase().includes(q) ||
            e.memo?.toLowerCase().includes(q) ||
            e.address?.toLowerCase().includes(q) ||
            e.items?.some((item) => item.name.toLowerCase().includes(q)),
        )
      }

      if (filtered.length > 0) {
        result[Number.parseInt(dayStr)] = filtered
      }
    }
    return result
  }, [expensesByDay, categoryFilter, subCategoryFilter, searchQuery, paymentMethodFilter])

  // Visible days (infinite scroll, bypassed during search)
  const visibleDays = useMemo(() => {
    if (searchQuery.trim()) return sortedDays
    return sortedDays.slice(0, loadedDayCount)
  }, [sortedDays, loadedDayCount, searchQuery])

  const hasMoreDays = useMemo(() => {
    if (searchQuery.trim()) return false
    return loadedDayCount < sortedDays.length
  }, [loadedDayCount, sortedDays.length, searchQuery])

  // Total filtered count
  const totalFilteredCount = useMemo(() => {
    let count = 0
    for (const dayExpenses of Object.values(filteredExpensesByDay)) {
      count += dayExpenses.length
    }
    return count
  }, [filteredExpensesByDay])

  // Category > Day grouping (from filtered expenses)
  const filteredCategoryGroups = useMemo(() => {
    // Flatten filtered expenses
    const allFiltered: Expense[] = []
    for (const dayExpenses of Object.values(filteredExpensesByDay)) {
      allFiltered.push(...dayExpenses)
    }

    // Group by category → day
    const catMap = new Map<ExpenseCategory, Map<number, Expense[]>>()
    for (const e of allFiltered) {
      if (!catMap.has(e.category)) catMap.set(e.category, new Map())
      const dayMap = catMap.get(e.category)!
      if (!dayMap.has(e.day)) dayMap.set(e.day, [])
      dayMap.get(e.day)!.push(e)
    }

    // Sort within each day by timestamp
    for (const dayMap of catMap.values()) {
      for (const [day, dayExpenses] of dayMap.entries()) {
        dayExpenses.sort((a, b) => {
          const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          return sortOrder === 'newest' ? -diff : diff
        })
      }
    }

    // Build groups in canonical category order
    const groups: ExpenseCategoryGroup[] = []
    for (const category of CATEGORY_ORDER) {
      const dayMap = catMap.get(category)
      if (!dayMap || dayMap.size === 0) continue

      const expensesByDay: Record<number, Expense[]> = {}
      const totals: Record<string, number> = {}
      let expenseCount = 0

      const days = Array.from(dayMap.keys())
      days.sort((a, b) => sortOrder === 'newest' ? b - a : a - b)

      for (const day of days) {
        const dayExpenses = dayMap.get(day)!
        expensesByDay[day] = dayExpenses
        expenseCount += dayExpenses.length
        for (const e of dayExpenses) {
          totals[e.currency] = (totals[e.currency] || 0) + e.totalAmount
        }
      }

      groups.push({ category, expenseCount, totals, expensesByDay, sortedDays: days })
    }

    return groups
  }, [filteredExpensesByDay, sortOrder])

  return {
    sortedDays,
    visibleDays,
    expensesByDay,
    filteredExpensesByDay,
    daySummaries,
    tripTotals,
    hasMoreDays,
    totalFilteredCount,
    filteredCategoryGroups,
  }
}
