// ============================================
// Expense Day Section Header
// Collapsible header for each day
// ============================================

import type { ExpenseDaySummary } from '@/hooks/useExpenseView'
import { convertToKRW } from '@/services/exchangeRateService'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'

interface ExpenseDaySectionHeaderProps {
  day: number
  date: Date
  isExpanded: boolean
  onToggle: () => void
  summary?: ExpenseDaySummary
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
}

function formatCurrencyShort(amount: number): string {
  return `₩${Math.round(amount).toLocaleString()}`
}

export function ExpenseDaySectionHeader({
  day,
  date,
  isExpanded,
  onToggle,
  summary,
  exchangeRates,
  showKRW,
}: ExpenseDaySectionHeaderProps) {
  const dateStr = date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
        'border border-[var(--border)] bg-[var(--card)]',
        'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        'active:scale-[0.99] transition-transform',
        isExpanded && 'rounded-b-none border-b-0',
      )}
    >
      <div className="flex-shrink-0">
        <span className="text-base font-semibold text-[var(--foreground)]">Day {day}</span>
      </div>

      <div className="flex-1 min-w-0 text-left">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{dateStr}</span>
        {!isExpanded && summary && summary.expenseCount > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {summary.expenseCount}건
            </span>
            <Wallet className="size-3 text-zinc-400" />
          </div>
        )}
      </div>

      {/* Totals */}
      {summary && !isExpanded && Object.keys(summary.totals).length > 0 && (
        <div className="flex-shrink-0 text-right">
          {(() => {
            let totalKRW = 0
            let allConverted = true
            for (const [currency, amount] of Object.entries(summary.totals)) {
              if (exchangeRates) {
                const krw = convertToKRW(amount, currency, exchangeRates)
                if (krw != null) { totalKRW += krw; continue }
              }
              totalKRW += amount
              if (currency !== 'KRW') allConverted = false
            }
            return (
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {formatCurrencyShort(totalKRW)}
              </p>
            )
          })()}
        </div>
      )}

      <div className="flex-shrink-0 text-zinc-400 dark:text-zinc-500">
        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </div>
    </button>
  )
}
