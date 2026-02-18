// ============================================
// Mini Timeline Component
// Compact timeline for DayDetail page (last 3 items)
// ============================================

import { useMemo } from 'react'
import { Camera, Receipt, FileText, Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { TravelLog } from '@/types'
import { CURRENCY_SYMBOLS } from '@/utils/constants'

interface MiniTimelineProps {
  logs: TravelLog[]
  tripId: number
  className?: string
}

const typeIcons = {
  photo: Camera,
  receipt: Receipt,
  memo: FileText,
} as const

const typeBgColors = {
  photo: 'bg-primary-500',
  receipt: 'bg-warning-500',
  memo: 'bg-success-500',
} as const

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getLogSummary(log: TravelLog): string {
  if (log.type === 'receipt' && log.expense) {
    return `${log.expense.storeName} · ${formatAmount(log.expense.totalAmount, log.expense.currency)}`
  }
  if (log.type === 'memo' && log.memo) {
    return log.memo.length > 40 ? log.memo.slice(0, 40) + '...' : log.memo
  }
  if (log.type === 'photo') {
    return log.placeName || log.address || '사진'
  }
  return log.memo || ''
}

export function MiniTimeline({ logs, tripId, className }: MiniTimelineProps) {
  const recentLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
  }, [logs])

  if (recentLogs.length === 0) return null

  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">여행 기록</h3>
        <Link
          to={`/trips/${tripId}/log`}
          className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          전체 보기
          <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {recentLogs.map((log) => {
          const Icon = typeIcons[log.type]
          return (
            <div
              key={log.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)]"
            >
              <div className={clsx('size-7 rounded-full flex items-center justify-center text-white flex-shrink-0', typeBgColors[log.type])}>
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {getLogSummary(log)}
                </p>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-zinc-400 flex-shrink-0">
                <Clock className="size-2.5" />
                {formatTime(log.timestamp)}
              </span>
            </div>
          )
        })}
      </div>

      {logs.length > 3 && (
        <p className="text-xs text-zinc-400 text-center">
          +{logs.length - 3}개 더 보기
        </p>
      )}
    </div>
  )
}
