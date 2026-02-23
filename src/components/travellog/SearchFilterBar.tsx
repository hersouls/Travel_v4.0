// ============================================
// Search + Filter Bar
// Text search with category filter chips
// ============================================

import type { ExpenseCategory } from '@/types'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { clsx } from 'clsx'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface SearchFilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  categoryFilter: ExpenseCategory | null
  onCategoryFilterChange: (cat: ExpenseCategory | null) => void
  resultCount?: number
}

const CATEGORIES: ExpenseCategory[] = [
  'food',
  'transport',
  'accommodation',
  'shopping',
  'attraction',
  'other',
]

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  resultCount,
}: SearchFilterBarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [localQuery, onSearchChange])

  // Sync external changes
  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  const handleClear = useCallback(() => {
    setLocalQuery('')
    onSearchChange('')
    onCategoryFilterChange(null)
  }, [onSearchChange, onCategoryFilterChange])

  const isActive = localQuery.trim() || categoryFilter

  return (
    <div className="space-y-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="장소, 메모, 상점명 검색..."
          className={clsx(
            'w-full pl-9 pr-9 py-2 text-sm rounded-lg',
            'bg-zinc-100 dark:bg-zinc-800',
            'text-[var(--foreground)] placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            'border border-transparent focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
            'outline-none transition-colors',
          )}
        />
        {isActive && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="검색 초기화"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryFilterChange(categoryFilter === cat ? null : cat)}
            className={clsx(
              'flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap',
              categoryFilter === cat
                ? 'bg-primary-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700',
            )}
          >
            {EXPENSE_CATEGORY_LABELS[cat]}
          </button>
        ))}

        {/* Result count badge */}
        {resultCount !== undefined && (
          <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {resultCount}개 결과
          </span>
        )}
      </div>
    </div>
  )
}
