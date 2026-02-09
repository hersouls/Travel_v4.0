// ============================================
// Dialog Component
// ============================================

import { Dialog as HeadlessDialog, DialogBackdrop, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  children: ReactNode
  className?: string
}

const sizeStyles = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  full: 'sm:max-w-[calc(100vw-2rem)]',
}

export function Dialog({ open, onClose, size = 'md', children, className }: DialogProps) {
  return (
    <Transition show={open} as={Fragment}>
      <HeadlessDialog onClose={onClose} className="relative z-60">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-zinc-950/25 dark:bg-zinc-950/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel
                className={clsx(
                  'w-full rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl',
                  'ring-1 ring-zinc-950/5 dark:ring-white/10',
                  sizeStyles[size],
                  className
                )}
              >
                {children}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  )
}

interface DialogTitleProps {
  children: ReactNode
  onClose?: () => void
  className?: string
}

export function DialogTitle({ children, onClose, className }: DialogTitleProps) {
  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <h2 className="text-lg/7 font-semibold text-zinc-950 dark:text-white">{children}</h2>
      {onClose && (
        <IconButton onClick={onClose} plain color="secondary" aria-label="닫기">
          <X className="size-5" />
        </IconButton>
      )}
    </div>
  )
}

interface DialogDescriptionProps {
  children: ReactNode
  className?: string
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return <p className={clsx('mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400', className)}>{children}</p>
}

interface DialogBodyProps {
  children: ReactNode
  className?: string
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={clsx('mt-4', className)}>{children}</div>
}

interface DialogActionsProps {
  children: ReactNode
  className?: string
}

export function DialogActions({ children, className }: DialogActionsProps) {
  return <div className={clsx('mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)}>{children}</div>
}
