// ============================================
// Toast Component
// ============================================

import { clsx } from 'clsx'
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from './Button'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastProps extends ToastData {
  onDismiss: (id: string) => void
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorStyles = {
  success: 'bg-success-50 text-success-800 dark:bg-success-900/50 dark:text-success-200 ring-success-500/20',
  error: 'bg-danger-50 text-danger-800 dark:bg-danger-900/50 dark:text-danger-200 ring-danger-500/20',
  warning: 'bg-warning-50 text-warning-800 dark:bg-warning-900/50 dark:text-warning-200 ring-warning-500/20',
  info: 'bg-primary-50 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200 ring-primary-500/20',
}

const iconColorStyles = {
  success: 'text-success-500 dark:text-success-400',
  error: 'text-danger-500 dark:text-danger-400',
  warning: 'text-warning-500 dark:text-warning-400',
  info: 'text-primary-500 dark:text-primary-400',
}

export function Toast({ id, type, title, message, duration = 5000, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const Icon = iconMap[type]

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(showTimer)
  }, [])

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsLeaving(true)
        setTimeout(() => onDismiss(id), 300)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, id, onDismiss])

  const handleDismiss = () => {
    setIsLeaving(true)
    setTimeout(() => onDismiss(id), 300)
  }

  return (
    <div
      className={clsx(
        'pointer-events-auto w-full max-w-sm rounded-lg p-4 ring-1 ring-inset shadow-lg',
        colorStyles[type],
        'transform transition-all duration-300 ease-out',
        isVisible && !isLeaving ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={clsx('size-5 flex-shrink-0 mt-0.5', iconColorStyles[type])} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {message && <p className="mt-1 text-sm opacity-90">{message}</p>}
        </div>
        <IconButton onClick={handleDismiss} plain color="secondary" className="-m-1" aria-label="닫기">
          <X className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col items-end justify-start p-4 gap-3 z-70">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
