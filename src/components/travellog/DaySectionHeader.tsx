// ============================================
// Day Section Header (Accordion)
// Collapsible header for each day in TravelLog
// ============================================

import type { DaySummary } from '@/hooks/useTravelLogView'
import { convertToKRW } from '@/services/exchangeRateService'
import { clsx } from 'clsx'
import { Camera, ChevronDown, ChevronUp, FileText, MapPin, Receipt } from 'lucide-react'

interface DaySectionHeaderProps {
  day: number
  date: Date
  isExpanded: boolean
  onToggle: () => void
  summary?: DaySummary
  expenses?: Record<string, number>
  distanceKm?: number
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
}

function formatCurrencyShort(amount: number, currency: string): string {
  const symbol =
    currency === 'KRW' ? '₩' : currency === 'JPY' ? '¥' : currency === 'USD' ? '$' : currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export function DaySectionHeader({
  day,
  date,
  isExpanded,
  onToggle,
  summary,
  expenses,
  distanceKm,
  exchangeRates,
  showKRW,
}: DaySectionHeaderProps) {
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
      {/* Day info */}
      <div className="flex-shrink-0">
        <span className="text-base font-semibold text-[var(--foreground)]">Day {day}</span>
      </div>

      <div className="flex-1 min-w-0 text-left">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{dateStr}</span>

        {/* Summary (shown in both states, more detail when collapsed) */}
        {!isExpanded && summary && summary.total > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {summary.total}개
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
              {summary.photoCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <Camera className="size-3 text-primary-500" />
                  {summary.photoCount}
                </span>
              )}
              {summary.receiptCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <Receipt className="size-3 text-warning-500" />
                  {summary.receiptCount}
                </span>
              )}
              {summary.memoCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <FileText className="size-3 text-success-500" />
                  {summary.memoCount}
                </span>
              )}
              {distanceKm != null && distanceKm > 0.01 && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="size-3 text-zinc-400" />
                  {distanceKm.toFixed(1)}km
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expenses */}
      {expenses && !isExpanded && (
        <div className="flex-shrink-0 text-right">
          {Object.entries(expenses).map(([currency, amount]) => (
            <p key={currency} className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {formatCurrencyShort(amount, currency)}
            </p>
          ))}
          {showKRW && exchangeRates && (
            (() => {
              const hasNonKRW = Object.keys(expenses).some((c) => c !== 'KRW')
              if (!hasNonKRW) return null
              let totalKRW = 0
              let valid = true
              for (const [currency, amount] of Object.entries(expenses)) {
                const krw = convertToKRW(amount, currency, exchangeRates)
                if (krw == null) { valid = false; break }
                totalKRW += krw
              }
              if (!valid) return null
              return (
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  ≈₩{totalKRW.toLocaleString()}
                </p>
              )
            })()
          )}
        </div>
      )}

      {/* Expand icon */}
      <div className="flex-shrink-0 text-zinc-400 dark:text-zinc-500">
        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </div>
    </button>
  )
}
