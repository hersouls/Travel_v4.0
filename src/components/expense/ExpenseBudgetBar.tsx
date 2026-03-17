// ============================================
// Expense Budget Bar
// Shows budget progress with color coding
// and optional per-category budget breakdown
// ============================================

import { useMemo } from 'react'
import { Utensils, Bus, Bed, ShoppingBag, Camera, MoreHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import type { TripBudget, ExpenseCategory } from '@/types'
import type { ExpenseTripTotals } from '@/hooks/useExpenseView'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'

interface ExpenseBudgetBarProps {
  budget: TripBudget
  currencyTotals: { currency: string; total: number }[]
  categoryTotals?: ExpenseTripTotals['categoryTotals']
  exchangeRates?: Record<string, number> | null
  className?: string
}

const categoryIcons: Record<ExpenseCategory, typeof Utensils> = {
  food: Utensils, transport: Bus, accommodation: Bed,
  shopping: ShoppingBag, attraction: Camera, other: MoreHorizontal,
}

function formatAmount(amount: number): string {
  return `₩${Math.round(amount).toLocaleString()}`
}

function getBarColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500'
  if (percentage >= 80) return 'bg-orange-500'
  if (percentage >= 60) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function getTextColor(percentage: number): string {
  if (percentage >= 100) return 'text-red-600 dark:text-red-400'
  if (percentage >= 80) return 'text-orange-600 dark:text-orange-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

export function ExpenseBudgetBar({ budget, currencyTotals, categoryTotals, exchangeRates, className }: ExpenseBudgetBarProps) {
  // Convert all expenses to budget currency
  const totalSpent = useMemo(() => {
    let spent = 0
    const budgetCur = budget.budgetCurrency

    for (const { currency, total } of currencyTotals) {
      if (currency === budgetCur) {
        spent += total
      } else if (exchangeRates) {
        // Convert to budget currency via KRW
        const krw = convertToKRW(total, currency, exchangeRates)
        const budgetKrw = convertToKRW(1, budgetCur, exchangeRates)
        if (krw != null && budgetKrw != null && budgetKrw > 0) {
          spent += krw / budgetKrw
        }
      }
    }
    return spent
  }, [budget.budgetCurrency, currencyTotals, exchangeRates])

  // Category spending in KRW for comparison with category budgets
  const categorySpending = useMemo(() => {
    if (!categoryTotals || !budget.categoryBudgets) return null
    const result: Record<string, number> = {}
    for (const { category, totals } of categoryTotals) {
      let krwTotal = 0
      for (const [cur, amt] of Object.entries(totals)) {
        const krw = exchangeRates ? convertToKRW(amt, cur, exchangeRates) : null
        krwTotal += krw ?? amt
      }
      result[category] = krwTotal
    }
    return result
  }, [categoryTotals, budget.categoryBudgets, exchangeRates])

  const percentage = budget.totalBudget > 0
    ? Math.min((totalSpent / budget.totalBudget) * 100, 100)
    : 0

  const remaining = budget.totalBudget - totalSpent
  const barColor = getBarColor(percentage)
  const textColor = getTextColor(percentage)

  const hasCategoryBudgets = budget.categoryBudgets && Object.keys(budget.categoryBudgets).length > 0

  return (
    <div className={clsx('rounded-xl border border-[var(--border)] bg-[var(--card)] p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">예산</span>
        <span className="text-xs text-zinc-500">
          {formatAmount(budget.totalBudget)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          사용: {formatAmount(totalSpent)} ({percentage.toFixed(1)}%)
        </span>
        <span className={clsx('text-xs font-medium', textColor)}>
          {remaining >= 0
            ? `남은 예산: ${formatAmount(remaining)}`
            : `초과: ${formatAmount(Math.abs(remaining))}`}
        </span>
      </div>

      {/* Category-level budgets */}
      {hasCategoryBudgets && categorySpending && (
        <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700/50 space-y-2">
          <span className="text-[10px] font-medium text-zinc-400">카테고리별 예산</span>
          {(Object.entries(budget.categoryBudgets!) as [ExpenseCategory, number][]).map(([category, catBudget]) => {
            if (!catBudget || catBudget <= 0) return null
            const spent = categorySpending[category] || 0
            const catPct = Math.min((spent / catBudget) * 100, 100)
            const catBarColor = getBarColor(catPct)
            const Icon = categoryIcons[category]

            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3 text-zinc-500" />
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {formatAmount(spent)} / {formatAmount(catBudget)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all duration-500', catBarColor)}
                    style={{ width: `${catPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
