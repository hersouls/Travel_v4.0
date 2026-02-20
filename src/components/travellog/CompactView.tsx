// ============================================
// Compact View
// Single-line list for dense log display
// ============================================

import { IconButton } from '@/components/ui/Button'
import type { ExpenseCategory, TravelLog } from '@/types'
import { CURRENCY_SYMBOLS, EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { clsx } from 'clsx'
import { Camera, Edit3, FileText, Receipt, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

interface CompactViewProps {
  logs: TravelLog[]
  onEdit: (log: TravelLog) => void
  onDelete: (id: number) => void
  onPhotoClick: (photo: string) => void
  isSelectionMode: boolean
  isSelected: (id: number) => boolean
  onToggleSelect: (id: number) => void
  onLongPress: (id: number) => void
}

const typeIcons = {
  photo: { icon: Camera, color: 'text-primary-500' },
  receipt: { icon: Receipt, color: 'text-warning-500' },
  memo: { icon: FileText, color: 'text-success-500' },
} as const

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return ''
  }
}

function getSummaryText(log: TravelLog): string {
  if (log.type === 'receipt' && log.expense) {
    return `${log.expense.storeName} · ${EXPENSE_CATEGORY_LABELS[log.expense.category as ExpenseCategory]}`
  }
  if (log.type === 'photo') {
    return log.placeName || log.address || log.memo || '사진'
  }
  return log.memo?.slice(0, 80) || log.placeName || log.address || '메모'
}

function getAmountText(log: TravelLog): string | null {
  if (log.type !== 'receipt' || !log.expense) return null
  const symbol = CURRENCY_SYMBOLS[log.expense.currency] || log.expense.currency
  if (['KRW', 'JPY', 'VND'].includes(log.expense.currency)) {
    return `${symbol}${log.expense.totalAmount.toLocaleString()}`
  }
  return `${symbol}${log.expense.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

function CompactRow({
  log,
  onEdit,
  onDelete,
  onPhotoClick,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
}: {
  log: TravelLog
  onEdit: (log: TravelLog) => void
  onDelete: (id: number) => void
  onPhotoClick: (photo: string) => void
  isSelectionMode: boolean
  isSelected: (id: number) => boolean
  onToggleSelect: (id: number) => void
  onLongPress: (id: number) => void
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { icon: Icon, color } = typeIcons[log.type]
  const time = formatTime(log.timestamp)
  const summary = getSummaryText(log)
  const amount = getAmountText(log)
  const selected = log.id ? isSelected(log.id) : false

  const handleTouchStart = useCallback(() => {
    if (!log.id) return
    longPressTimer.current = setTimeout(() => onLongPress(log.id!), 500)
  }, [onLongPress, log.id])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  const handleClick = useCallback(() => {
    if (isSelectionMode && log.id) {
      onToggleSelect(log.id)
    } else if (log.type === 'photo' && log.photo) {
      onPhotoClick(log.photo)
    }
  }, [isSelectionMode, log, onToggleSelect, onPhotoClick])

  return (
    <div
      role={isSelectionMode ? 'button' : undefined}
      tabIndex={isSelectionMode ? 0 : undefined}
      className={clsx(
        'group flex items-center gap-2 py-2 px-2 rounded-lg transition-colors',
        'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
        isSelectionMode && 'cursor-pointer',
        selected && 'bg-primary-50 dark:bg-primary-900/20',
      )}
      onClick={handleClick}
      onKeyDown={
        isSelectionMode
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') handleClick()
            }
          : undefined
      }
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Selection or type icon */}
      {isSelectionMode ? (
        <div
          className={clsx(
            'size-6 rounded-full flex items-center justify-center border-2 flex-shrink-0',
            selected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-zinc-300 dark:border-zinc-600',
          )}
        >
          {selected && <span className="text-[10px] font-bold">✓</span>}
        </div>
      ) : (
        <Icon className={clsx('size-4 flex-shrink-0', color)} />
      )}

      {/* Time */}
      <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0 w-11 tabular-nums">
        {time}
      </span>

      {/* Summary text */}
      <span className="flex-1 text-sm text-[var(--foreground)] truncate">{summary}</span>

      {/* Amount (receipt only) */}
      {amount && (
        <span className="flex-shrink-0 text-xs font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
          {amount}
        </span>
      )}

      {/* Action buttons (hover reveal) */}
      {!isSelectionMode && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <IconButton
            plain
            color="secondary"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              onEdit(log)
            }}
            aria-label="수정"
          >
            <Edit3 className="size-3" />
          </IconButton>
          {log.id && (
            <IconButton
              plain
              color="danger"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation()
                onDelete(log.id!)
              }}
              aria-label="삭제"
            >
              <Trash2 className="size-3" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  )
}

export function CompactView({
  logs,
  onEdit,
  onDelete,
  onPhotoClick,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
}: CompactViewProps) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {logs.map((log) => (
        <CompactRow
          key={log.id}
          log={log}
          onEdit={onEdit}
          onDelete={onDelete}
          onPhotoClick={onPhotoClick}
          isSelectionMode={isSelectionMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  )
}
