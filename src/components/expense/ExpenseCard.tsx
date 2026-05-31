// ============================================
// Expense Card Component
// Renders a single expense entry
// ============================================

import { Trash2, Edit3, MapPin, Banknote, CreditCard, Coins } from 'lucide-react'
import { clsx } from 'clsx'
import type { Expense, ExpenseCategory, PaymentMethod } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SUBCATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'

interface ExpenseCardProps {
  expense: Expense
  thumbnailPhoto?: string | null
  onEdit?: (expense: Expense) => void
  onDelete?: (id: number) => void
  exchangeRates?: Record<string, number> | null
}

const categoryColors: Record<ExpenseCategory, 'orange' | 'blue' | 'purple' | 'pink' | 'cyan' | 'zinc'> = {
  food: 'orange',
  transport: 'blue',
  accommodation: 'purple',
  shopping: 'pink',
  attraction: 'cyan',
  other: 'zinc',
}

const categoryBgColors: Record<ExpenseCategory, string> = {
  food: 'bg-warning-500',
  transport: 'bg-primary-500',
  accommodation: 'bg-purple-500',
  shopping: 'bg-pink-500',
  attraction: 'bg-cyan-500',
  other: 'bg-zinc-400',
}

const paymentMethodIcons: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  other: Coins,
}

const paymentMethodBadgeColors: Record<PaymentMethod, 'success' | 'blue' | 'zinc'> = {
  cash: 'success',
  card: 'blue',
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

function formatAmount(amount: number): string {
  return `₩${Math.round(amount).toLocaleString()}`
}

/** Check if a string looks like raw coordinates (e.g. "37.5665, 126.9780") */
function isCoordinateString(str: string): boolean {
  return /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(str.trim())
}

function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function ExpenseCard({ expense, thumbnailPhoto, onEdit, onDelete, exchangeRates }: ExpenseCardProps) {
  const toKRW = (amount: number, currency: string): number => {
    if (!exchangeRates) return amount
    return convertToKRW(amount, currency, exchangeRates) ?? amount
  }
  const time = formatTime(expense.timestamp)

  return (
    <div className="flex gap-2 sm:gap-3 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        {thumbnailPhoto ? (
          <img
            src={thumbnailPhoto}
            alt=""
            className="size-8 rounded-full object-cover ring-2 ring-[var(--border)]"
            loading="lazy"
          />
        ) : (
          <div className={clsx('size-8 rounded-full flex items-center justify-center text-white', categoryBgColors[expense.category])}>
            <span className="text-xs font-bold">
              {EXPENSE_CATEGORY_LABELS[expense.category]?.charAt(0)}
            </span>
          </div>
        )}
        <div className="w-0.5 flex-1 bg-[var(--border)] mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-3 transition-shadow hover:shadow-sm">
          {/* Header: time + badges + actions */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {time && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{time}</span>
              )}
              <Badge color={categoryColors[expense.category]} size="sm">
                {EXPENSE_CATEGORY_LABELS[expense.category]}
              </Badge>
              {expense.subCategory && (
                <Badge color="zinc" size="sm">
                  {EXPENSE_SUBCATEGORY_LABELS[expense.subCategory] || expense.subCategory}
                </Badge>
              )}
              {expense.paymentMethod && (() => {
                const PMIcon = paymentMethodIcons[expense.paymentMethod]
                return (
                  <Badge color={paymentMethodBadgeColors[expense.paymentMethod]} size="sm">
                    <PMIcon className="size-2.5 mr-0.5 inline" />
                    {PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                  </Badge>
                )
              })()}
            </div>
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <IconButton plain color="secondary" onClick={() => onEdit(expense)} aria-label="수정">
                  <Edit3 className="size-3.5" />
                </IconButton>
              )}
              {onDelete && expense.id && (
                <IconButton plain color="danger" onClick={() => onDelete(expense.id!)} aria-label="삭제">
                  <Trash2 className="size-3.5" />
                </IconButton>
              )}
            </div>
          </div>

          {/* Store name + amount */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">
              {expense.storeName}
            </p>
            <span className="text-sm font-bold text-[var(--foreground)] flex-shrink-0 ml-2">
              {formatAmount(toKRW(expense.totalAmount, expense.currency))}
            </span>
          </div>

          {/* Items preview */}
          {expense.items.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {expense.items.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="truncate">
                    {item.name}
                    {item.quantity && item.unitPrice ? (
                      <span className="text-zinc-400 dark:text-zinc-500 ml-1">
                        ({item.quantity}개 &times; {toKRW(item.unitPrice, expense.currency).toLocaleString()})
                      </span>
                    ) : null}
                  </span>
                  <span className="flex-shrink-0 ml-2">
                    {formatAmount(toKRW(item.amount, expense.currency))}
                  </span>
                </div>
              ))}
              {expense.items.length > 3 && (
                <p className="text-xs text-zinc-400">+{expense.items.length - 3}개 더</p>
              )}
            </div>
          )}

          {/* Memo */}
          {expense.memo && (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {expense.memo}
            </p>
          )}

          {/* Address / Location link */}
          {(() => {
            const hasCoords = typeof expense.latitude === 'number' && typeof expense.longitude === 'number'
              && isFinite(expense.latitude) && isFinite(expense.longitude)
            const addressIsCoords = expense.address && isCoordinateString(expense.address)

            // Case 1: address is raw coordinates or no address but has lat/lng → show Google Maps link
            if (hasCoords && (!expense.address || addressIsCoords)) {
              return (
                <a
                  href={buildGoogleMapsUrl(expense.latitude!, expense.longitude!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-0.5 text-[10px] text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 truncate"
                >
                  <MapPin className="size-2.5 flex-shrink-0" />
                  {expense.latitude!.toFixed(4)}, {expense.longitude!.toFixed(4)}
                </a>
              )
            }

            // Case 2: normal address text (with optional Maps link if coords available)
            if (expense.address && !addressIsCoords) {
              return hasCoords ? (
                <a
                  href={buildGoogleMapsUrl(expense.latitude!, expense.longitude!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-0.5 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-primary-500 dark:hover:text-primary-400 truncate"
                >
                  <MapPin className="size-2.5 flex-shrink-0" />
                  {expense.address}
                </a>
              ) : (
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                  {expense.address}
                </p>
              )
            }

            return null
          })()}
        </div>
      </div>
    </div>
  )
}
