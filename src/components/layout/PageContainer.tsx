import { clsx } from 'clsx'
import type { ReactNode } from 'react'

const maxWidthStyles = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  wide: 'max-w-[1800px]', // 와이드 PC 전문가 레이아웃
  full: 'max-w-full',
}

interface PageContainerProps {
  children: ReactNode
  className?: string
  noPadding?: boolean
  fullHeight?: boolean
  maxWidth?: keyof typeof maxWidthStyles
}

export function PageContainer({
  children,
  className,
  noPadding = false,
  fullHeight = false,
  maxWidth = '2xl',
}: PageContainerProps) {
  // Full height mode for map pages
  if (fullHeight) {
    return (
      <div className={clsx('flex-1 flex flex-col overflow-hidden', className)}>
        {children}
      </div>
    )
  }

  // Standard page container with scrolling
  return (
    <main
      className={clsx(
        'flex-1 overflow-y-auto overscroll-contain', // overscroll-contain: 풀투리프레시/바텀시트 스크롤 체이닝 차단
        !noPadding && 'p-3 sm:p-4 lg:p-6',
        'pb-[calc(5rem_+_env(safe-area-inset-bottom))] lg:pb-6', // Bottom nav spacing + safe area
        className
      )}
    >
      <div className={clsx('mx-auto', maxWidthStyles[maxWidth])}>
        {children}
      </div>
    </main>
  )
}
