// ============================================
// Skeleton Component
// ============================================

import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export function Skeleton({ className, variant = 'text', width, height }: SkeletonProps) {
  const baseStyles = 'animate-shimmer'

  const variantStyles = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return <div className={clsx(baseStyles, variantStyles[variant], className)} style={style} />
}

// Common skeleton patterns
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? 'w-3/4' : 'w-full'} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl bg-[var(--card)] p-4 ring-1 ring-zinc-950/5 dark:ring-white/10', className)}>
      <Skeleton variant="rectangular" height={120} className="w-full mb-4" />
      <Skeleton className="w-3/4 mb-2" />
      <Skeleton className="w-1/2" />
    </div>
  )
}
