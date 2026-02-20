// ============================================
// View Mode Toggle
// Segmented control: Timeline / Grid / Compact
// ============================================

import { clsx } from 'clsx'
import { AlignJustify, Grid3x3, List } from 'lucide-react'

export type ViewMode = 'timeline' | 'grid' | 'compact'

interface ViewModeToggleProps {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}

const modes: { value: ViewMode; icon: typeof List; label: string }[] = [
  { value: 'timeline', icon: List, label: '타임라인' },
  { value: 'grid', icon: Grid3x3, label: '그리드' },
  { value: 'compact', icon: AlignJustify, label: '컴팩트' },
]

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
      {modes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={clsx(
            'p-1.5 rounded-md transition-colors',
            viewMode === value
              ? 'bg-white dark:bg-zinc-700 text-[var(--foreground)] shadow-sm'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300',
          )}
          aria-label={label}
          title={label}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}
