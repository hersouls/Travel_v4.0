// ============================================
// Badge Component
// ============================================

import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import type { PlanType } from '@/types'

type BadgeColor = 'zinc' | 'primary' | 'success' | 'warning' | 'danger' | 'blue' | 'purple' | 'pink' | 'orange' | 'cyan'

interface BadgeProps {
  color?: BadgeColor
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  dot?: boolean
  className?: string
  children: ReactNode
}

const colorStyles: Record<BadgeColor, { solid: string; outline: string; dot: string }> = {
  zinc: {
    solid: 'bg-zinc-100 text-zinc-700 ring-zinc-500/10 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-500/20',
    outline: 'bg-transparent text-zinc-600 ring-zinc-500/20 dark:text-zinc-400 dark:ring-zinc-500/30',
    dot: 'bg-zinc-500',
  },
  primary: {
    solid: 'bg-primary-50 text-primary-700 ring-primary-500/10 dark:bg-primary-900/50 dark:text-primary-300 dark:ring-primary-500/20',
    outline: 'bg-transparent text-primary-600 ring-primary-500/20 dark:text-primary-400 dark:ring-primary-500/30',
    dot: 'bg-primary-500',
  },
  success: {
    solid: 'bg-success-50 text-success-700 ring-success-500/10 dark:bg-success-900/50 dark:text-success-300 dark:ring-success-500/20',
    outline: 'bg-transparent text-success-600 ring-success-500/20 dark:text-success-400 dark:ring-success-500/30',
    dot: 'bg-success-500',
  },
  warning: {
    solid: 'bg-warning-50 text-warning-700 ring-warning-500/10 dark:bg-warning-900/50 dark:text-warning-300 dark:ring-warning-500/20',
    outline: 'bg-transparent text-warning-600 ring-warning-500/20 dark:text-warning-400 dark:ring-warning-500/30',
    dot: 'bg-warning-500',
  },
  danger: {
    solid: 'bg-danger-50 text-danger-700 ring-danger-500/10 dark:bg-danger-900/50 dark:text-danger-300 dark:ring-danger-500/20',
    outline: 'bg-transparent text-danger-600 ring-danger-500/20 dark:text-danger-400 dark:ring-danger-500/30',
    dot: 'bg-danger-500',
  },
  blue: {
    solid: 'bg-blue-50 text-blue-700 ring-blue-500/10 dark:bg-blue-900/50 dark:text-blue-300 dark:ring-blue-500/20',
    outline: 'bg-transparent text-blue-600 ring-blue-500/20 dark:text-blue-400 dark:ring-blue-500/30',
    dot: 'bg-blue-500',
  },
  purple: {
    solid: 'bg-purple-50 text-purple-700 ring-purple-500/10 dark:bg-purple-900/50 dark:text-purple-300 dark:ring-purple-500/20',
    outline: 'bg-transparent text-purple-600 ring-purple-500/20 dark:text-purple-400 dark:ring-purple-500/30',
    dot: 'bg-purple-500',
  },
  pink: {
    solid: 'bg-pink-50 text-pink-700 ring-pink-500/10 dark:bg-pink-900/50 dark:text-pink-300 dark:ring-pink-500/20',
    outline: 'bg-transparent text-pink-600 ring-pink-500/20 dark:text-pink-400 dark:ring-pink-500/30',
    dot: 'bg-pink-500',
  },
  orange: {
    solid: 'bg-orange-50 text-orange-700 ring-orange-500/10 dark:bg-orange-900/50 dark:text-orange-300 dark:ring-orange-500/20',
    outline: 'bg-transparent text-orange-600 ring-orange-500/20 dark:text-orange-400 dark:ring-orange-500/30',
    dot: 'bg-orange-500',
  },
  cyan: {
    solid: 'bg-cyan-50 text-cyan-700 ring-cyan-500/10 dark:bg-cyan-900/50 dark:text-cyan-300 dark:ring-cyan-500/20',
    outline: 'bg-transparent text-cyan-600 ring-cyan-500/20 dark:text-cyan-400 dark:ring-cyan-500/30',
    dot: 'bg-cyan-500',
  },
}

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]/4 gap-1',
  md: 'px-2 py-0.5 text-xs/5 gap-1.5',
  lg: 'px-2.5 py-1 text-sm/5 gap-1.5',
}

export function Badge({ color = 'zinc', variant = 'solid', size = 'md', dot = false, className, children }: BadgeProps) {
  const colorStyle = colorStyles[color]

  return (
    <span className={clsx('inline-flex items-center font-medium rounded-md ring-1 ring-inset', colorStyle[variant], sizeStyles[size], className)}>
      {dot && <span className={clsx('size-1.5 rounded-full', colorStyle.dot)} aria-hidden="true" />}
      {children}
    </span>
  )
}

// Plan type badge with specific colors
const planTypeColors: Record<PlanType, BadgeColor> = {
  attraction: 'purple',
  restaurant: 'orange',
  hotel: 'blue',
  transport: 'zinc',
  car: 'success',
  plane: 'cyan',
  airport: 'cyan',
  other: 'zinc',
}

const planTypeLabels: Record<PlanType, string> = {
  attraction: '관광',
  restaurant: '식당',
  hotel: '숙소',
  transport: '교통',
  car: '렌트카',
  plane: '항공',
  airport: '공항',
  other: '기타',
}

interface PlanTypeBadgeProps {
  type: PlanType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function PlanTypeBadge({ type, size = 'sm', className }: PlanTypeBadgeProps) {
  return (
    <Badge color={planTypeColors[type]} size={size} className={className}>
      {planTypeLabels[type]}
    </Badge>
  )
}
