// ============================================
// SpeedDial FAB Component
// Expandable floating action button with sub-actions
// ============================================

import { useState, useCallback, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface SpeedDialAction {
  id: string
  icon: ReactNode
  label: string
  onClick: () => void
  color?: string
}

interface SpeedDialFABProps {
  actions: SpeedDialAction[]
  mainIcon?: ReactNode
  className?: string
}

export function SpeedDialFAB({ actions, mainIcon, className }: SpeedDialFABProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, close])

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/20 dark:bg-zinc-950/40 backdrop-blur-[2px] transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <div className={clsx('fixed bottom-24 lg:bottom-8 right-4 lg:right-8 z-50 flex flex-col-reverse items-center gap-3', className)}>
        {/* Sub-actions */}
        {actions.map((action, index) => (
          <div
            key={action.id}
            className={clsx(
              'flex items-center gap-3 transition-all duration-200',
              isOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none'
            )}
            style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
          >
            <span className="px-3 py-1.5 rounded-lg bg-[var(--popover)] text-[var(--popover-foreground)] text-xs font-medium whitespace-nowrap shadow-lg">
              {action.label}
            </span>
            <button
              type="button"
              onClick={() => {
                close()
                action.onClick()
              }}
              className={clsx(
                'size-12 rounded-full shadow-lg flex items-center justify-center',
                'transition-transform duration-150 active:scale-95',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                action.color || 'bg-primary-600 text-white hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400'
              )}
              aria-label={action.label}
            >
              {action.icon}
            </button>
          </div>
        ))}

        {/* Main FAB */}
        <button
          type="button"
          onClick={toggle}
          className={clsx(
            'size-14 rounded-full shadow-xl flex items-center justify-center',
            'bg-primary-600 text-white hover:bg-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400',
            'transition-all duration-200 active:scale-95',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            isOpen && 'rotate-45'
          )}
          aria-label={isOpen ? '닫기' : '기록 추가'}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="size-6" />
          ) : (
            mainIcon || <Plus className="size-6" />
          )}
        </button>
      </div>
    </>
  )
}
