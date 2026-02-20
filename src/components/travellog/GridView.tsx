// ============================================
// Grid View
// Photo-centric 2-3 column gallery layout
// ============================================

import { Badge } from '@/components/ui/Badge'
import type { ExpenseCategory, TravelLog } from '@/types'
import { CURRENCY_SYMBOLS, EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { clsx } from 'clsx'
import { Clock, FileText, MapPin, Receipt } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

interface GridViewProps {
  logs: TravelLog[]
  onPhotoClick: (photo: string) => void
  onEdit: (log: TravelLog) => void
  isSelectionMode: boolean
  isSelected: (id: number) => boolean
  onToggleSelect: (id: number) => void
  onLongPress: (id: number) => void
}

const categoryColors: Record<
  ExpenseCategory,
  'orange' | 'blue' | 'purple' | 'pink' | 'cyan' | 'zinc'
> = {
  food: 'orange',
  transport: 'blue',
  accommodation: 'purple',
  shopping: 'pink',
  attraction: 'cyan',
  other: 'zinc',
}

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

function GridCell({
  log,
  onPhotoClick,
  onEdit,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
}: {
  log: TravelLog
  onPhotoClick: (photo: string) => void
  onEdit: (log: TravelLog) => void
  isSelectionMode: boolean
  isSelected: (id: number) => boolean
  onToggleSelect: (id: number) => void
  onLongPress: (id: number) => void
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const time = formatTime(log.timestamp)

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
    } else {
      onEdit(log)
    }
  }, [isSelectionMode, log, onToggleSelect, onPhotoClick, onEdit])

  const selected = log.id ? isSelected(log.id) : false

  return (
    // biome-ignore lint/a11y/useSemanticElements: complex cell content requires div
    <div
      role="button"
      tabIndex={0}
      className={clsx(
        'relative rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--card)]',
        'cursor-pointer active:scale-[0.98] transition-transform',
        selected && 'ring-2 ring-primary-500',
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick()
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <div
          className={clsx(
            'absolute top-1.5 left-1.5 z-10 size-5 rounded-full flex items-center justify-center border-2',
            selected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-white/80 bg-black/20',
          )}
        >
          {selected && <span className="text-[10px] font-bold">✓</span>}
        </div>
      )}

      {/* Photo type */}
      {log.type === 'photo' && (log.photo || log.thumbnailPhoto) ? (
        <div className="aspect-square">
          <img
            src={log.thumbnailPhoto || log.photo}
            alt="여행 사진"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Time overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
            <span className="text-[10px] text-white/90 flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {time}
            </span>
          </div>
        </div>
      ) : log.type === 'receipt' && log.expense ? (
        /* Receipt type */
        <div className="aspect-square flex flex-col justify-between p-2.5">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Receipt className="size-3 text-warning-500" />
              <span className="text-[10px] text-zinc-400">{time}</span>
            </div>
            <p className="text-xs font-medium text-[var(--foreground)] line-clamp-2 leading-tight">
              {log.expense.storeName}
            </p>
          </div>
          <div>
            <Badge color={categoryColors[log.expense.category]} size="sm">
              {EXPENSE_CATEGORY_LABELS[log.expense.category]}
            </Badge>
            <p className="text-sm font-bold text-[var(--foreground)] mt-1">
              {CURRENCY_SYMBOLS[log.expense.currency] || log.expense.currency}
              {['KRW', 'JPY', 'VND'].includes(log.expense.currency)
                ? log.expense.totalAmount.toLocaleString()
                : log.expense.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      ) : (
        /* Memo type */
        <div className="aspect-square flex flex-col justify-between p-2.5">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <FileText className="size-3 text-success-500" />
              <span className="text-[10px] text-zinc-400">{time}</span>
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-5 leading-relaxed">
              {log.memo}
            </p>
          </div>
          {(log.placeName || log.address) && (
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5 truncate">
              <MapPin className="size-2.5 flex-shrink-0" />
              <span className="truncate">{log.placeName || log.address}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function GridView({
  logs,
  onPhotoClick,
  onEdit,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
}: GridViewProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {logs.map((log) => (
        <GridCell
          key={log.id}
          log={log}
          onPhotoClick={onPhotoClick}
          onEdit={onEdit}
          isSelectionMode={isSelectionMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  )
}
