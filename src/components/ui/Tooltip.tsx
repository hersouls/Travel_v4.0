// ============================================
// Tooltip Component
// ============================================

import { clsx } from 'clsx'
import { type ReactNode, useState } from 'react'
import { Button, OverlayArrow, Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components'

interface TooltipProps {
  content: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  children: ReactNode
  className?: string
}

export function Tooltip({ content, placement = 'top', delay = 300, children, className }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <TooltipTrigger delay={delay} isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        onPress={() => setIsOpen(!isOpen)}
      >
        {children}
      </Button>
      <AriaTooltip
        placement={placement}
        offset={8}
        className={clsx(
          'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900',
          'px-2.5 py-1.5 text-sm rounded-lg shadow-lg',
          'animate-fade-in',
          'max-w-xs',
          className
        )}
      >
        <OverlayArrow>
          <svg
            width={12}
            height={6}
            viewBox="0 0 12 6"
            className="fill-zinc-900 dark:fill-zinc-100"
          >
            <path d="M0 6L6 0L12 6" />
          </svg>
        </OverlayArrow>
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  )
}
