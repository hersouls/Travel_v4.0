// ============================================
// Expense Budget Bar
// Shows budget progress with color coding
// ============================================

import { clsx } from 'clsx'
import type { TripBudget } from '@/types'
import { CURRENCY_SYMBOLS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'

interface ExpenseBudgetBarProps {
  budget: TripBudget
  currencyTotals: { currency: string; total: number }[]
  exchangeRates?: Record<string, number> | null
  className?: string
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ExpenseBudgetBar({ budget, currencyTotals, exchangeRates, className }: ExpenseBudgetBarProps) {
  // Convert all expenses to budget currency
  let totalSpent = 0
  const budgetCur = budget.budgetCurrency

  for (const { currency, total } of currencyTotals) {
    if (currency === budgetCur) {
      totalSpent += total
    } else if (exchangeRates) {
      // Convert to budget currency via KRW
      const krw = convertToKRW(total, currency, exchangeRates)
      const budgetKrw = convertToKRW(1, budgetCur, exchangeRates)
      if (krw != null && budgetKrw != null && budgetKrw > 0) {
        totalSpent += krw / budgetKrw
      }
    }
  }

  const percentage = budget.totalBudget > 0
    ? Math.min((totalSpent / budget.totalBudget) * 100, 100)
    : 0

  const remaining = budget.totalBudget - totalSpent

  // Color based on percentage
  const barColor = percentage >= 100
    ? 'bg-red-500'
    : percentage >= 80
      ? 'bg-orange-500'
      : percentage >= 60
        ? 'bg-yellow-500'
        : 'bg-emerald-500'

  const textColor = percentage >= 100
    ? 'text-red-600 dark:text-red-400'
    : percentage >= 80
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className={clsx('rounded-xl border border-[var(--border)] bg-[var(--card)] p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">예산</span>
        <span className="text-xs text-zinc-500">
          {formatAmount(budget.totalBudget, budgetCur)}
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
          사용: {formatAmount(totalSpent, budgetCur)} ({percentage.toFixed(1)}%)
        </span>
        <span className={clsx('text-xs font-medium', textColor)}>
          {remaining >= 0
            ? `남은 예산: ${formatAmount(remaining, budgetCur)}`
            : `초과: ${formatAmount(Math.abs(remaining), budgetCur)}`}
        </span>
      </div>
    </div>
  )
}
