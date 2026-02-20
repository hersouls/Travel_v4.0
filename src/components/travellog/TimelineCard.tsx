// ============================================
// Timeline Card Component
// Renders a single travel log entry in timeline
// ============================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Receipt, FileText, MapPin, Clock, Trash2, Edit3, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import type { TravelLog, ExpenseCategory } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { EXPENSE_CATEGORY_LABELS, CURRENCY_SYMBOLS } from '@/utils/constants'

interface TimelineCardProps {
  log: TravelLog
  onEdit?: (log: TravelLog) => void
  onDelete?: (id: number) => void
  onPhotoClick?: (photo: string) => void
  compact?: boolean
  // Bulk selection
  isSelectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: number) => void
  onLongPress?: (id: number) => void
}

const typeConfig = {
  photo: { icon: Camera, label: '사진', color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-500' },
  receipt: { icon: Receipt, label: '영수증', color: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-500' },
  memo: { icon: FileText, label: '메모', color: 'text-success-600 dark:text-success-400', bg: 'bg-success-500' },
} as const

const categoryColors: Record<ExpenseCategory, 'orange' | 'blue' | 'purple' | 'pink' | 'cyan' | 'zinc'> = {
  food: 'orange',
  transport: 'blue',
  accommodation: 'purple',
  shopping: 'pink',
  attraction: 'cyan',
  other: 'zinc',
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function TimelineCard({
  log, onEdit, onDelete, onPhotoClick, compact = false,
  isSelectionMode, isSelected, onToggleSelect, onLongPress,
}: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [exifExpanded, setExifExpanded] = useState(false)
  const config = typeConfig[log.type]
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // hasExifDetails: camera info only (GPS moved to header)
  const hasExifDetails = Boolean(
    log.exif && (log.exif.cameraMake || log.exif.cameraModel)
  )
  const hasLocation = Boolean(log.latitude && log.longitude)
  const Icon = config.icon
  const time = formatTime(log.timestamp)

  // Long press handlers for bulk selection
  const handleTouchStart = useCallback(() => {
    if (!onLongPress || !log.id) return
    longPressTimer.current = setTimeout(() => {
      onLongPress(log.id!)
    }, 500)
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

  const handleCardClick = useCallback(() => {
    if (isSelectionMode && onToggleSelect && log.id) {
      onToggleSelect(log.id)
    }
  }, [isSelectionMode, onToggleSelect, log.id])

  return (
    <div
      className={clsx('flex gap-3 group', isSelectionMode && 'cursor-pointer')}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={isSelectionMode ? handleCardClick : undefined}
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        {isSelectionMode ? (
          <div className={clsx(
            'size-8 rounded-full flex items-center justify-center border-2 transition-colors',
            isSelected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-zinc-300 dark:border-zinc-600 bg-[var(--card)]'
          )}>
            {isSelected && <span className="text-xs font-bold">✓</span>}
          </div>
        ) : (
          <div className={clsx('size-8 rounded-full flex items-center justify-center text-white', config.bg)}>
            <Icon className="size-4" />
          </div>
        )}
        <div className="w-0.5 flex-1 bg-[var(--border)] mt-1" />
      </div>

      {/* Card content */}
      <div className={clsx(
        'flex-1 mb-4 rounded-xl border border-[var(--border)] bg-[var(--card)]',
        'shadow-sm hover:shadow-md transition-shadow',
        compact && 'mb-2',
        isSelected && 'ring-2 ring-primary-500 border-primary-500'
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
          {time && (
            <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <Clock className="size-3" />
              {time}
            </span>
          )}
          {/* Location: Google Maps link if coordinates available */}
          {hasLocation ? (
            <a
              href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="size-3 flex-shrink-0" />
              <span className="truncate">{log.placeName || log.address || `${log.latitude!.toFixed(4)}, ${log.longitude!.toFixed(4)}`}</span>
            </a>
          ) : (log.placeName || log.address) ? (
            <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 truncate">
              <MapPin className="size-3 flex-shrink-0" />
              <span className="truncate">{log.placeName || log.address}</span>
            </span>
          ) : null}
          <div className="flex-1" />
          {!compact && !isSelectionMode && (
            <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <IconButton plain color="secondary" onClick={() => onEdit(log)} aria-label="수정">
                  <Edit3 className="size-3.5" />
                </IconButton>
              )}
              {onDelete && log.id && (
                <IconButton plain color="danger" onClick={() => onDelete(log.id!)} aria-label="삭제">
                  <Trash2 className="size-3.5" />
                </IconButton>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-3">
          {/* Photo type — use full photo with lazy loading */}
          {log.type === 'photo' && (log.photo || log.thumbnailPhoto) && (
            <div className="mb-2">
              <img
                src={log.photo || log.thumbnailPhoto}
                alt="여행 사진"
                className={clsx(
                  'w-full max-h-48 object-cover rounded-lg',
                  onPhotoClick && 'cursor-pointer hover:opacity-90 transition-opacity'
                )}
                loading="lazy"
                onClick={onPhotoClick && log.photo ? (e) => { e.stopPropagation(); onPhotoClick(log.photo!) } : undefined}
              />
            </div>
          )}

          {/* Receipt type */}
          {log.type === 'receipt' && log.expense && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  {log.expense.storeName}
                </span>
                <Badge color={categoryColors[log.expense.category]} size="sm">
                  {EXPENSE_CATEGORY_LABELS[log.expense.category]}
                </Badge>
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(log.expense.totalAmount, log.expense.currency)}
              </div>

              {/* Expandable items */}
              {log.expense.items.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                  >
                    {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {log.expense.items.length}개 항목
                  </button>
                  {expanded && (
                    <div className="space-y-1 pt-1 border-t border-[var(--border)]">
                      {log.expense.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                          <span>{item.name}{item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''}</span>
                          <span>{formatCurrency(item.amount, log.expense!.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Receipt thumbnail — enlarged, clickable */}
              {(log.photo || log.thumbnailPhoto) && (
                <div className="mt-2">
                  <img
                    src={log.photo || log.thumbnailPhoto}
                    alt="영수증"
                    className={clsx(
                      'w-32 h-40 object-cover rounded-lg border border-zinc-200 dark:border-zinc-600',
                      onPhotoClick && 'cursor-pointer hover:opacity-90 transition-opacity'
                    )}
                    loading="lazy"
                    onClick={onPhotoClick && log.photo ? (e) => { e.stopPropagation(); onPhotoClick(log.photo!) } : undefined}
                  />
                </div>
              )}
            </div>
          )}

          {/* Memo */}
          {log.memo && (
            <p className={clsx(
              'text-sm text-zinc-700 dark:text-zinc-300',
              log.type !== 'memo' && 'mt-2'
            )}>
              {log.memo}
            </p>
          )}

          {/* EXIF Details — camera info only (GPS shown in header) */}
          {hasExifDetails && (
            <div className={clsx(
              'mt-2',
              (log.type !== 'memo' || log.memo) && 'border-t border-[var(--border)] pt-2'
            )}>
              <button
                type="button"
                onClick={() => setExifExpanded(!exifExpanded)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <Camera className="size-3" />
                <span>촬영 정보</span>
                {exifExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              </button>
              {exifExpanded && (
                <div className="mt-1.5 space-y-1">
                  {(log.exif?.cameraMake || log.exif?.cameraModel) && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <Camera className="size-3 flex-shrink-0" />
                      <span>
                        {[log.exif?.cameraMake, log.exif?.cameraModel].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
