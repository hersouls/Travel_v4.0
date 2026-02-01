// ============================================
// Card Component
// ============================================

import { clsx } from 'clsx'
import { type HTMLAttributes, type ReactNode, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'interactive' | 'outline'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variantStyles = {
  default: clsx('bg-white dark:bg-zinc-900', 'ring-1 ring-zinc-950/5 dark:ring-white/10'),
  elevated: clsx(
    'bg-white dark:bg-zinc-900',
    'shadow-lg shadow-zinc-950/5 dark:shadow-none',
    'ring-1 ring-zinc-950/5 dark:ring-white/10'
  ),
  bordered: clsx('bg-transparent', 'border-2 border-zinc-200 dark:border-zinc-700'),
  outline: clsx('bg-white/50 dark:bg-zinc-900/50', 'ring-1 ring-zinc-950/10 dark:ring-white/15'),
  interactive: clsx(
    'bg-white dark:bg-zinc-900',
    'ring-1 ring-zinc-950/5 dark:ring-white/10',
    'hover:ring-zinc-950/10 dark:hover:ring-white/20',
    'hover:shadow-md hover:shadow-zinc-950/5 dark:hover:shadow-none',
    'transition-all duration-200 cursor-pointer',
    'active:ring-zinc-950/15 dark:active:ring-white/25'
  ),
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
    const isInteractive = variant === 'interactive'

    return (
      <div
        ref={ref}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        className={clsx(
          'rounded-xl',
          variantStyles[variant],
          paddingStyles[padding],
          isInteractive && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          className
        )}
        onKeyDown={
          isInteractive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  ;(e.target as HTMLElement).click()
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function CardHeader({ title, description, icon, action, className, ...props }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4', className)} {...props}>
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className="flex-shrink-0 size-10 rounded-lg bg-primary-50 dark:bg-primary-950/50 ring-1 ring-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base/7 font-semibold text-zinc-950 dark:text-white">{title}</h3>
          {description && <p className="mt-0.5 text-sm/6 text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={clsx('mt-4', className)} {...props}>
      {children}
    </div>
  )
}
